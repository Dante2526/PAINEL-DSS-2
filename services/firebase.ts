// FIX: Changed from a namespace import (`import * as firebaseApp`) to named imports.
// The modular Firebase SDK exports functions like `initializeApp` directly, not as properties of a namespace object.
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

// Firebase configuration is loaded from environment variables provided by the build tool (e.g., Vite).
// These variables should be prefixed with VITE_ and are set in your hosting provider's (e.g., Vercel) settings.
// FIX: Cast import.meta to any to resolve TypeScript error about 'env' property. This is a workaround because a vite-env.d.ts file cannot be added to declare the types for import.meta.env.
const env = (import.meta as any).env;

// FIX: Use optional chaining (?.) to prevent a crash if `env` is undefined.
// This can happen if the build environment (like Vercel) is misconfigured or fails to inject the variables.
// This allows the app to fall back to the existing "preview mode" gracefully.
const firebaseConfig = {
    apiKey: env?.VITE_FIREBASE_API_KEY,
    authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env?.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env?.VITE_FIREBASE_APP_ID
};

// Initialize Firebase services
let db: Firestore | null = null;
let auth: Auth | null = null;
// FIX: Used the imported `FirebaseApp` type directly, instead of from a namespace. This resolves the error on line 26.
let app: FirebaseApp | null = null;

// Check if the API key is present. The app will enter a "preview mode" if it's missing.
const isConfigured = !!firebaseConfig.apiKey;

if (isConfigured) {
    try {
        // Use modular SDK initialization and prevent re-initialization on hot reloads.
        // FIX: Called `getApps` directly as a named import. This resolves the error on line 34.
        if (getApps().length === 0) {
            // FIX: Called `initializeApp` directly as a named import. This resolves the error on line 35.
            app = initializeApp(firebaseConfig);
        } else {
            // FIX: Called `getApp` directly as a named import. This resolves the error on line 37.
            app = getApp(); // Get the default app
        }
        db = getFirestore(app);
        auth = getAuth(app);
    } catch(e) {
        console.error("Error initializing Firebase. Please check your environment variables.", e);
        // Ensure services are null if initialization fails
        db = null;
        auth = null;
        app = null;
    }
} else {
    // This warning will appear in the developer console if the API key is missing.
    // The main App.tsx component will show a user-facing notification.
    console.warn("Firebase API key is missing. Please check your VITE_FIREBASE_API_KEY environment variable. The app is in preview mode.");
}

export { db, auth, app, isConfigured };