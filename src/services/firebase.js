// Firebase Service — handles auth, contacts, reports, trips
import { firebaseConfig, FIREBASE_ENABLED } from '../config.js';

let app, auth, db;

export async function initFirebase() {
  if (!FIREBASE_ENABLED) {
    console.log('Firebase disabled — using localStorage. Set FIREBASE_ENABLED=true in config.js');
    return false;
  }
  try {
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const { getFirestore } = await import('firebase/firestore');
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    await signInAnonymously(auth);
    console.log('Firebase initialized, user:', auth.currentUser.uid);
    return true;
  } catch (e) {
    console.warn('Firebase init failed, falling back to localStorage:', e);
    return false;
  }
}

export async function saveToFirestore(collection, data) {
  if (!db) return null;
  try {
    const { addDoc, collection: col } = await import('firebase/firestore');
    return await addDoc(col(db, collection), { ...data, uid: auth.currentUser.uid, timestamp: Date.now() });
  } catch (e) { console.warn('Firestore save failed:', e); return null; }
}

export async function getFromFirestore(collectionName) {
  if (!db) return [];
  try {
    const { collection: col, query, where, getDocs } = await import('firebase/firestore');
    const q = query(col(db, collectionName), where('uid', '==', auth.currentUser.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.warn('Firestore read failed:', e); return []; }
}

export function getAuth() { return auth; }
export function getDb() { return db; }
