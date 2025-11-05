import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const envApiKey = process.env.VITE_FIREBASE_API_KEY;

// The isConfigured flag prevents the app from trying to authenticate when Vercel env vars are not available.
export const isConfigured = !!envApiKey;

const firebaseConfig = {
    apiKey: envApiKey || "AIzaSy_InvalidForPreview", // Use placeholder if env var is missing
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "project-id.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "project-id",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "project-id.appspot.com",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
    appId: process.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:invalid"
};

// Initialize Firebase
let db: Firestore | null = null;
let auth: Auth | null = null;
let app: FirebaseApp | null = null;

try {
    if (getApps().length === 0) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApp();
    }
    db = getFirestore(app);
    auth = getAuth(app);
} catch(e) {
    console.error("Error initializing Firebase:", e);
    db = null;
    auth = null;
    app = null;
}

export { db, auth, app };