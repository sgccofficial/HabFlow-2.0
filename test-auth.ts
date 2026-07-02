import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./src/lib/firebase-config.json', 'utf8'));
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app, config.firestoreDatabaseId || '(default)');

async function run() {
  try {
    const username = 'testuser' + Date.now();
    const email = `${username}@habitflow.local`;
    
    console.log('1. Checking username...');
    const userDoc = await getDoc(doc(db, 'usernames', username));
    console.log('Username exists?', userDoc.exists());
    
    console.log('2. Creating account...');
    const cred = await createUserWithEmailAndPassword(auth, email, 'password123');
    console.log('Account created, uid:', cred.user.uid);
    
    console.log('3. Setting username doc...');
    await setDoc(doc(db, 'usernames', username), { uid: cred.user.uid });
    
    console.log('4. Setting user doc...');
    await setDoc(doc(db, 'users', cred.user.uid), {
      id: cred.user.uid,
      username,
      name: 'Test User',
      photoURL: ''
    });
    console.log('Done!');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
