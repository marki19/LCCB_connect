import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiJson, ApiError } from '../lib/api';
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
  // Account sanctions (superadmin console). The API treats an expired
  // `suspended_until` as active, so the screen must check the date.
  suspended_at?: string | null;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  suspended_by?: string | null;
  created_at?: string | null;
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
    // Happy path: fetch the profile, create if missing (404 -> auto-provision)
    try {
      const data = await apiJson<Profile>(`/users/${userId}`);
      setProfile(data);
      return;
    } catch (e) {
      // 404 means user doesn't exist — create it from the current session
      if (e instanceof ApiError && e.status === 404 && currentUser) {
        try {
          const fullName = currentUser.user_metadata?.full_name || currentUser.email?.split("@")[0] || "Student";
          const username = (currentUser.email?.split("@")[0] || "user") + "_" + Math.floor(Math.random() * 1000);
          const newProfile = await apiJson<Profile>(`/users`, {
            method: "POST",
            body: JSON.stringify({ username, full_name: fullName }),
          });
          setProfile(newProfile);
          return;
        } catch (createErr) {
          console.error("Failed to auto-provision profile:", createErr);
        }
        return;
      }

      // 4xx (except 404) = permanent auth/profile error — log with status
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
        console.error(`Profile fetch failed (${e.status}):`, e.message);
        return;
      }

      // Network or 5xx = transient — log for debugging, set null to retry
      console.error("Network failure fetching profile:", e);
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