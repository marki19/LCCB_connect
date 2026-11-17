# Implementation Plan: Backend File Storage Service (Local Filesystem Architecture)

## 1. Problem & Objectives
- Move file handling from direct client-to-cloud uploads to a self-contained, backend-managed storage service.
- Store binary files on the backend filesystem in categorized subdirectories (`avatars/`, `posts/`, `theses/`, `documents/`, `videos/`).
- Database stores **only the filename/relative path** (e.g. `posts/a9f8b7c6d5e4.jpg`), never raw binary files.
- Cryptographically hash filenames to eliminate collisions and prevent overwrites.
- Ensure strict security: directory traversal prevention, magic-byte inspection, MIME whitelisting, and access control for private documents.

---

## 2. Directory Layout & Architecture

```
backend/
├── uploads/                    # Root uploads folder (gitignored)
│   ├── .gitkeep
│   ├── avatars/                # Public profile pictures (PNG, JPG, WebP)
│   ├── posts/                  # Post images & attachments (PNG, JPG, WebP)
│   ├── theses/                 # Thesis & capstone manuscripts (PDF)
│   ├── documents/              # Academic documents (PDF, DOCX)
│   └── videos/                 # Video clips & presentations (MP4, WebM)
├── middleware/
│   └── localUpload.js          # Multer configuration, size caps & magic-byte validator
├── services/
│   ├── storage/
│   │   ├── localStorage.js     # Hashing, path resolution, atomic writes, deletion
│   │   └── index.js            # Unified storage adapter interface
│   └── storageService.js       # Refactored URL expander
└── routes/
    ├── uploadRouter.js         # POST /api/upload/:category
    └── fileRouter.js           # GET /api/files/:category/:filename
```

---

## 3. Key Design Components

### 3.1 Filename Hashing & Collision Prevention
- Every uploaded file receives a deterministic/unique hashed name:
  $$\text{hash} = \text{SHA256}(\text{buffer} + \text{randomBytes}(16) + \text{timestamp})[0..32]$$
- Stored filename format: `<hash>.<safe_extension>` (e.g. `9f83ab24e10c71a39bd5.jpg`).
- If two users upload `document.pdf`, each receives an independent, non-colliding hash.

### 3.2 Subfolder Categories & Rules
| Category | Allowed Formats | Max Size | Access Policy |
| :--- | :--- | :--- | :--- |
| `avatars` | `.jpg`, `.jpeg`, `.png`, `.webp` | 2 MB | Public (Cache-Control: 1 year, immutable) |
| `posts` | `.jpg`, `.jpeg`, `.png`, `.webp` | 10 MB | Public (Authenticated or Guest feed) |
| `theses` | `.pdf` | 50 MB | Protected (Requires authentication / enrolled check) |
| `documents`| `.pdf`, `.docx` | 25 MB | Protected / Departmental |
| `videos` | `.mp4`, `.webm` | 50 MB | Range-requests supported (HTTP 206) |

### 3.3 Security & Safe Serving
- **Path Traversal Shield:** `path.resolve` + strict basename checking. Rejects any request containing `..`, `%2e`, null bytes, or slashes.
- **Magic-Byte Verification:** Verifies file signatures (PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, PDF `%PDF-`, MP4 `ftyp`) to prevent extension spoofing.
- **Git Hygiene:** `uploads/*` is added to `.gitignore` so user data never pollutes git repository history.

---

## 4. Frontend Integration
- Frontend replaces direct Supabase upload with `POST /api/upload/:category` using `multipart/form-data`.
- Server returns `{ filename: "posts/<hash>.jpg", url: "/api/files/posts/<hash>.jpg" }`.
- Frontend stores the relative path in the form payload and displays images via `/api/files/...`.

---

## 5. Verification Plan
- Unit tests for filename hashing, magic-byte checks, and path traversal rejection.
- Integration tests for multipart upload and streaming file retrieval.
- Regression verification for all existing feeds, profiles, and capstones.

