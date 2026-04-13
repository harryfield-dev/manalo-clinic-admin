import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
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
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_STORAGE_KEY = 'manalo_auth_user';

// ─── fetch admin profile from DB (replaces hardcoded ADMIN_USERS) ──────────
async function fetchAdminUser(userId: string): Promise<AuthUser | null> {
  const { data, error } = await supabase
    .from('admin_accounts')
    .select('id, name, email, role')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return data as AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,           setUser]           = useState<AuthUser | null>(null);
  const [isLoading,      setIsLoading]      = useState(true);
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

      const adminUser = await fetchAdminUser(session.user.id);

      if (!adminUser) {
        // signed in to Supabase Auth but NOT in admin_accounts table — kick them out
        setUser(null);
        setLoginTimestamp(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoading(false);
        await supabase.auth.signOut();
        return;
      }

      setUser(adminUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
      setIsLoading(false);
    };

    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      await syncAuthUser(data.session);
    };

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Skip PASSWORD_RECOVERY and USER_UPDATED events:
      // - PASSWORD_RECOVERY: the recovery session must remain intact so
      //   ResetPasswordPage can call updateUser({ password }).
      // - USER_UPDATED: fired right after updateUser succeeds; if we sync
      //   here the user gets auto-logged-in before signOut() can run.
      //   Safe to skip for authenticated users too — isAuthenticated is
      //   already true so re-syncing changes nothing.
      if (_event === 'PASSWORD_RECOVERY' || _event === 'USER_UPDATED') return;
      void syncAuthUser(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const normalizedEmail = email.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error || !data.user) {
      return { success: false, error: error?.message || 'Invalid email or password.' };
    }

    const adminUser = await fetchAdminUser(data.user.id);

    if (!adminUser) {
      await supabase.auth.signOut();
      return {
        success: false,
        error: 'This account is not allowed to access the admin portal.',
      };
    }

    setUser(adminUser);
    setLoginTimestamp(new Date());
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(adminUser));
    return { success: true };
  };

  const logout = () => {
    void supabase.auth.signOut();
    setUser(null);
    setLoginTimestamp(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // ─── NEW: sends reset email via Supabase ───────────────────────────────────
  const sendPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: window.location.origin },
    );
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      loginTimestamp,
      login,
      logout,
      sendPasswordReset,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}