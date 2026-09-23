import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  signInWithCredential, 
  GoogleAuthProvider, 
  signOut, 
  getAdditionalUserInfo,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import firebaseConfig from '../../firebase-applet-config.json';

interface FirebaseContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  isAdmin: boolean;
  login: (role: 'player' | 'publisher') => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Set persistence for Capacitor
    const persistence = Capacitor.isNativePlatform() ? indexedDBLocalPersistence : browserLocalPersistence;
    setPersistence(auth, persistence).catch(err => console.error('Persistence error:', err));

    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize({
        clientId: '1056646427549-alg436s1bgkjagkpelpmsqc2l2upgq31.apps.googleusercontent.com',
        scopes: ['profile', 'email'],
      }).catch(err => console.warn('GoogleAuth init error:', err));
    }

    let userUnsubscribe: (() => void) | null = null;
    let adminUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }
      if (adminUnsubscribe) {
        adminUnsubscribe();
        adminUnsubscribe = null;
      }

      if (user) {
        userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (snap) => {
          if (snap.exists()) {
            setUserData(snap.data());
          } else {
            setUserData(null);
          }
          setLoading(false);
        }, (err) => {
          console.error('User data listener error:', err);
          setLoading(false);
        });

        if (user.email === 'sperkplay@gmail.com') {
          setIsAdmin(true);
        } else {
          adminUnsubscribe = onSnapshot(doc(db, 'admins', user.uid), (doc) => {
            setIsAdmin(doc.exists());
          }, (err) => {
            console.warn('Admin check listener error:', err);
          });
        }
      } else {
        setUserData(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
      if (adminUnsubscribe) adminUnsubscribe();
    };
  }, []);

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const login = async (role: 'player' | 'publisher') => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);

    try {
      let result;

      if (Capacitor.isNativePlatform()) {
        console.log('Starting native Google Sign-In...');
        const googleUser = await GoogleAuth.signIn();
        
        if (!googleUser.authentication?.idToken) {
          throw new Error('No ID Token received from Google. Please ensure your SHA-1 fingerprint is added to Firebase Console.');
        }

        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        result = await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        result = await signInWithPopup(auth, provider);
      }

      const user = result.user;
      const additionalInfo = getAdditionalUserInfo(result);
      
      if (additionalInfo?.isNewUser) {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          email: user.email,
          gameName: user.displayName || 'LEGEND',
          ovr: '60',
          role: role,
          photoURL: user.photoURL,
          createdAt: serverTimestamp()
        });
      }
    } catch (error: any) {
      console.error('Login error details:', error);
      
      if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user' || error?.message?.includes('CANCELED') || error?.code === '12501') {
        // User cancelled, no alert needed
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('Domain Error: Please add "localhost" to Firebase Console -> Auth -> Settings -> Authorized Domains.');
      } else {
        const errorMessage = error.message || JSON.stringify(error);
        alert(`Login failed: ${errorMessage}. 
        
Note: If you are using the APK, ensure your SHA-1 certificate fingerprint is registered in Firebase Console.`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleAuth.signOut().catch(() => {});
      }
    } catch (err) {
      console.warn('GoogleAuth signOut error:', err);
    }
    await signOut(auth);
  };

  return (
    <FirebaseContext.Provider value={{ user, userData, loading, isAdmin, login, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
}




