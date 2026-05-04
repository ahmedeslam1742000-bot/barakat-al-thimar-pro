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
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, username, full_name, phone, email')
        .eq('id', userId)
        .maybeSingle();

      if (userError || !userData) return { role: 'User', username: '', permissions: [] };

      // Fetch permissions
      const { data: permData } = await supabase
        .from('user_permissions')
        .select('page_id, is_allowed')
        .eq('user_id', userId);

      const permissions = permData || [];

      return {
        role: userData.role || 'User',
        username: userData.username || '',
        fullName: userData.full_name || '',
        phone: userData.phone || '',
        email: userData.email || '',
        permissions: permissions
      };
    } catch {
      return { role: 'User', username: '', permissions: [] };
    }
  }

  const canAccess = (pageId) => {
    if (!currentUser) return false;
    // Master Admin bypass
    if (currentUser.email === 'ahmed_eslam288@yahoo.com') return true;
    if (currentUser.role === 'Admin') return true;
    
    const perm = currentUser.permissions?.find(p => p.page_id === pageId);
    return perm ? perm.is_allowed : false;
  };

  const value = {
    currentUser,
    isAdmin: currentUser?.role === 'Admin' || currentUser?.email === 'ahmed_eslam288@yahoo.com',
    isViewer: currentUser?.role === 'Viewer' || settings?.systemFrozen,
    isStorekeeper: currentUser?.role === 'Storekeeper',
    login,
    signup,
    logout,
    canAccess,
    supabase,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
