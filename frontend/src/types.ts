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

// ---- messaging & presence (Messaging_plan.md §4–§11) -----------------------

export type PresenceMode = 'online' | 'away' | 'busy' | 'dnd' | 'invisible';

export type MessagePolicy = 'everyone' | 'department' | 'selected' | 'nobody';

/** Derived from `delivered_at` / `read_at` (the server stores the timestamps). */
export type MessageStatus = 'sent' | 'delivered' | 'seen';

export type ConversationPeer = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  department_id: string | null;
  department_name: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  seq: number;
  body: string;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
};

export type ConversationLastMessage = {
  id: string;
  body: string;
  sender_id: string;
  seq: number;
  created_at: string;
};

export type Conversation = {
  id: string;
  status: 'requested' | 'active';
  requester_id: string | null;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  created_at: string;
  peer: ConversationPeer | null;
  last_message: ConversationLastMessage | null;
  unread: number;
};

export type MessageRequests = {
  received: Conversation[];
  sent: Conversation[];
};

export type MessagePolicySetting = {
  message_policy: MessagePolicy;
  department_ids: string[];
};

/** A reported message as it appears in the moderator queue (Messaging_plan.md §7). */
export type MessageReport = {
  id: string;
  message_id: string;
  reason: string | null;
  status: 'open' | 'reviewed' | 'dismissed';
  created_at: string;
  message_body: string;
  sender_id: string;
  conversation_id: string;
  message_created_at: string;
  sender: ConversationPeer | null;
  reporter: { id: string; username: string | null; full_name: string | null } | null;
};

export type Friend = {
  peer: ConversationPeer;
  friends_since: string;
};

export type FriendRequests = {
  incoming: { id: string; requester: ConversationPeer; created_at: string }[];
  outgoing: { id: string; addressee: ConversationPeer; created_at: string }[];
};

export function messageStatus(message: Message): MessageStatus {
  if (message.read_at) return 'seen';
  if (message.delivered_at) return 'delivered';
  return 'sent';
}

