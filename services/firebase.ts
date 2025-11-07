// FIX: The original combined import statement was causing module resolution errors.
// Separating the type import for `FirebaseApp` from the value imports (`initializeApp`, `getApps`, `getApp`) can resolve these issues in certain TypeScript configurations or environments by making the import intent clearer to the compiler.
// FIX: Switched to scoped firebase packages to resolve module import errors.
import { initializeApp, getApps, getApp } from '@firebase/app';
import type { FirebaseApp } from '@firebase/app';
import { getFirestore, Firestore } from '@firebase/firestore';
import { getAuth, Auth } from '@firebase/auth';

// Firebase configuration is loaded from environment variables provided by the build tool (e.g., Vite).
// These variables should be prefixed with VITE_ and are set in your hosting provider's (e.g., Vercel) settings.
const env = (import.meta as any).env;

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
let app: FirebaseApp | null = null;

// Check if the API key is present. The app will enter a "preview mode" if it's missing.
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