import { db, auth } from './firebase';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, query, where, addDoc } from 'firebase/firestore';
import { calculateStreak } from './utils';

// Helper for error logging
const handleFirestoreError = (error: any, opType: string, path: string) => {
  console.error(`Firestore Error [${opType}] on ${path}:`, error);
  throw error;
};

// Generate a random 6-character code
export const generateFriendCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const initializeUserProfile = async (user: any) => {
  if (!user) return null;
  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        displayName: user.displayName || 'User',
        email: user.email || '',
        photoURL: user.photoURL || '',
        friendCode: generateFriendCode(),
        friends: [],
        friendRequests: []
      });
    }
    return snap.exists() ? snap.data() : (await getDoc(userRef)).data();
  } catch (error) {
    handleFirestoreError(error, 'get/set', `users/${user.uid}`);
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

// Returns user data for a given friend code
export const findUserByFriendCode = async (code: string) => {
  try {
    const q = query(collection(db, 'users'), where('friendCode', '==', code.toUpperCase()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// Send Friend Request
export const sendFriendRequest = async (targetUid: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || currentUid === targetUid) return;
  try {
    const targetRef = doc(db, 'users', targetUid);
    await updateDoc(targetRef, {
      friendRequests: arrayUnion(currentUid)
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `users/${targetUid}`);
  }
};

// Accept Friend Request
export const acceptFriendRequest = async (targetUid: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return;
  try {
    // Add to each other's friends list
    await updateDoc(doc(db, 'users', currentUid), {
      friends: arrayUnion(targetUid),
      friendRequests: arrayRemove(targetUid)
    });
    await updateDoc(doc(db, 'users', targetUid), {
      friends: arrayUnion(currentUid)
    });
  } catch (error) {
    handleFirestoreError(error, 'update', `users/${currentUid}`);
  }
};

// Create a group
export const createGroup = async (name: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return;
  try {
    await addDoc(collection(db, 'groups'), {
      name,
      owner: currentUid,
      members: [currentUid]
    });
  } catch (error) {
    handleFirestoreError(error, 'create', 'groups');
  }
};

// Join a group (needs a way to add members, usually owner adds them or invites)
// For simplicity, we just add friend to group if owner
export const addFriendToGroup = async (groupId: string, friendUid: string) => {
  try {
    await updateDoc(doc(db, 'groups', groupId), {
      members: arrayUnion(friendUid)
    });
  } catch (e) {
    console.error(e);
  }
};

// Fetch Groups where user is member
export const getUserGroups = async () => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return [];
  try {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', currentUid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (e) {
    console.error(e);
    return [];
  }
};

// Sync habit to shared_habits
export const syncSharedHabit = async (habit: any) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid || !habit.visibility || habit.visibility === 'private') {
    if (currentUid && habit.visibility === 'private') {
       try { await updateDoc(doc(db, 'shared_habits', habit.id), { visibility: 'private' }) } catch(e){}
    }
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayProgress = habit.progress?.[today] || 0;
    const streak = calculateStreak(habit);
    
    await setDoc(doc(db, 'shared_habits', habit.id), {
      uid: currentUid,
      name: habit.name,
      color: habit.color,
      icon: habit.icon,
      streak: streak,
      todayProgress,
      dailyTarget: habit.dailyCompletions || habit.goalValue || 1,
      visibility: habit.visibility,
      sharedWithIds: habit.sharedWithIds || [],
      lastUpdated: Date.now()
    }, { merge: true });
  } catch (e) {
    console.error('Failed to sync shared habit', e);
  }
};

// Get shared habits from friends or groups
export const getSharedHabits = async () => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return [];
  try {
    // Note: To query this securely, the user must have read access according to rules.
    // The rules allow if visibility == 'friends' etc. But querying all might fail if we don't have indexes.
    // Since this is a simple demo, we will query all and let the rules filter it. Wait, Firestore will fail the query if it doesn't match rules EXACTLY.
    // So we fetch habits for specific UIDs we know are friends.
    
    // 1. Get our friends
    const userProfile = await getUserProfile(currentUid);
    const friends = userProfile?.friends || [];
    
    let allShared: any[] = [];
    
    // Fetch for each friend
    // (In a real app, use `in` queries for chunks of 10)
    for (const friendUid of friends) {
      const q = query(collection(db, 'shared_habits'), where('uid', '==', friendUid));
      const snap = await getDocs(q);
      snap.forEach(d => allShared.push({ id: d.id, ...d.data() }));
    }
    
    return allShared;
  } catch (e) {
    console.error(e);
    return [];
  }
};
