import React, { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
// Assuming your path aliases are set up in tsconfig.json
import { auth, db } from '../lib/firebase';
import { AuthContext, type AuthContextType } from '../context/auth-context';
import { Permissions } from '../enums';
import type { User } from '../Role/permission';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  // This state holds your custom User object, which includes the 'role'
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // This state holds the permissions array fetched from Firestore
  const [userPermissions, setUserPermissions] = useState<Permissions[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // 1. Fetch the user's role from the 'users' collection
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          // Create our custom user object that matches the 'User' interface
          const appUser: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'No Name',
            role: userData.role,
            permissions: [], // This will be populated by the next step
          };
          setCurrentUser(appUser);

          // 2. Fetch the permissions for that role
          if (userData.role) {
            const permissionDocRef = doc(db, 'permissions', userData.role);
            const permissionDoc = await getDoc(permissionDocRef);
            if (permissionDoc.exists()) {
              setUserPermissions(permissionDoc.data().allowedPermissions);
            }
          }
        } else {
          // If no user document, treat as logged out
          setCurrentUser(null);
          setUserPermissions([]);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
        setUserPermissions([]);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 3. Implement the real 'hasPermission' function
  const hasPermission = (permissionToCheck: Permissions): boolean => {
    // Check if the permission exists in the user's fetched permissions array
    return userPermissions.includes(permissionToCheck);
  };

  // 4. Create the value object that now correctly matches the AuthContextType
  const value = {
    currentUser,
    loading,
    hasPermission,
  } as unknown as AuthContextType;

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};