import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

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
    let userUnsubscribe: any = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (userUnsubscribe) userUnsubscribe();

      if (user) {
        // Listen to user profile data in real-time
        userUnsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
          if (doc.exists()) {
            setUserData(doc.data());
          }
        });

        // Check if user is admin
        if (user.email === 'sperkplay@gmail.com') {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            setIsAdmin(adminDoc.exists());
          } catch (e) {
            console.error('Error checking admin status', e);
            setIsAdmin(false);
          }
        }
      } else {
        setUserData(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  const login = async (role: 'player' | 'publisher') => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
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
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error('Login failed', error);
      }
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
