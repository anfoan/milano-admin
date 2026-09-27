import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBqLUrnZ3j9W_GZmWHZLHes2c1Wk1Ew6zg",
    authDomain: "milano-store-53d33.firebaseapp.com",
    projectId: "milano-store-53d33",
    storageBucket: "milano-store-53d33.firebasestorage.app",
    messagingSenderId: "949334690822",
    appId: "1:949334690822:web:fd3c16f99e9eb217d3c787",
    measurementId: "G-3M1DEM1LE0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { db, analytics, auth };
export default app;
