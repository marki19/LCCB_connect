import { useState, useEffect, useCallback } from "react";
import {
  getUserProfile,
  UserProfileData,
  getUserFriends,
  getUserPhotos,
  UserPhoto,
  apiFetch,
  adaptPost,
} from "../../lib/api";
import type { Post } from "../../types";

export function useProfileData(id?: string | null) {
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [theses, setTheses] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [photos, setPhotos] = useState<UserPhoto[]>([]);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingTheses, setLoadingTheses] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);

  // Parallel initial data load
  useEffect(() => {
    let ignore = false;
    if (!id) return;

    async function loadInitialData() {
      try {
        const [profileData, postsData, friendsData, photosData] = await Promise.all([
          getUserProfile(id!),
          apiFetch(`/posts?author_id=${id}&limit=30`)
            .then(async (res) => {
              if (!res.ok) return [];
              const d = await res.json();
              return Array.isArray(d) ? d : Array.isArray(d?.posts) ? d.posts : [];
            })
            .catch(() => []),
          getUserFriends(id!, 9).catch(() => []),
          getUserPhotos(id!, 9).catch(() => []),
        ]);

        if (!ignore) {
          setUserData(profileData);
          setPosts(postsData.map(adaptPost));
          setFriends(friendsData);
          setPhotos(photosData);
          setError(null);
        }
      } catch (err: any) {
        if (!ignore) {
          setError(err?.message || "Failed to load user profile");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      ignore = true;
    };
  }, [id]);

  // Manual re-fetch profile
  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getUserProfile(id);
      setUserData(data);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load user profile");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Manual re-fetch posts
  const fetchPosts = useCallback(async () => {
    if (!id) return;
    setLoadingPosts(true);
    try {
      const res = await apiFetch(`/posts?author_id=${id}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.posts)
          ? data.posts
          : [];
        setPosts(list.map(adaptPost));
      }
    } catch (err) {
      console.error("Failed to load user posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  // Manual re-fetch theses
  const fetchTheses = useCallback(async () => {
    if (!id) return;
    setLoadingTheses(true);
    try {
      const res = await apiFetch(`/theses?uploader_id=${id}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setTheses(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load user theses:", err);
    } finally {
      setLoadingTheses(false);
    }
  }, [id]);

  // Manual re-fetch friends
  const fetchFriends = useCallback(async () => {
    if (!id) return;
    setLoadingFriends(true);
    try {
      const list = await getUserFriends(id, 9);
      setFriends(Array.isArray(list) ? list : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingFriends(false);
    }
  }, [id]);

  // Manual re-fetch photos
  const fetchPhotos = useCallback(async () => {
    if (!id) return;
    setLoadingPhotos(true);
    try {
      const list = await getUserPhotos(id, 9);
      setPhotos(Array.isArray(list) ? list : []);
    } catch {
      // Non-blocking
    } finally {
      setLoadingPhotos(false);
    }
  }, [id]);

  return {
    userData,
    setUserData,
    loading,
    error,
    posts,
    setPosts,
    theses,
    friends,
    photos,
    loadingPosts,
    loadingTheses,
    loadingFriends,
    loadingPhotos,
    fetchProfile,
    fetchPosts,
    fetchTheses,
    fetchFriends,
    fetchPhotos,
  };
}
