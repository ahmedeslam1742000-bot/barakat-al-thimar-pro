import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useSettings } from './SettingsContext';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { settings } = useSettings();

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signup(email, password) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function logout() {
    sessionStorage.removeItem('auth_token');
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        sessionStorage.setItem('auth_token', 'active');
        fetchUserRole(session.user.id).then(userData => {
          setCurrentUser({ ...session.user, ...userData });
          setLoading(false);
        });
      } else {
        sessionStorage.removeItem('auth_token');
        setCurrentUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          sessionStorage.setItem('auth_token', 'active');
          const userData = await fetchUserRole(session.user.id);
          setCurrentUser({ ...session.user, ...userData });
        } else {
          sessionStorage.removeItem('auth_token');
          setCurrentUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserRole(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role, username, full_name, phone')
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) return { role: 'User', username: '' };
      return {
        role: data.role || 'User',
        username: data.username || '',
        fullName: data.full_name || '',
        phone: data.phone || '',
      };
    } catch {
      return { role: 'User', username: '' };
    }
  }

  const value = {
    currentUser,
    isAdmin: currentUser?.role === 'Admin',
    isViewer: currentUser?.role === 'Viewer' || settings?.systemFrozen,
    isStorekeeper: currentUser?.role === 'Storekeeper',
    login,
    signup,
    logout,
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
