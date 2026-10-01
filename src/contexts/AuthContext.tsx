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
};

type AuthContextType = { signInAsGuest: () => void; 
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType>({ signInAsGuest: () => {}, 
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
    setSession({ access_token: "guest", refresh_token: "guest", expires_in: 9999, token_type: "bearer", user: { id: "guest", app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } });
    setProfile({ id: "guest", username: "guest", full_name: "Guest User (Prototype)", avatar_url: null, bio: "Exploring the prototype.", course: "BSIT", year_level: "3rd Year", role: "student" });
    setInitialized(true);
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data as Profile);
    } else {
      setProfile(null);
    }
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
    <AuthContext.Provider value={{ session, user, profile, initialized, signInAsGuest }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);