import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDbeWfOgItY5NU5VgX4V8kxrZ59qx2nur0",
  authDomain: "quest-generator-cc833.firebaseapp.com",
  projectId: "quest-generator-cc833",
  storageBucket: "quest-generator-cc833.firebasestorage.app",
  messagingSenderId: "870292365148",
  appId: "1:870292365148:web:3bc9cdfa88e199f4462b99",
  measurementId: "G-2KRD7GKCP3"
};

// Initialize Firebase main app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize a secondary app strictly for Admin creating user profiles without logging the Admin out
export const secondaryApp = !getApps().some(a => a.name === "Secondary") 
  ? initializeApp(firebaseConfig, "Secondary") 
  : getApp("Secondary");
export const secondaryAuth = getAuth(secondaryApp);
