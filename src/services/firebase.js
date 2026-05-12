// Firebase Service — handles auth, contacts, reports, trips
import { firebaseConfig, FIREBASE_ENABLED } from '../config.js';

let app, auth, db;
let recaptchaVerifier = null;

export async function initFirebase() {
  if (!FIREBASE_ENABLED) {
    console.log('Firebase disabled — using localStorage.');
    return false;
  }
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, onAuthStateChanged, RecaptchaVerifier } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Setup invisible Recaptcha for Phone Auth
    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      'size': 'invisible'
    });

    return new Promise((resolve) => {
      onAuthStateChanged(auth, (user) => {
        resolve(user);
      });
    });
  } catch (e) {
    console.warn('Firebase init failed:', e);
    return false;
  }
}

export async function loginWithEmail(email, password) {
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signupWithEmail(email, password) {
  const { createUserWithEmailAndPassword } = await import('firebase/auth');
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function sendPhoneOTP(phoneNumber) {
  const { signInWithPhoneNumber } = await import('firebase/auth');
  return signInWithPhoneNumber(auth, phoneNumber, window.recaptchaVerifier);
}

export async function logout() {
  const { signOut } = await import('firebase/auth');
  return signOut(auth);
}

export async function saveToFirestore(collectionName, data) {
  if (!db || !auth.currentUser) return null;
  try {
    const { addDoc, collection: col } = await import('firebase/firestore');
    // Security: Soft deletes & audit fields added here
    const enrichedData = {
      ...data,
      uid: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null // Explicitly null for soft-delete logic
    };
    return await addDoc(col(db, collectionName), enrichedData);
  } catch (e) { console.warn('Firestore save failed:', e); return null; }
}

export async function getFromFirestore(collectionName) {
  if (!db || !auth.currentUser) return [];
  try {
    const { collection: col, query, where, getDocs } = await import('firebase/firestore');
    // Only fetch non-deleted items owned by this user
    const q = query(
      col(db, collectionName), 
      where('uid', '==', auth.currentUser.uid),
      where('deletedAt', '==', null)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('Firestore read failed:', e); return []; }
}

export async function softDeleteDocument(collectionName, docId) {
  if (!db) return false;
  try {
    const { doc, updateDoc } = await import('firebase/firestore');
    await updateDoc(doc(db, collectionName, docId), {
      deletedAt: new Date().toISOString()
    });
    return true;
  } catch (e) { console.warn('Soft delete failed:', e); return false; }
}

export function getAuth() { return auth; }
export function getDb() { return db; }
