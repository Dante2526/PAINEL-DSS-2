import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';


// =======================================================================================
// ! ! ! IMPORTANT CONFIGURATION NOTICE ! ! !
// =======================================================================================
// This file is configured to use environment variables for Firebase credentials.
// This is the secure, recommended method for production environments like Vercel or Netlify.
//
// To run this application, ensure you have set the following environment variables
// in your hosting provider's settings (e.g., Vercel Project Settings -> Environment Variables):
//
// - VITE_FIREBASE_API_KEY
// - VITE_FIREBASE_AUTH_DOMAIN
// - VITE_PROJECT_ID
// - VITE_STORAGE_BUCKET
// - VITE_MESSAGING_SENDER_ID
// - VITE_APP_ID
//
// The application will not connect to Firebase if these variables are not set.
// =======================================================================================

/*
// --- DEVELOPMENT CONFIGURATION (For local environments without .env support) ---
// If you need to test in an environment that does not support `import.meta.env`,
// you can temporarily uncomment this section and add your credentials.
// REMEMBER to switch back to the production configuration before committing your code.
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_AUTH_DOMAIN_HERE",
    projectId: "YOUR_PROJECT_ID_HERE",
    storageBucket: "YOUR_STORAGE_BUCKET_HERE",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID_HERE",
    appId: "YOUR_APP_ID_HERE"
};
*/

// --- PRODUCTION CONFIGURATION (Use for Vercel, Netlify, etc.) ---
// This configuration securely loads credentials from environment variables.
const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_PROJECT_ID,
    storageBucket: process.env.VITE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_APP_ID
};


// Initialize Firebase
let db: Firestore | null = null;
let auth: Auth | null = null;
let app: FirebaseApp | null = null;

// A simple check to see if the environment variables are loaded.
const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId;

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
    // This warning will appear in the developer console if credentials are not set in the environment.
    // The main App.tsx component will show a user-facing notification.
    console.warn("Firebase configuration is missing or incomplete. Please ensure your environment variables (VITE_FIREBASE_*) are set correctly in your hosting environment.");
}

export { db, auth, app };