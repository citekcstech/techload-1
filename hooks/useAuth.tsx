'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile, Role } from '@/types';

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  activeRole: Role | null;
  isAdmin: boolean;
  switchRole: (role: Role) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  activeRole: null,
  isAdmin: false,
  switchRole: async () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
      if (data) setProfile(data as Profile);
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else { setProfile(null); setLoading(false); }
      }
    );
    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const switchRole = async (role: Role) => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ active_role: role })
      .eq('id', user.id);
    await refreshProfile();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        activeRole: profile?.active_role ?? null,
        isAdmin: profile?.roles?.includes('admin') ?? false,
        switchRole,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
