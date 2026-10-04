import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBg8X5nruSDOHbirXjbFMqEQ2bSh9nr4qw",
    authDomain: "milano-anfoan-store-2026.firebaseapp.com",
    projectId: "milano-anfoan-store-2026",
    storageBucket: "milano-anfoan-store-2026.firebasestorage.app",
    messagingSenderId: "985548397783",
    appId: "1:985548397783:web:0027c0bc67b33574cba492",
    measurementId: "G-4424PVL8P5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { db, analytics, auth };
export default app;
