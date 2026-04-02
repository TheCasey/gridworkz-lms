import { app } from '../firebase/firebaseConfig';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const testFirebaseConnection = async () => {
  try {
    console.log('Testing Firebase connection...');
    console.log('App initialized:', app);
    
    const db = getFirestore(app);
    console.log('Firestore initialized:', db);
    
    // Test write operation
    const testDoc = {
      test: true,
      timestamp: serverTimestamp(),
      created_at: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(db, 'test'), testDoc);
    console.log('Test document written:', docRef.id);
    
    return { success: true, docId: docRef.id };
  } catch (error) {
    console.error('Firebase test failed:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    return { success: false, error: error.message };
  }
};

export const checkEnvironment = () => {
  console.log('Environment check:');
  console.log('VITE_FIREBASE_API_KEY:', import.meta.env.VITE_FIREBASE_API_KEY ? '✓ Set' : '✗ Missing');
  console.log('VITE_FIREBASE_PROJECT_ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✓ Set' : '✗ Missing');
  console.log('VITE_FIREBASE_AUTH_DOMAIN:', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? '✓ Set' : '✗ Missing');
};
