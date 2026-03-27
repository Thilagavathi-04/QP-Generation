import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { AuthContext } from './AuthContextObject';

// Emails that should always have admin access, regardless of Firestore role
const SUPER_ADMIN_EMAILS = ['admin@gmail.com', 'uthilakz@gmail.com'];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Firestore user doc
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // If no document by UID, try looking up by email (for admins or legacy users)
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              setUserData(snapshot.docs[0].data());
            } else {
              // Final fallback – treat as normal faculty unless email is a configured super admin
              const isSuperAdmin = user.email && SUPER_ADMIN_EMAILS.includes(user.email);
              setUserData({
                role: isSuperAdmin ? 'admin' : 'user',
                Name: user.displayName || user.email || 'User',
                email: user.email || ''
              });
            }
          }
        } catch {
          const isSuperAdmin = user.email && SUPER_ADMIN_EMAILS.includes(user.email);
          setUserData({
            role: isSuperAdmin ? 'admin' : 'user',
            Name: user.displayName || user.email || 'User',
            email: user.email || ''
          });
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = () => {
    return signOut(auth);
  };

  const value = {
    user: currentUser,
    currentUser,
    userData,
    isAdmin:
      (userData && String(userData.role || '').toLowerCase() === 'admin') ||
      (currentUser?.email && SUPER_ADMIN_EMAILS.includes(currentUser.email)),
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
