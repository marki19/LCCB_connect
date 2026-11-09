import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiJson, ApiError } from '../lib/api';
import { unregisterForPush } from '../lib/push';

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  course: string | null;
  year_level: string | null;
  role: string | null;
  skills: string[] | null;
  // Identity verification (migration 016). Denormalized auth email + app student_id.
  email?: string | null;
  student_id?: string | null;
  verification_status?: 'unverified' | 'pending' | 'verified' | null;
  verified_at?: string | null;
  // Identity completeness (BE-2): derived server-side from full_name + student_id + department_id + course_id.
  identity_complete?: boolean;
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
  // Email bounce tracking (migration 021). True when Brevo reports a hard bounce (550).
  email_bounced?: boolean | null;
  bounce_reason?: string | null;
  bounced_at?: string | null;
  created_at?: string | null;
};

type ProfileStatus = "idle" | "loading" | "ready" | "error";

type AuthContextType = { 
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthNotice: () => void;
  authNotice: string | null;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  initialized: boolean;
  isGuest: boolean;
};

const AuthContext = createContext<AuthContextType>({ 
  signInAsGuest: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  clearAuthNotice: () => {},
  authNotice: null,
  session: null,
  user: null,
  profile: null,
  profileStatus: "idle",
  initialized: false,
  isGuest: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [profileStatus, setProfileStatus] = useState<ProfileStatus>("idle");
    const [initialized, setInitialized] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  // One-shot explanation shown on the login screen after the session was ended
  // because the account no longer exists.
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

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
      setProfileStatus("idle");
      await supabase.auth.signOut();
    };

  const fetchProfile = async (userId: string) => {
      setProfileStatus("loading");
      try {
        const data = await apiJson<Profile>(`/users/${userId}`);
        setProfile(data);
        setProfileStatus("ready");
        return;
      } catch (e) {
        // 404 = the profile is gone. Signup now creates the profile during OTP
        // verification and login refuses profile-less accounts, so this is not a
        // signup in progress: the account was deleted. End the session and say so.
        if (e instanceof ApiError && e.status === 404) {
          setAuthNotice(
            "This account has been deleted. Contact the administrator if you think this is a mistake."
          );
          setProfile(null);
          setProfileStatus("error");
          await supabase.auth.signOut();
          return;
        }

        // 4xx (except 404) = permanent auth/profile error — log with status
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          console.error(`Profile fetch failed (${e.status}):`, e.message);
          setProfile(null);
          setProfileStatus("error");
          return;
        }

        // Network or 5xx = transient — log for debugging, set null to retry
        console.error("Network failure fetching profile:", e);
        setProfile(null);
        setProfileStatus("error");
      }
    };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id).finally(() => setInitialized(true));
        } else {
          setProfileStatus("idle");
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
            setProfileStatus("idle");
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }, []);

  return (
      <AuthContext.Provider value={{ session, user, profile, profileStatus, initialized, isGuest, signInAsGuest, signOut, refreshProfile, authNotice, clearAuthNotice }}>
        {children}
      </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);