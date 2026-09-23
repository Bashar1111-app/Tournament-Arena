import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithCredential, GoogleAuthProvider, signOut, getAdditionalUserInfo } from 'firebase/auth';
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
    if (Capacitor.isNativePlatform()) {
      GoogleAuth.initialize({
        clientId: firebaseConfig.oAuthClientId,
        scopes: ['profile', 'email'],
        grantOfflineAccess: true,
      }).catch(err => console.warn('GoogleAuth init error:', err));
    }

    let userUnsubscribe: (() => void) | null = null;
    let adminUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      
      // Clear previous listeners
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }
      if (adminUnsubscribe) {
        adminUnsubscribe();
        adminUnsubscribe = null;
      }

      if (user) {
        // 1. User Profile Listener
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

        // 2. Admin Status Listener
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
        try {
          const googleUser = await GoogleAuth.signIn();
          const idToken = googleUser.authentication.idToken;
          const credential = GoogleAuthProvider.credential(idToken);
          result = await signInWithCredential(auth, credential);
        } catch (nativeErr: any) {
          console.warn('Native GoogleAuth failed, falling back to popup:', nativeErr);
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });
          result = await signInWithPopup(auth, provider);
        }
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
      if (error.code === 'auth/cancelled-popup-request') {
        console.warn('Login request was cancelled by a newer request.');
      } else if (error.code === 'auth/popup-closed-by-user' || error?.message?.includes('CANCELED') || error?.code === '12501') {
        console.log('Login cancelled by user.');
      } else if (error.code === 'auth/unauthorized-domain') {
        alert('Login Error: Domain not authorized. Please make sure "localhost" is added to Firebase Console -> Authentication -> Settings -> Authorized Domains.');
      } else {
        console.error('Login failed', error);
        alert(`Login failed: ${error.message || error}`);
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



