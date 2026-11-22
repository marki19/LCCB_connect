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

function extractPhotosFromPosts(posts: any[]): UserPhoto[] {
  const result: UserPhoto[] = [];
  const seenUrls = new Set<string>();

  for (const post of posts) {
    const urls: string[] = [];
    if (Array.isArray(post.image_urls) && post.image_urls.length > 0) {
      urls.push(...post.image_urls);
    } else if (post.image_url || post.imageUrl) {
      urls.push(post.image_url || post.imageUrl);
    }

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      if (url && typeof url === "string" && !seenUrls.has(url)) {
        seenUrls.add(url);
        result.push({
          id: `${post.id}-img-${i}`,
          image_url: url,
          image_urls: [url],
          created_at: post.created_at || post.createdAt || new Date().toISOString(),
        });
      }
    }
  }
  return result;
}

export function useProfileData(id?: string | null) {
  const [userData, setUserData] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [repositories, setRepositories] = useState<Post[]>([]);
  const [theses, setTheses] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [photos, setPhotos] = useState<UserPhoto[]>([]);

  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingRepositories, setLoadingRepositories] = useState(false);
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

        const postList = postsData.map(adaptPost);
        const resolvedPhotos =
          Array.isArray(photosData) && photosData.length > 0
            ? photosData
            : extractPhotosFromPosts(postsData);

        if (!ignore) {
          setUserData(profileData);
          setPosts(postList);
          setFriends(friendsData);
          setPhotos(resolvedPhotos);
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
        setPhotos((prev) => (prev.length > 0 ? prev : extractPhotosFromPosts(list)));
      }
    } catch (err) {
      console.error("Failed to load user posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  }, [id]);

  // Manual re-fetch repositories (projects, capstones, and theses)
  const fetchRepositories = useCallback(async () => {
    if (!id) return;
    setLoadingRepositories(true);
    try {
      const res = await apiFetch(`/posts?author_id=${id}&kind=repository&limit=50`);
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.posts)
          ? data.posts
          : [];
        const adaptedList = rawList.map(adaptPost);
        setRepositories(adaptedList);
        setTheses(
          adaptedList
            .filter((p: any) => p.repository_type === "thesis" || p.type === "thesis")
            .map((p: any) => ({
              ...p,
              abstract: p.description || p.content,
              category: p.repository_category,
              pdf_url:
                p.attachments?.find((a: any) => a.mime_type === "application/pdf")?.storage_key ||
                (p as any).pdf_url,
            }))
        );
      }
    } catch (err) {
      console.error("Failed to load user repositories:", err);
    } finally {
      setLoadingRepositories(false);
    }
  }, [id]);

  // Manual re-fetch theses
  const fetchTheses = useCallback(async () => {
    if (!id) return;
    setLoadingTheses(true);
    try {
      const res = await apiFetch(
        `/posts?author_id=${id}&kind=repository&repository_type=thesis&limit=30`
      );
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data)
          ? data
          : Array.isArray(data?.posts)
          ? data.posts
          : [];
        setTheses(
          rawList.map((p: any) => ({
            ...p,
            abstract: p.abstract || p.content,
            category: p.category || p.repository_category,
            pdf_url:
              p.attachments?.find((a: any) => a.mime_type === "application/pdf")?.storage_key ||
              p.pdf_url,
          }))
        );
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
      if (Array.isArray(list) && list.length > 0) {
        setPhotos(list);
      } else {
        setPhotos((prev) => (prev.length > 0 ? prev : extractPhotosFromPosts(posts)));
      }
    } catch {
      setPhotos((prev) => (prev.length > 0 ? prev : extractPhotosFromPosts(posts)));
    } finally {
      setLoadingPhotos(false);
    }
  }, [id, posts]);

  return {
    userData,
    setUserData,
    loading,
    error,
    posts,
    setPosts,
    repositories,
    theses,
    friends,
    photos,
    loadingPosts,
    loadingRepositories,
    loadingTheses,
    loadingFriends,
    loadingPhotos,
    fetchProfile,
    fetchPosts,
    fetchRepositories,
    fetchTheses,
    fetchFriends,
    fetchPhotos,
  };
}
