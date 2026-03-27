import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { AuthContext } from './AuthContextObject';

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null); // Firestore user doc
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Fetch user data from Firestore using their email OR uid
        // In the images, standard Firestore IDs were used. Let's lookup by id=uid, or if not found log out?
        // We'll search by doc(db, "users", user.uid) assuming we created them securely, otherwise just by doc ID.
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          } else {
            // Fallback: If no document found, you can sign them out or create a shell. Allow empty for testing:
            // signOut(auth);
            setUserData({ role: 'user', Name: 'Unknown User' }); 
          }
        } catch {
          setUserData({
            role: user.email === 'admin@gmail.com' ? 'admin' : 'user',
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
    isAdmin: userData?.role === 'admin' || (currentUser?.email === 'admin@gmail.com'), // Replace with actual admin assignment
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
