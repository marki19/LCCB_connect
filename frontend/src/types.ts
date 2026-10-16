export type PostType = "text" | "image" | "project" | "capstone" | "website" | "thesis";

export type User = {
  id: string;
  name: string;
  initials: string;
  avatarColor?: string;
  course?: string;
  yearLevel?: string;
  username?: string;
  bio?: string;
  role?: string;
  skills?: string[];
  // Authoritative department (catalog UUID) + its display name. `course` is a
  // legacy free-text label kept only for backward compatibility.
  department_id?: string | null;
  department_name?: string | null;
};

export type Post = {
  id: string;
  author: User;
  title: string;
  description: string;
  type: PostType;
  previewUrl?: string;
  imageUrl?: string;
  preview_metadata?: {
    title?: string | null;
    description?: string | null;
    image?: string | null;
    url: string;
    siteName?: string | null;
  } | null;
  tags: string[];
  likes: number;
  comments: number;
  createdAt: string;
  rawDate?: number;
  isLiked?: boolean;
};

export type Thesis = {
  id: string;
  uploader_id: string;
  title: string;
  abstract: string;
  // Derived server-side from the uploader's department; `department` is the
  // denormalized display name and may be null.
  department: string | null;
  department_id?: string | null;
  category: string;
  pdf_url: string;
  created_at: string;
  uploader?: User;
};

// Admin-managed catalog (Messaging_plan.md §3). Runtime data, never hardcoded.
export type Department = {
  id: string;
  code: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
};

export type Course = {
  id: string;
  department_id: string;
  code: string | null;
  name: string;
  sort_order: number;
  is_active: boolean;
};
