import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { getFirestore } from "firebase-admin/firestore";

// Load a local .env file when running on your own computer (does not override variables
// that are already set, e.g. by AI Studio or Cloud Run).
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath) && typeof (process as any).loadEnvFile === "function") {
  (process as any).loadEnvFile(envPath);
}

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "1mb" }));

// Initialize Firebase Admin
let adminDb: admin.firestore.Firestore;
let adminAuth: admin.auth.Auth;

try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let databaseId = process.env.FIREBASE_DATABASE_ID;

  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    projectId = projectId || firebaseConfig.projectId;
    databaseId = databaseId || firebaseConfig.firestoreDatabaseId;
  }

  // Credentials: FIREBASE_SERVICE_ACCOUNT (the service account JSON on one line) if set;
  // otherwise Google Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS = path
  // to the key file on your computer, or the built-in service account on Cloud Run).
  let credential: admin.credential.Credential | undefined;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    credential = admin.credential.cert(serviceAccount);
    projectId = projectId || serviceAccount.project_id;
  }

  if (projectId) {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: projectId,
        ...(credential ? { credential } : {}),
      });
    }
    // Use the same Firestore database as the browser app (it may be a named database).
    adminDb = databaseId && databaseId !== "(default)"
      ? getFirestore(admin.app(), databaseId)
      : getFirestore(admin.app());
    adminAuth = admin.auth();
  } else {
    console.warn("No Firebase configuration found via firebase-applet-config.json or FIREBASE_PROJECT_ID env variable");
  }
} catch (error) {
  console.error("Firebase Admin initialization error:", error);
}

// Verifies "Authorization: Bearer <Firebase ID token>" and puts the decoded token on req.user.
const requireAuth = async (req: any, res: any, next: any) => {
  if (!adminAuth) {
    return res.status(503).json({ error: "Server is not configured for sign-in checks." });
  }
  const authHeader = req.headers.authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    req.user = await adminAuth.verifyIdToken(authHeader.slice("Bearer ".length).trim());
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

// Simple in-memory rate limiter (per signed-in user). Use after requireAuth.
// Counts reset when the server restarts and are kept per server instance.
const rateBuckets = new Map<string, number[]>();
function rateLimit(name: string, maxRequests: number, windowMs: number) {
  return (req: any, res: any, next: any) => {
    const key = `${name}:${req.user?.uid || req.ip}`;
    const now = Date.now();
    const recent = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (recent.length >= maxRequests) {
      rateBuckets.set(key, recent);
      return res.status(429).json({ error: "Too many requests. Please wait a few minutes and try again." });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}
// Periodically forget old entries so memory does not grow.
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [key, times] of rateBuckets) {
    if (!times.some((t) => t > cutoff)) rateBuckets.delete(key);
  }
}, 10 * 60 * 1000).unref();

const AI_RATE_LIMIT = parseInt(process.env.AI_RATE_LIMIT_PER_10_MIN || "30", 10) || 30;
const aiRateLimit = rateLimit("ai", AI_RATE_LIMIT, 10 * 60 * 1000);

// Middleware to verify Admin
const authenticateAdmin = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!adminAuth || !adminDb) {
    return res.status(503).json({ error: "Server is not configured for sign-in checks." });
  }
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

app.post("/api/gemini/feedback", requireAuth, aiRateLimit, async (req, res) => {
  const { content, context, userQuestion, mode, personality } = req.body;
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
    console.error("Feedback error:", error?.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/api/gemini/quiz", requireAuth, aiRateLimit, async (req, res) => {
  const { content, focusArea } = req.body;
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
    
    Snippet: ${String(content || "").substring(0, 1000)}`;

    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error: any) {
    console.error("AI route error:", error?.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/api/gemini/summary", requireAuth, aiRateLimit, async (req, res) => {
  const { submission, mode } = req.body;
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
    console.error("AI route error:", error?.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

app.post("/api/gemini/proficiency", requireAuth, aiRateLimit, async (req, res) => {
  const { submission, mode } = req.body;
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
    console.error("AI route error:", error?.message);
    res.status(500).json({ error: "AI request failed" });
  }
});

// Title of a stored submission (submissions keep the title as a 'title' paragraph).
const submissionTitle = (data: any) =>
  data?.document?.paragraphs?.find((p: any) => p?.kind === "title")?.text || data?.title || "Untitled";

app.post("/api/integrity-review", requireAuth, aiRateLimit, async (req: any, res) => {
  // The browser sends only the submission id; everything else is loaded from Firestore here.
  const submissionId = req.body?.submissionId;
  if (typeof submissionId !== "string" || !submissionId || submissionId.length > 128 || submissionId.includes("/")) {
    return res.status(400).json({ error: "submissionId is required" });
  }

  try {
    const submissionSnap = await adminDb.collection("submissions").doc(submissionId).get();
    if (!submissionSnap.exists) {
      return res.status(404).json({ error: "Submission not found" });
    }
    const submission: any = submissionSnap.data();

    // Only the teacher of the submission's class, or a platform admin, may run a review.
    let isClassTeacher = false;
    if (typeof submission.classId === "string" && submission.classId && !submission.classId.includes("/")) {
      const classSnap = await adminDb.collection("classes").doc(submission.classId).get();
      isClassTeacher = classSnap.exists && classSnap.data()?.teacherId === req.user.uid;
    }
    let isPlatformAdmin = false;
    if (!isClassTeacher) {
      const callerSnap = await adminDb.collection("users").doc(req.user.uid).get();
      isPlatformAdmin = callerSnap.exists && callerSnap.data()?.role === "ADMIN";
    }
    if (!isClassTeacher && !isPlatformAdmin) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Up to 5 earlier submissions by the same student, newest first (sorted here so no
    // extra Firestore index is needed).
    const historySnap = await adminDb.collection("submissions")
      .where("studentId", "==", submission.studentId)
      .get();
    const historicalSubmissions = historySnap.docs
      .filter((d) => d.id !== submissionId && (d.data().timestamp || 0) < (submission.timestamp || 0))
      .sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0))
      .slice(0, 5)
      .map((d) => {
        const h = d.data();
        return { title: submissionTitle(h), mode: h.mode, timestamp: h.timestamp, integrity: h.integrity, document: h.document };
      });

    const ai = getAi();
    const prompt = `
      You are an expert writing process analyst assisting educators in understanding how a piece of writing was developed. Analyze the following writing process data for a student submission.
      
      SUBMISSION DATA:
      Title: ${submissionTitle(submission)}
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
    console.error("Integrity Review error:", error?.message);
    res.status(500).json({ error: "Failed to generate integrity review" });
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
