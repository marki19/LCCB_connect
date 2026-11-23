# Detailed Profile Project Repositories (GitHub-Style Generalized Explorer)

## Overview & Goal
Enable students and faculty across all disciplines (IT, Engineering, Architecture, Business, Arts, Sciences) to showcase their projects, capstones, and research in their profiles (`/profile/[id]`) with a structured, GitHub-inspired repository explorer. 

Instead of flat, unorganized lists or thesis-only attachments, repositories organize assets into clean, intuitive folders:
- 📁 **Documents & Manuscripts**: PDFs, Word documents (`.docx`, `.doc`), slide decks (`.pptx`), spreadsheets (`.xlsx`).
- 📁 **Media & Visual Assets**: Screenshots, architectural renders, CAD exports, photo galleries (`.png`, `.jpg`, `.webp`, `.svg`).
- 🔗 **Links & Resources**: Live demos, GitHub repos, Figma/Canva designs, Google Drive folders, external portfolios.
- 📄 **README / Abstract Overview**: GitHub-styled markdown/text card at the bottom displaying project abstract, methodology, and tech stack tags.

---

## Architectural Separation of Concerns

```
frontend/
├── src/
│   ├── lib/
│   │   └── repositoryExplorer.ts       # Pure utility: classifies attachments into folders, formats sizes, sorts files
│   ├── components/
│   │   ├── profile/
│   │   │   ├── ProfileTabs.tsx          # Upgraded tab: "Repositories" (with backward compat for "theses")
│   │   │   ├── useProfileData.ts        # Fetches all repository kinds ('project', 'capstone', 'thesis')
│   │   │   ├── ProfileRepositoriesTab.tsx # Top-level repository list with search & category filters
│   │   │   ├── RepositoryCard.tsx       # Individual repository preview card with file counts & badge
│   │   │   ├── RepositoryExplorerView.tsx # GitHub-style drilldown view: breadcrumbs, folders, file list
│   │   │   └── RepositoryReadmeCard.tsx # GitHub-style README container with abstract & stack chips
│   │   └── files/
│   │       └── FilePreviewModal.tsx     # Existing preview modal integrated for click-to-preview
```

---

## Component Breakdown

### 1. Asset Categorization Engine (`frontend/src/lib/repositoryExplorer.ts`)
- Pure function `categorizeRepositoryAssets(post)` that takes any repository post and partitions assets into:
  - `documents`: items matching `.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt`, `.xlsx`, `.txt`, `.csv` or mime types `application/pdf`, `application/msword`, `application/vnd.*`.
  - `media`: items matching `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg` or mime types `image/*`.
  - `links`: extracts `preview_url`, `github_url`, and external URLs from post metadata.
- Computes folder metadata: count, total size formatted (KB/MB), last modified / added timestamp.

### 2. GitHub-Style Repository Explorer (`RepositoryExplorerView.tsx`)
- **Breadcrumb Navigation**:
  - `[← Repositories] / <Project Title>` when at root folder.
  - `[← Root] / <Project Title> / Documents & Manuscripts` when inside a folder.
- **Repository Meta Header**:
  - Title, badge pill (`Project` | `Capstone` | `Thesis / Research`), visibility (`Public` | `Campus`).
  - Tags row: Tools/Skills chips (e.g. `React`, `AutoCAD`, `SPSS`, `Figma`).
  - Quick action links: `Live Demo` (external icon), `Source Link`, `Share`.
- **Folder / File Explorer Table**:
  - In root: Displays virtual folders (`📁 Documents & Manuscripts (3)`, `📁 Media & Gallery (5)`, `🔗 External Links (2)`).
  - Inside a folder: Lists files with exact extension icon (`FileText`, `Image`, `ExternalLink`), file name, size, and timestamp.
  - Clicking any file opens `FilePreviewModal` for in-app viewing.
- **README.md / Abstract Card**:
  - Styled with border, top tab header (`README.md` with book/terminal icon), displaying project description/abstract, background info, and credits.

### 3. Repository Tab Manager (`ProfileRepositoriesTab.tsx`)
- Filter pills: `All`, `Projects`, `Capstones`, `Theses & Research`.
- Search bar to filter user repositories by title, tools, or abstract keywords.
- State management for active drilldown: selecting a card transitions smoothly into `RepositoryExplorerView` within the same profile tab.
- Empty states with call-to-action for owner to create a repository post.

### 4. Integration with Profile Screen & Hooks
- Update `ProfileTabs.tsx`: Tab key `repositories` (with automatic fallback/alias for legacy `theses`).
- Update `useProfileData.ts`: Fetch all `kind=repository` posts for author (`/posts?author_id=${id}&kind=repository&limit=50`).
- Update `frontend/app/profile/[id].tsx`: Render `ProfileRepositoriesTab`.

---

## Verification & Testing Plan
1. **Unit/Lint Verification**:
   - Run TypeScript type checks (`npx tsc --noEmit`) to verify zero type mismatches.
2. **Behavioral UI Verification**:
   - Check repositories with mixed attachments (PDF + PNG + Live link) render 3 clean virtual folders.
   - Test folder navigation: clicking into `Documents` shows files, clicking breadcrumb goes back to root.
   - Test `FilePreviewModal` launches correctly when clicking any document or image.
   - Verify filter pills (`All`, `Projects`, `Capstones`, `Theses`) filter correctly.
   - Verify mobile responsiveness and desktop Facebook-style two-column layout compatibility.
