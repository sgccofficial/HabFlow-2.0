import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

declare const __FIREBASE_CONFIG__: any;
const firebaseConfig = __FIREBASE_CONFIG__;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');


// Use local persistence for auth
setPersistence(auth, browserLocalPersistence);

export { app, auth, db };
