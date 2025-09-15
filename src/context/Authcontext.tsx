import React, { useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AuthContext, type AuthContextType } from './auth-context';
import { Permissions } from '../enums';
import type { User } from '../Role/permission';
import Loading from '../Pages/Loading/Loading'; // Import your loading component

interface AuthState {
  status: 'pending' | 'authenticated' | 'unauthenticated';
  user: User | null;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use a single state object to manage the entire authentication flow
  const [authState, setAuthState] = useState<AuthState>({
    status: 'pending',
    user: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            let permissions: Permissions[] = [];

            if (userData.role) {
              const permissionDocRef = doc(db, 'permissions', userData.role);
              const permissionDoc = await getDoc(permissionDocRef);
              if (permissionDoc.exists()) {
                permissions = permissionDoc.data().allowedPermissions || [];
              }
            }

            const appUser: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || userData.name || 'Anonymous',
              role: userData.role,
              permissions: permissions,
            };
            // Make a single, atomic state update for an authenticated user.
            setAuthState({ status: 'authenticated', user: appUser });
          } else {
            // User exists in Auth, but not in our database. Treat as unauthenticated.
            setAuthState({ status: 'unauthenticated', user: null });
          }
        } else {
          // No user is signed in. Treat as unauthenticated.
          setAuthState({ status: 'unauthenticated', user: null });
        }
      } catch (error) {
        console.error("Error during authentication check:", error);
        // On any error, treat as unauthenticated.
        setAuthState({ status: 'unauthenticated', user: null });
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // The context value is now derived from the single source of truth: authState.
  const value: AuthContextType = {
    currentUser: authState.user,
    loading: authState.status === 'pending',
    hasPermission: (permission: Permissions) => authState.user?.permissions?.includes(permission) ?? false,
  };

  // The "gate" now checks the 'pending' status. The router and the rest of the app
  // will not be rendered until this status changes.
  if (authState.status === 'pending') {
    return <Loading />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
