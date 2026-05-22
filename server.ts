import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin
let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let projectId = process.env.FIREBASE_PROJECT_ID;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    projectId = projectId || firebaseConfig.projectId;
  }

  if (projectId) {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: projectId,
      });
    }
    adminDb = admin.firestore();
    adminAuth = admin.auth();
  } else {
    console.warn("No Firebase configuration found via firebase-applet-config.json or FIREBASE_PROJECT_ID env variable");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

// Middleware to verify Admin
const authenticateAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDb.collection("users").doc(decodedToken.uid).get();
    if (userDoc.exists && userDoc.data()?.role === "ADMIN") {
      req.user = decodedToken;
      next();
    } else {
      res.status(403).json({ error: "Forbidden: Admin access required" });
    }
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};

app.post("/api/admin/create-school-admin-invite", authenticateAdmin, async (req, res) => {
  const { schoolId, email } = req.body;
  if (!schoolId || !email) {
    return res.status(400).json({ error: "schoolId and email are required" });
  }

  try {
    const token = uuidv4();
    const inviteId = uuidv4();
    const invite = {
      id: inviteId,
      email: email.toLowerCase(),
      schoolId,
      role: "SCHOOL_ADMIN",
      token,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    };

    await adminDb.collection("school_admin_invites").doc(inviteId).set(invite);
    
    // In a real app, send email here. For now, we return the link.
    const inviteLink = `${req.protocol}://${req.get("host")}/accept-invite?token=${token}`;
    
    res.json({ success: true, inviteLink, inviteId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/accept-invite", async (req, res) => {
  const { token, idToken } = req.body;
  if (!token || !idToken) {
    return res.status(400).json({ error: "token and idToken are required" });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userEmail = decodedToken.email;
    const uid = decodedToken.uid;

    const inviteSnap = await adminDb.collection("school_admin_invites")
      .where("token", "==", token)
      .where("status", "==", "pending")
      .get();

    if (inviteSnap.empty) {
      return res.status(404).json({ error: "Invite not found or already accepted" });
    }

    const inviteDoc = inviteSnap.docs[0];
    const inviteData = inviteDoc.data();

    if (inviteData.email.toLowerCase() !== userEmail?.toLowerCase()) {
      return res.status(403).json({ error: `Email mismatch. This invite was sent to ${inviteData.email}, but you are signed in as ${userEmail}` });
    }

    if (inviteData.expiresAt < Date.now()) {
      await inviteDoc.ref.update({ status: "expired" });
      return res.status(410).json({ error: "Invite has expired" });
    }

    await adminDb.runTransaction(async (transaction) => {
      transaction.update(inviteDoc.ref, {
        status: "accepted",
        acceptedAt: Date.now(),
        acceptedByUid: uid
      });
      transaction.update(adminDb.collection("users").doc(uid), {
        role: "SCHOOL_ADMIN",
        schoolId: inviteData.schoolId,
        status: "ACTIVE-STUDENT" // Using a valid status from the enum
      });
    });

    res.json({ success: true, schoolId: inviteData.schoolId });
  } catch (error: any) {
    console.error("Accept invite error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize Gemini - Lazy implementation to prevent startup crashes if key is missing
let aiClient: any = null;
function getAi() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

app.post("/api/gemini/feedback", async (req, res) => {
  const { content, context, userQuestion, mode, personality, userId } = req.body;
  try {
    const ai = getAi();
    const isDraftEmpty = !content || content.trim().length < 5;
    const draftText = isDraftEmpty ? "[The page is currently a tabula rasa—a blank slate awaiting a thesis.]" : content;

    const personaPrompts: Record<string, string> = {
      "OXFORD_DON": "You are Arwright, an elite academic writing mentor. Your persona is that of a sophisticated Oxford don—intellectual, demanding, and sharply witty, but fundamentally committed to the student's pedagogical growth. Use dry, academic humor. You are a mentor who expects excellence.",
      "SUPPORTIVE_COACH": "You are Arwright, a warm and encouraging writing coach. Your persona is supportive, patient, and focuses on the student's effort and incremental progress. Use kind, motivating language. You believe every student can become a great writer.",
      "TECHNICAL_ARCHITECT": "You are Arwright, a precise technical writing architect. Your persona is objective, clinical, and focuses strictly on logical structure and efficient communication. No fluff or flowery metaphors. You treat writing as a system to be optimized.",
      "CREATIVE_CATALYST": "You are Arwright, an inspiring creative catalyst. Your persona is visionary, metaphorical, and focuses on the student's unique voice and expressive power. Use evocative language and push the student to find their own \"frequency.\""
    };

    const modeSpecific: Record<string, string> = {
      "ACADEMIC": "Focus on formal tone, objective stance, and precise definitions. Scrutinize the thesis statement.",
      "ANALYTICAL": "Focus on how the student interprets evidence or text. Ensure they aren't just summarizing but translating observations into insights.",
      "NARRATIVE": "Focus on narrative arc, character depth, and sensory detail. Ensure the 'voice' is compelling while maintaining a high linguistic standard.",
      "ARGUMENTATIVE": "Focus on the strength of the counter-argument, logical fallacies, and the persuasiveness of the evidence.",
      "TECHNICAL": "Focus on clarity, brevity, and accuracy. Remove ambiguity and ensure instructions or descriptions are logically sequenced."
    };

    const systemInstruction = `
      ${personaPrompts[personality] || personaPrompts["OXFORD_DON"]}
      
      CORE DIRECTIVES:
      1. SPECIFICITY: If the student provides a specific query or focus (e.g., Structure, Grammar, Tone, Logic), you MUST prioritize that dimension above all else in your feedback.
      2. OBJECTIVITY: Provide precise, professional, and evidence-based analysis of the student's writing.
      3. PEDAGOGY FIRST: Use the Socratic method to challenge the student's logic and structure. Do not write for them.
      4. ACADEMIC STANDARDS: Focus on thesis clarity, argumentative rigor, logical transitions, stylistic formalness, AND mechanical precision. 
      5. ADAPTABILITY: Adjust your feedback style based on the WRITING MODE provided.
      6. ACTIONABLE STRATEGY: When providing a "tip," offer a concrete strategy relevant to the mode and the specific dimension requested.
      
      Return your response in structured JSON with:
      - "feedback": string (The professional critique or Socratic question matching your persona, focused INTENSELY on the dimension requested)
      - "focusArea": "Logic & Argument" | "Structure & Flow" | "Voice & Tone" | "Evidence & Support" | "Grammar & Mechanics"
      - "suggestedExercise": string | null (A specific, actionable step to improve the draft based on the requested dimension)
    `;

    const prompt = userQuestion 
      ? `[CRITICAL FOCUS: ${userQuestion}]
         Writing Mode: ${mode}
         Guidance: ${modeSpecific[mode]}
         
         The student is asking specifically for: "${userQuestion}". 
         Analyze the draft through this EXACT lens. Ignore other issues for now if they distract from this specific audit.
         
         Draft: ${draftText}`
      : `Writing Mode: ${mode}
         Guidance: ${modeSpecific[mode]}
         
         Provide a general rigorous academic audit. Focus on the most pressing structural or logical requirement.
         
         Context: ${context}
         Student Draft: ${draftText}`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("Feedback error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/quiz", async (req, res) => {
  const { content, focusArea, userId } = req.body;
  try {
    const ai = getAi();
    const prompt = `Based on the following student writing snippet and the focus area "${focusArea}", create a 3-question multiple choice quiz to test the student's knowledge of the underlying principles. 
    
    If the focus is "Grammar & Mechanics", target a specific error seen in their text or a common related one.
    
    Return JSON only matches this schema:
    {
      "title": string,
      "type": "grammar" | "vocabulary" | "structure", 
      "questions": [
        {
          "question": string,
          "options": [string, string, string, string],
          "correctAnswer": number (index 0-3),
          "explanation": string
        }
      ]
    }
    
    Snippet: ${content.substring(0, 1000)}`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/summary", async (req, res) => {
  const { submission, mode, userId } = req.body;
  try {
    const ai = getAi();
    const prompt = `Writing Mode: ${mode}\n\nPerform an objective evaluation of this submission within its specific mode. Focus on how well the student met the requirements of this genre (2 sentences).\n\nSubmission: ${submission}`;
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert academic evaluator. Be concise, objective, and professional."
      }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/proficiency", async (req, res) => {
  const { submission, mode, userId } = req.body;
  try {
    const ai = getAi();
    const prompt = `Writing Mode: ${mode}\n\nAnalyze this submission to synthesize a professional writing proficiency profile. 
    Evaluate:
    1. Approximate Proficiency Band (e.g., "Secondary Upper", "Undergraduate Intermediate"). Use development stage descriptors.
    2. Readability Score (0-100, where 100 is very simple).
    3. Vocabulary Complexity (Low, Medium, High).
    4. Structural Maturity (Developing, Proficient, Advanced).
    5. A private feedback synthesis for the teacher explaining the rationale.
 
    Submission: ${submission}`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior writing assessment specialist. Synthesize development data for instructional support.",
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/integrity-review", async (req, res) => {
  const { submission, historicalSubmissions } = req.body;

  if (!submission) {
    return res.status(400).json({ error: "No submission provided" });
  }

  try {
    const ai = getAi();
    const prompt = `
      You are an expert writing process analyst assisting educators in understanding how a piece of writing was developed. Analyze the following writing process data for a student submission.
      
      SUBMISSION DATA:
      Title: ${submission.title || 'Untitled'}
      Student Name: ${submission.studentName}
      Writing Mode: ${submission.mode}
      Integrity Report: ${JSON.stringify(submission.integrity)}
      Thinking Trace (Keystroke-level logs): ${JSON.stringify(submission.thinkingTrace)}
      Final Content: ${JSON.stringify(submission.document)}
      
      HISTORICAL DATA:
      Prior Submissions: ${JSON.stringify(historicalSubmissions || [])}
      
      Analyze the signals:
      1. Drafting Timeline: Total time spent, bursts vs sustained activity.
      2. Paste & Insert Events: Size and timing of pastes.
      3. Revision Depth: Edits, structural changes.
      4. Linguistic Profile: Comparison to historical samples (if available).
      
      INSTRUCTIONS:
      - If fewer than 3 prior submissions are available, do not draw conclusions about linguistic consistency. State that insufficient historical data exists for that specific signal.
      - Use "caution" for status only when multiple signals align or there is a definitive, high-impact discrepancy. Do not base caution on a single minor factor.
      
      Respond in JSON format according to this structure:
      {
        "summary": "High-level neutral observation about the process.",
        "signals": [
          { "label": "Drafting Timeline", "value": "e.g., Produced in 9m", "status": "neutral|caution|positive" },
          { "label": "Paste Activity", "value": "e.g., 1,200 char paste detected", "status": "neutral|caution|positive" },
          { "label": "Revision Depth", "value": "e.g., Minimal structural changes", "status": "neutral|caution|positive" }
        ],
        "contextualNotes": "Neutral observations about AI triggers or external factors.",
        "instructionalGuidance": "Advice for the teacher on how to proceed (e.g., ask for revision, discuss process)."
      }
      
      FRAME YOUR RESPONSE NEUTRALLY. DO NOT USE WORDS LIKE 'CHEATING', 'PLAGIARISM', OR 'AI-GENERATED'. 
      Focus on 'Writing Process Integrity Review'.
    `;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });
    
    const text = response.text;
    const reviewData = JSON.parse(text);

    res.json({
      ...reviewData,
      timestamp: Date.now()
    });
  } catch (error: any) {
    console.error("Integrity Review error:", error);
    res.status(500).json({ error: error.message || "Failed to generate integrity review" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
