import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { AuthContext, type AuthContextType } from './auth-context';
import { Permissions } from '../enums'; // Assuming you have this import

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 1. DEFINE THE 'hasPermission' FUNCTION
  //    (This is a placeholder; you'll add real logic later)
  const hasPermission = (permission: Permissions): boolean => {
    // For now, let's just return false.
    // Later, this will check the currentUser's roles and permissions.
    console.log('Checking permission:', permission);
    return false;
  };

  // 2. ADD 'hasPermission' TO THE VALUE OBJECT
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