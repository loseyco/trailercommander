import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPGGHvDaZ3ymeQ0VE8EvMZLqD8cck48qI",
  authDomain: "gridpass.firebaseapp.com",
  databaseURL: "https://gridpass-default-rtdb.firebaseio.com",
  projectId: "gridpass",
  storageBucket: "gridpass.firebasestorage.app",
  messagingSenderId: "195906971027",
  appId: "1:195906971027:web:a191828f62c7b6098b3466",
  measurementId: "G-869L1CX0HW"
};

export const app = initializeApp(firebaseConfig);
export const analytics = getAnalytics(app);
export const db = getFirestore(app, "trailercommander");
