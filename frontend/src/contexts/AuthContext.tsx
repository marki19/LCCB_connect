import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { unregisterForPush } from '../lib/push';

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
  // Catalog assignment (Messaging_plan.md §3). Null until the user completes
  // their profile; the ids are the authorization source of truth.
  department_id?: string | null;
  course_id?: string | null;
  department_name?: string | null;
  course_name?: string | null;
  message_policy?: string | null;
  // Presence (Messaging_plan.md §8). `presence_mode` is the persisted default;
  // the live value is owned by PresenceContext.
  presence_mode?: string | null;
  last_seen_at?: string | null;
  last_seen_visible?: boolean | null;
};

type AuthContextType = { 
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initialized: boolean;
  isGuest: boolean;
};

const AuthContext = createContext<AuthContextType>({ 
  signInAsGuest: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  session: null,
  user: null,
  profile: null,
  initialized: false,
  isGuest: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  const signInAsGuest = async () => {
    // Pure local guest mode: No Supabase user or account needed.
    setIsGuest(true);
    setProfile({
      id: "guest",
      username: "guest",
      full_name: "Guest Visitor",
      avatar_url: null,
      bio: "Browsing projects as a guest visitor.",
      course: null,
      year_level: null,
      role: "guest",
      skills: null,
    });
  };

  const signOut = async () => {
    // Drop this device's push token first (while the session still authorizes the
    // request) so a shared device stops getting the previous account's pushes.
    await unregisterForPush();
    setIsGuest(false);
    setSession(null);
    setUser(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const fetchProfile = async (userId: string, currentUser?: User | null) => {
    try {
      const res = await apiFetch(`/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data as Profile);
        return;
      }
      if (res.status === 404 && currentUser) {
        const fullName = currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Student";
        const username = (currentUser.email?.split("@")[0] || "user") + "_" + Math.floor(Math.random() * 1000);
        const createRes = await apiFetch(`/users`, {
          method: "POST",
          body: JSON.stringify({ username, full_name: fullName }),
        });
        if (createRes.ok) {
          const newProfile = await createRes.json();
          setProfile(newProfile as Profile);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to fetch profile from raw SQL backend:", e);
    }
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id, user);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id, session.user).finally(() => setInitialized(true));
      } else {
        setInitialized(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id, session.user);
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
    <AuthContext.Provider value={{ session, user, profile, initialized, isGuest, signInAsGuest, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);