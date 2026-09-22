import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, getAdditionalUserInfo } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';

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
    // Handle redirect sign-in result (especially for mobile Capacitor apps)
    getRedirectResult(auth).then(async (result) => {
      if (result) {
        const user = result.user;
        const additionalInfo = getAdditionalUserInfo(result);
        if (additionalInfo?.isNewUser) {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            email: user.email,
            gameName: user.displayName || 'LEGEND',
            ovr: '60',
            role: 'player',
            photoURL: user.photoURL,
            createdAt: serverTimestamp()
          });
        }
      }
    }).catch((error) => {
      console.error('Redirect sign in error:', error);
    });

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
            setLoading(false);
          } else {
            setUserData(null);
            setLoading(false);
          }
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

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      if (Capacitor.isNativePlatform()) {
        // On Native mobile apps, use redirect flow which handles authorized domains cleanly
        await signInWithRedirect(auth, provider);
      } else {
        try {
          const result = await signInWithPopup(auth, provider);
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
        } catch (popupError: any) {
          if (popupError.code === 'auth/unauthorized-domain' || popupError.code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, provider);
          } else {
            throw popupError;
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'auth/cancelled-popup-request') {
        console.warn('Login request was cancelled by a newer request.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed', error);
        if (error.code === 'auth/unauthorized-domain') {
          alert('Login Error: Domain not authorized. Please ensure "localhost" is added to Firebase Console -> Authentication -> Settings -> Authorized Domains.');
        } else {
          alert(`Login failed: ${error.message}`);
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
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

