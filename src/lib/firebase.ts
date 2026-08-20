import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

import firebaseConfig from './firebase-config.json';

console.log("Firebase config loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
}, firebaseConfig.firestoreDatabaseId || '(default)');


// Use local persistence for auth
setPersistence(auth, browserLocalPersistence);

export { app, auth, db };
