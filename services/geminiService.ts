
import { WritingMode, MentorPersonality } from "../types";
import { db, auth } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

// POST JSON to our server with the signed-in user's Firebase ID token.
export const authedFetch = async (url: string, body: unknown): Promise<Response> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(body)
  });
};

const logUsage = async (userId: string, model: string, tokens: number, feature: string) => {
  try {
    await addDoc(collection(db, "ai_logs"), {
      userId,
      model,
      totalTokens: tokens,
      timestamp: Date.now(),
      feature
    });
  } catch (err) {
    console.error("Failed to log usage:", err);
  }
};

export const getTutorFeedback = async (
  content: string, 
  context: string = "", 
  userQuestion: string = "", 
  mode: WritingMode = WritingMode.ACADEMIC,
  personality: MentorPersonality = MentorPersonality.OXFORD_DON,
  userId: string = "unknown-user"
): Promise<any> => {
  try {
    const response = await authedFetch("/api/gemini/feedback", { content, context, userQuestion, mode, personality });

    if (!response.ok) throw new Error("Feedback API failed");
    const data = await response.json();
    
    // Usage logging - in full stack apps, it's often better to log on the server,
    // but keeping it here for now to match exactly what existed before.
    logUsage(userId, 'gemini-3-flash-preview', 1000, userQuestion ? 'tutor-q&a' : 'tutor-feedback');

    return data;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      feedback: "The connection to my intellectual repository is momentarily severed. Please continue your drafting.",
      focusArea: "Logic & Argument"
    };
  }
};

export const generateQuiz = async (content: string, focusArea: string, userId: string = "unknown-user"): Promise<any> => {
  try {
    const response = await authedFetch("/api/gemini/quiz", { content, focusArea });

    if (!response.ok) throw new Error("Quiz API failed");
    const data = await response.json();

    logUsage(userId, 'gemini-3-flash-preview', 500, 'quiz-generation');

    return data;
  } catch (error) {
    console.error("Quiz generation failed:", error);
    return null;
  }
};

export const summarizeSubmissionForTeacher = async (submission: string, mode: WritingMode = WritingMode.ACADEMIC, userId: string = "unknown-user"): Promise<string> => {
  try {
    const response = await authedFetch("/api/gemini/summary", { submission, mode });

    if (!response.ok) throw new Error("Summary API failed");
    const data = await response.json();

    logUsage(userId, 'gemini-3-flash-preview', 200, 'teacher-summary');

    return data.text || "Evaluation unavailable.";
  } catch (err) {
    return "Evaluation failed.";
  }
};

export const estimateWritingProficiency = async (submission: string, mode: WritingMode = WritingMode.ACADEMIC, userId: string = "unknown-user"): Promise<any> => {
  try {
    const response = await authedFetch("/api/gemini/proficiency", { submission, mode });

    if (!response.ok) throw new Error("Proficiency API failed");
    const data = await response.json();

    logUsage(userId, 'gemini-3-flash-preview', 800, 'proficiency-estimation');

    return data;
  } catch (err) {
    console.error("Proficiency estimation failed:", err);
    return null;
  }
};
