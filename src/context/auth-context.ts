import { createContext, useContext } from 'react';
import type { User } from '../Role/permission';
import { Permissions } from '../enums';

// Define the shape of your AuthContext
export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  hasPermission: (permission: Permissions) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
