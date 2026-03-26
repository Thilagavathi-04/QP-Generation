import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    // TODO: Replace with your actual Firebase project configuration
    apiKey: "AIzaSyBmpdckyJ-iu8Es1QJLAPfex1vEfG26r_g",
    authDomain: "qp-generator-19c86.firebaseapp.com",
    projectId: "qp-generator-19c86",
    storageBucket: "qp-generator-19c86.firebasestorage.app",
    messagingSenderId: "224670346530",
    appId: "1:224670346530:web:c6adad124d406227bf097b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
