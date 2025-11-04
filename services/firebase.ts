import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Use the provided Firebase project configuration.
const firebaseConfig = {
    apiKey: "AIzaSyD2f5HOtfPSDYvadGYs42MPB7uedOSzO44",
    authDomain: "painel-dss.firebaseapp.com",
    projectId: "painel-dss",
    storageBucket: "painel-dss.firebasestorage.app",
    messagingSenderId: "977573548445",
    appId: "1:977573548445:web:d5bb8832dd6618bc801f74"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth, app };
