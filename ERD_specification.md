# LCCB Connect — Database ERD & Schema Specification

Complete relational database model for LCCB Connect, covering the existing campus feed, thesis archive, administrative catalog, and planned realtime messaging subsystem.

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    DEPARTMENTS ||--o{ COURSES : "contains"
    DEPARTMENTS ||--o{ PROFILES : "belongs_to"
    COURSES ||--o{ PROFILES : "enrolled_in"
    PROFILES ||--o{ POSTS : "creates"
    PROFILES ||--o{ THESES : "submits"
    PROFILES ||--o{ COMMENTS : "posts"
    PROFILES ||--o{ LIKES : "submits"
    PROFILES ||--o{ NOTIFICATIONS : "receives"
    POSTS ||--o{ COMMENTS : "receives"
    POSTS ||--o{ LIKES : "receives"

    PROFILES ||--o{ FRIENDSHIPS : "requests/receives"
    PROFILES ||--o{ BLOCKS : "blocks"
    PROFILES ||--o{ CONVERSATIONS : "participates"
    CONVERSATIONS ||--o{ MESSAGES : "contains"
    CONVERSATIONS ||--o{ CONVERSATION_STATE : "tracks"
    MESSAGES ||--o{ MESSAGE_REPORTS : "flags"
    PROFILES ||--o{ DEVICE_TOKENS : "owns"

    DEPARTMENTS {
        uuid id PK
        text code UK
        text name
        int sort_order
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    COURSES {
        uuid id PK
        uuid department_id FK
        text code
        text name
        int sort_order
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    PROFILES {
        text id PK
        text username UK
        text full_name
        text avatar_url
        text bio
        text course
        text year_level
        text role
        text[] skills
        uuid department_id FK
        uuid course_id FK
        text message_policy
        timestamptz created_at
        timestamptz updated_at
    }

    POSTS {
        uuid id PK
        text author_id FK
        text content
        text type
        text title
        text[] technologies
        text github_url
        text image_url
        jsonb preview_metadata
        text moderation_status
        text moderation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    THESES {
        uuid id PK
        text uploader_id FK
        text title
        text abstract
        text department
        text category
        text pdf_url
        text moderation_status
        text moderation_reason
        timestamptz created_at
        timestamptz updated_at
    }

    COMMENTS {
        uuid id PK
        uuid post_id FK
        text user_id FK
        text content
        text moderation_status
        text moderation_reason
        timestamptz created_at
    }

    LIKES {
        uuid id PK
        uuid post_id FK
        text user_id FK
        timestamptz created_at
    }

    NOTIFICATIONS {
        uuid id PK
        text user_id FK
        text actor_id FK
        text type
        uuid target_id
        text department
        text message
        boolean is_read
        timestamptz created_at
    }

    FRIENDSHIPS {
        uuid id PK
        text requester_id FK
        text addressee_id FK
        text status
        timestamptz created_at
        timestamptz responded_at
    }

    BLOCKS {
        text blocker_id PK,FK
        text blocked_id PK,FK
        timestamptz created_at
    }

    CONVERSATIONS {
        uuid id PK
        text user_a FK
        text user_b FK
        text requester_id FK
        text status
        timestamptz last_message_at
        timestamptz created_at
    }

    MESSAGES {
        uuid id PK
        uuid conversation_id FK
        text sender_id FK
        text recipient_id FK
        uuid client_msg_id UK
        bigint seq
        text body
        timestamptz delivered_at
        timestamptz read_at
        timestamptz created_at
    }

    CONVERSATION_STATE {
        uuid conversation_id PK,FK
        text user_id PK,FK
        bigint last_read_seq
        timestamptz muted_until
        timestamptz archived_at
    }

    MESSAGE_REPORTS {
        uuid id PK
        uuid message_id FK
        text reporter_id FK
        text reason
        text status
        timestamptz created_at
    }

    DEVICE_TOKENS {
        uuid id PK
        text user_id FK
        text token
        text platform
        timestamptz created_at
        timestamptz updated_at
    }
```

---

## 2. Table Specifications

### Core Campus Tables (Live)

| Table | Primary Key | Foreign Keys | Key Constraints & Indexes |
|---|---|---|---|
| `departments` | `id` (UUID) | None | `code` UNIQUE, `is_active` + `sort_order` index |
| `courses` | `id` (UUID) | `department_id` -> `departments(id)` | UNIQUE(`department_id`, `name`), ON DELETE RESTRICT |
| `profiles` | `id` (TEXT) | `department_id`, `course_id` | `username` UNIQUE, `role` CHECK, `message_policy` CHECK |
| `posts` | `id` (UUID) | `author_id` -> `profiles(id)` | `type` CHECK, `moderation_status` CHECK, JSONB preview metadata |
| `theses` | `id` (UUID) | `uploader_id` -> `profiles(id)` | `moderation_status` CHECK, created_at index |
| `comments` | `id` (UUID) | `post_id` -> `posts(id)`, `user_id` -> `profiles(id)` | `moderation_status` CHECK |
| `likes` | `id` (UUID) | `post_id` -> `posts(id)`, `user_id` -> `profiles(id)` | UNIQUE(`post_id`, `user_id`) |
| `notifications` | `id` (UUID) | `user_id` -> `profiles(id)`, `actor_id` -> `profiles(id)` | `(user_id, is_read)` composite index |

### Messaging & Social Extension Tables (Planned)

| Table | Primary Key | Foreign Keys | Key Constraints & Indexes |
|---|---|---|---|
| `friendships` | `id` (UUID) | `requester_id`, `addressee_id` -> `profiles(id)` | UNIQUE on `(least(requester, addressee), greatest(requester, addressee))` |
| `blocks` | `(blocker_id, blocked_id)` | `blocker_id`, `blocked_id` -> `profiles(id)` | CHECK `(blocker_id <> blocked_id)` |
| `conversations` | `id` (UUID) | `user_a`, `user_b`, `requester_id` -> `profiles(id)` | CHECK `(user_a < user_b)`, UNIQUE `(user_a, user_b)` |
| `messages` | `id` (UUID) | `conversation_id` -> `conversations(id)`, `sender_id`, `recipient_id` | `seq` BIGINT GENERATED ALWAYS AS IDENTITY, UNIQUE `(sender_id, client_msg_id)` |
| `conversation_state` | `(conversation_id, user_id)` | `conversation_id`, `user_id` | Composite PK; tracks `last_read_seq`, `muted_until`, `archived_at` |
| `message_reports` | `id` (UUID) | `message_id` -> `messages(id)`, `reporter_id` -> `profiles(id)` | UNIQUE `(message_id, reporter_id)` |
| `device_tokens` | `id` (UUID) | `user_id` -> `profiles(id)` | UNIQUE `(user_id, token)`, platform CHECK `('ios', 'android', 'web')` |

---

## 3. Structural Design Rules

1. **Pure Raw SQL**: All migrations run direct Postgres DDL; Express queries run via parameterised `pg` Pool queries (no ORM).
2. **Canonical Deduplication**:
   - `conversations`: Canonical order constraint `CHECK (user_a < user_b)` guarantees exactly one conversation per pair without duplicates.
   - `friendships`: Unique index on ordered pair guarantees a single mutual relationship state.
3. **Sequence Catch-Up**: `messages.seq` provides sequential pagination (`?since_seq=`) rather than clock-based timestamps.
4. **Deny-By-Default RLS**: All tables have Row Level Security enabled; public Supabase API grants (`anon`, `authenticated`) are revoked. Express operates as table owner.
5. **Soft-Delete Architecture**: Reference tables (`departments`, `courses`) use `is_active` flags with `ON DELETE RESTRICT` to protect referential integrity.
