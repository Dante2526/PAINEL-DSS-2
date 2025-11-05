import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// =======================================================================================
// ! ! ! PRODUCTION CONFIGURATION FOR VERCEL ! ! !
// =======================================================================================
// This configuration reads credentials directly from environment variables using `import.meta.env`.
// This is the correct setup for a Vite project deployed on Vercel.
//
// CRITICAL DEPLOYMENT INSTRUCTIONS:
// 1. Set the Environment Variables in your Vercel project settings.
// 2. Use the exact names below for the keys (e.g., VITE_FIREBASE_API_KEY).
// 3. In Vercel, go to Project Settings -> General -> Framework Preset and set it to "Vite".
//    This is required for Vercel to correctly inject `VITE_` variables into your site.
// 4. You MUST redeploy your project after changing variables or the framework preset.
// =======================================================================================

// Using `(import.meta as any).env` to access Vite environment variables.
// This is the correct method for a Vite build environment like Vercel.
// `process.env` will not work here for client-side code.
const env = (import.meta as any).env || {};

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase services
let db: Firestore | null = null;
let auth: Auth | null = null;
let app: FirebaseApp | null = null;

// Check if the API key is present. It will be a string on Vercel, but undefined in the preview environment.
const isConfigured = !!firebaseConfig.apiKey;

if (isConfigured) {
    try {
        // Use modular SDK initialization and prevent re-initialization on hot reloads.
        if (getApps().length === 0) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp(); // Get the default app
        }
        db = getFirestore(app);
        auth = getAuth(app);
    } catch(e) {
        console.error("Error initializing Firebase. Please check your environment variables and Vercel project settings.", e);
        // Ensure services are null if initialization fails
        db = null;
        auth = null;
        app = null;
    }
} else {
    // This warning will appear in the developer console in the preview environment where
    // environment variables are not available. The main App.tsx component will show a user-facing notification.
    console.warn("Firebase environment variables not found. The app is in preview mode.");
}

export { db, auth, app, isConfigured };