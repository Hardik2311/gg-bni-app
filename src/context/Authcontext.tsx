import React, { useEffect, useState, useMemo, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { AuthContext, DatabaseContext } from './auth-context';
import { Permissions } from '../enums';
import type { User } from '../Role/permission';
import Loading from '../Pages/Loading/Loading';
import { getFirestoreOperations } from '../lib/items_firebase';

interface AuthState {
  status: 'pending' | 'authenticated' | 'unauthenticated';
  user: User | null;
}

type DbOperationsType = ReturnType<typeof getFirestoreOperations> | null;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    status: 'pending',
    user: null,
  });
  const [dbOperations, setDbOperations] = useState<DbOperationsType>(null);

  useEffect(() => {
    // Listen for changes in Firebase auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // If a user is logged in, fetch their profile from Firestore
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const businessDocRef = doc(db, 'business_info', firebaseUser.uid);

          const userDoc = await getDoc(userDocRef);
          const businessDoc = await getDoc(businessDocRef);

          let docData: { [key: string]: any } | undefined;

          if (userDoc.exists()) {
            docData = userDoc.data();
          } else if (businessDoc.exists()) {
            docData = businessDoc.data();
          }

          if (docData) {
            // Fetch role-based permissions
            let permissions: Permissions[] = [];
            if (docData.role) {
              const permissionDocRef = doc(db, 'permissions', docData.role);
              const permissionDoc = await getDoc(permissionDocRef);
              if (permissionDoc.exists()) {
                permissions = permissionDoc.data().allowedPermissions || [];
              }
            }

            // Construct the complete user object
            const userData: User = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || docData.name || docData.ownerName || 'Anonymous',
              role: docData.role,
              permissions: permissions,
              companyId: docData.companyId || '',
            };

            // If companyId exists, initialize DB operations and set state to authenticated
            if (userData.companyId) {
              setDbOperations(getFirestoreOperations(userData.companyId));
              setAuthState({ status: 'authenticated', user: userData });
            } else {
              console.error("Auth Error: User is authenticated but no companyId was found.");
              setAuthState({ status: 'unauthenticated', user: null });
              setDbOperations(null);
            }
          } else {
            console.error("User document not found in Firestore for UID:", firebaseUser.uid);
            setAuthState({ status: 'unauthenticated', user: null });
            setDbOperations(null);
          }
        } else {
          // No user is logged in
          setAuthState({ status: 'unauthenticated', user: null });
          setDbOperations(null);
        }
      } catch (error) {
        console.error("Error during authentication check:", error);
        setAuthState({ status: 'unauthenticated', user: null });
        setDbOperations(null);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const authValue = useMemo(() => ({
    currentUser: authState.user,
    loading: authState.status === 'pending',
    hasPermission: (permission: Permissions) => authState.user?.permissions?.includes(permission) ?? false,
  }), [authState]);

  // Show a loading screen while authentication is pending
  if (authState.status === 'pending') {
    return <Loading />;
  }

  // Provide the auth and database contexts to the rest of the app
  return (
    <AuthContext.Provider value={authValue}>
      <DatabaseContext.Provider value={dbOperations}>
        {children}
      </DatabaseContext.Provider>
    </AuthContext.Provider>
  );
};