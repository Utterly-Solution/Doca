'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '@/lib/types';
import {
  authenticate,
  getCurrentUser,
  getCurrentSession,
  updateLastActivity,
  logout as authLogout,
  seedUsers,
  hasPermission,
  Permission,
} from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string; user?: User };
  logout: () => void;
  checkPermission: (permission: Permission) => boolean;
  sessionExpiredReason: 'inactivity' | 'expired' | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: () => ({ success: false }),
  logout: () => {},
  checkPermission: () => false,
  sessionExpiredReason: null,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<'inactivity' | 'expired' | null>(null);

  // Seed default users on mount
  useEffect(() => {
    seedUsers();
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setIsLoading(false);
  }, []);

  // Track activity for inactivity timeout
  useEffect(() => {
    if (!user) return;

    const handleActivity = () => {
      updateLastActivity();
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [user]);

  // Check session validity periodically
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      const session = getCurrentSession();
      if (!session) {
        setUser(null);
        setSessionExpiredReason('inactivity');
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback((email: string, password: string) => {
    setSessionExpiredReason(null);
    const result = authenticate(email, password);
    if (result) {
      setUser(result.user);
      return { success: true, user: result.user };
    }
    return { success: false, error: 'Invalid email or password' };
  }, []);

  const logout = useCallback(() => {
    authLogout();
    setUser(null);
    setSessionExpiredReason(null);
  }, []);

  const checkPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      return hasPermission(user.role, permission);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkPermission,
        sessionExpiredReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
