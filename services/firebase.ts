import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};
const fConfig = firebaseConfig as any;

const config = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || fConfig.apiKey || "AIzaSyMockKeyForAppletInitializeOnly_",
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || fConfig.authDomain || "mock-project.firebaseapp.com",
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || fConfig.projectId || "mock-project",
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || fConfig.storageBucket || "mock-project.appspot.com",
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || fConfig.messagingSenderId || "1234567890",
  appId: metaEnv.VITE_FIREBASE_APP_ID || fConfig.appId || "1:1234567890:web:abcdef1234567890",
  firestoreDatabaseId: metaEnv.VITE_FIREBASE_DATABASE_ID || fConfig.firestoreDatabaseId || "(default)",
};

const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Check if the current configuration is a sandbox/mock config to avoid noisy console errors in test settings
const isMockConfig = !metaEnv.VITE_FIREBASE_API_KEY && (!fConfig.apiKey || fConfig.apiKey.includes("MockKey") || fConfig.apiKey === "");

// Connection test
async function testConnection() {
  if (isMockConfig) {
    console.log("Firebase is initialized in sandbox/mock mode.");
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      // Just log locally, don't throw to avoid UI crashes if unhandled
      console.log("Sign-in popup closed by user.");
      return null;
    }
    console.error("Auth Error:", error);
    throw error;
  }
};
