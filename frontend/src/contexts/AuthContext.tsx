import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  course: string | null;
  year_level: string | null;
  role: string | null;
  skills: string[] | null;
};

type AuthContextType = { 
  signInAsGuest: () => void; 
  signOut: () => Promise<void>;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({ 
  signInAsGuest: () => {}, 
  signOut: async () => {},
  session: null,
  user: null,
  profile: null,
  initialized: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialized, setInitialized] = useState(false);

  const signInAsGuest = () => {
    setSession({ access_token: "guest", refresh_token: "guest", expires_in: 9999, token_type: "bearer", user: { id: "u1", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } });
    setProfile({ id: "u1", username: "mark_antipo", full_name: "Mark Antipo", avatar_url: null, bio: "Full stack developer & capstone project lead.", course: "BSIT", year_level: "3rd Year", role: "student", skills: ["React Native", "PostgreSQL", "Node.js"] });
    setInitialized(true);
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const fetchProfile = async (userId: string) => {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000/api";
      const res = await fetch(`${apiUrl}/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data as Profile);
        return;
      }
    } catch (e) {
      console.error("Failed to fetch profile from raw SQL backend:", e);
    }
    setProfile(null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setInitialized(true));
      } else {
        setInitialized(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, profile, initialized, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);