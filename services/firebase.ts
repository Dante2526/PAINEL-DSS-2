import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';


// =======================================================================================
// ! ! ! IMPORTANT CONFIGURATION NOTICE ! ! !
// =======================================================================================
// This file is configured for the AI Studio development environment.
// Because this environment does not support environment variables (`import.meta.env`),
// you must temporarily place your Firebase credentials below to run the app.
//
// THIS IS FOR DEVELOPMENT ONLY.
//
// BEFORE you deploy this code to a public repository (GitHub) or a hosting service (Vercel),
// you MUST replace this configuration with a secure method like environment variables
// to avoid exposing your secret keys.
// =======================================================================================

// --- DEVELOPMENT CONFIGURATION (Use for AI Studio Preview) ---
// Replace the placeholder strings with your actual Firebase project credentials.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE"
};

/*
// --- PRODUCTION CONFIGURATION (Use for Vercel, Netlify, etc.) ---
// When you are ready to deploy, comment out the development configuration above
// and uncomment this section. You will need to set up these environment variables
// in your hosting provider's project settings.
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID
};
*/

// Initialize Firebase
let db: Firestore | null = null;
let auth: Auth | null = null;
let app: FirebaseApp | null = null;

// A simple check to see if the placeholder values have been replaced.
const isConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

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
        console.error("Error initializing Firebase. Please check your credentials in services/firebase.ts.", e);
        // Ensure services are null if initialization fails
        db = null;
        auth = null;
        app = null;
    }
} else {
    // This warning will appear in the developer console if credentials are still placeholders.
    // The main App.tsx component will show a user-facing notification.
    console.warn("Firebase configuration is missing or incomplete. Please replace the placeholder values in services/firebase.ts.");
}

export { db, auth, app };