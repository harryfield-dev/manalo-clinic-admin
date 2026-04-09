import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthUser {
  id: string;
  name: string;
  role: 'admin' | 'secretary';
  email: string;
  avatar?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginTimestamp: Date | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'manalo_auth_user';

const ADMIN_USERS: Record<string, Omit<AuthUser, 'id' | 'email'>> = {
  'rosecap@manalomedical.ph': { name: 'Rose Ann Capuno', role: 'admin' },
  'roseann@manalomedical.ph': { name: 'Rose Ann Capuno', role: 'admin' },
};

function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

function buildAdminUser(sessionUser: User): AuthUser | null {
  const email = normalizeEmail(sessionUser.email);
  const adminProfile = ADMIN_USERS[email];

  if (!adminProfile) {
    return null;
  }

  return {
    ...adminProfile,
    id: sessionUser.id,
    email,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginTimestamp, setLoginTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncAuthUser = async (session: Session | null) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setLoginTimestamp(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoading(false);
        return;
      }

      const restoredUser = buildAdminUser(session.user);

      if (!restoredUser) {
        setUser(null);
        setLoginTimestamp(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoading(false);
        await supabase.auth.signOut();
        return;
      }

      setUser(restoredUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(restoredUser));
      setIsLoading(false);
    };

    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      await syncAuthUser(data.session);
    };

    void initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncAuthUser(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (!error && data.user) {
      const adminUser = buildAdminUser(data.user);
      if (!adminUser) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: 'This account can sign in, but it is not allowed to access the admin portal.',
        };
      }

      setUser(adminUser);
      setLoginTimestamp(new Date());
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
      return { success: true };
    }

    return {
      success: false,
      error: error?.message || 'Invalid email or password.',
    };
  };

  const logout = () => {
    void supabase.auth.signOut();
    setUser(null);
    setLoginTimestamp(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, loginTimestamp, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}