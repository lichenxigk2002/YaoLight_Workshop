import React, { createContext, useContext, ReactNode } from 'react';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/types/user';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, login, logout, setUser } = useAuthStore();

  const value = {
    user,
    isAuthenticated,
    login,
    logout,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  // For backward compatibility or direct store usage if provider is missing
  // But ideally should be used within AuthProvider
  if (context === undefined) {
    // Fallback to direct store usage if used outside provider
    // This allows gradual migration or mixed usage
    return useAuthStore();
  }
  
  return context;
}
