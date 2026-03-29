import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: "***REMOVED***",
  authDomain: "***REMOVED***",
  projectId: "barakat-al-thimar-pro",
  storageBucket: "***REMOVED***",
  messagingSenderId: "***REMOVED***",
  appId: "1:***REMOVED***:web:082d02db46915b683a18c5"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
