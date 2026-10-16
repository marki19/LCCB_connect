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
  department: string;
  category: string;
  pdf_url: string;
  created_at: string;
  uploader?: User;
};
