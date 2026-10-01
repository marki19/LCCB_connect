// ─────────────────────────────────────────────────────────────────────────────
// src/data/prototype.ts
//
// This file owns the TypeScript types and assembles the prototype data from
// the JSON files in ./mock/. All mock data lives in those JSON files —
// this file itself contains zero hardcoded records.
//
// To wipe mock data for production: run  scripts/clear-mock-data.ps1
// ─────────────────────────────────────────────────────────────────────────────

import rawUsers from "./mock/users.json";
import rawPosts  from "./mock/posts.json";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostType = "text" | "image" | "project" | "capstone" | "website" | "thesis";

export type User = {
  id:          string;
  name:        string;
  initials:    string;
  avatarColor: string;
  course:      string;
  yearLevel:   string;
};

export type Post = {
  id:          string;
  author:      User;
  title:       string;
  description: string;
  type:        PostType;
  previewUrl?: string;
  tags:        string[];
  likes:       number;
  comments:    number;
  createdAt:   string;
  isLiked:     boolean;
};

// ── Assembled data ────────────────────────────────────────────────────────────

export const PROTOTYPE_USERS: User[] = rawUsers as User[];

// Posts reference authorId; resolve to the full User object here.
type RawPost = Omit<Post, "author"> & { authorId: string; previewUrl: string | null };

export const PROTOTYPE_POSTS: Post[] = (rawPosts as RawPost[]).flatMap((raw) => {
  const author = PROTOTYPE_USERS.find((u) => u.id === raw.authorId);
  if (!author) return [];                      // skip orphaned posts
  return [{
    ...raw,
    author,
    previewUrl: raw.previewUrl ?? undefined,   // null → undefined
  }];
});