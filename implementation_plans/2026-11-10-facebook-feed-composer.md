# Facebook-Style Feed Composer Widget Implementation Plan

**Goal:** Transform the feed composer card in `frontend/app/(tabs)/index.tsx` into a Facebook-style interactive widget with user avatar, personalized "What's on your mind?" rounded pill button, horizontal divider, and quick format action buttons (Showcase Project, Publish Capstone, Photo, Discussion) that open the new `CreatePostModal` directly to that format.

---

## 1. Components & Layout Design

### Desktop & Mobile Feed Composer (`frontend/app/(tabs)/index.tsx`)
1. **Container Card**:
   - `backgroundColor: colors.panel`
   - `borderRadius: RADIUS.xl` (16px)
   - `borderWidth: 1`, `borderColor: colors.line`
   - `paddingHorizontal: SPACE.x4`, `paddingTop: SPACE.x3`, `paddingBottom: SPACE.x2`
   - `...elevation("sm", colors)`

2. **Top Row**:
   - **Avatar**: Real user `<Avatar name={activeName} size={40} />` instead of plain initials box.
   - **Pill Input**:
     - `flex: 1`
     - `minHeight: 40`
     - `borderRadius: RADIUS.pill`
     - `backgroundColor: colors.surfaceSunken`
     - `borderWidth: 1`, `borderColor: colors.line`
     - `justifyContent: "center"`, `paddingHorizontal: SPACE.x4`
     - Placeholder: `"What's on your mind, [FirstName]?"`
     - Tapping opens `/create` (starts at Step 1 format selection).

3. **Horizontal Divider**:
   - `height: 1`, `backgroundColor: colors.line`, `marginVertical: SPACE.x2`

4. **Action Bar**:
   - 3 or 4 action items spread evenly:
     - **Project** (Icon: `FolderOpen`, color: `#10B981`) -> `/create?editType=project`
     - **Capstone** (Icon: `GraduationCap`, color: `#F59E0B`) -> `/create?editType=capstone`
     - **Photo** (Icon: `Image`, color: `#8B5CF6`) -> `/create?editType=image`
     - **Discussion** (Icon: `MessageSquare`, color: `#3B82F6`) -> `/create?editType=text`
   - Each action has hover state and triggers immediate navigation with pre-selected format.

---

## 2. Modal Integration (`frontend/app/create.tsx`)
- Support `editType` or `type` query param on initial mount:
  - If `editType` is provided without `postId`, initialize `postType = editType` and `step = 2`.
  - Enables skipping format selection directly into content authoring.
  - Back button `<` allows stepping back to Step 1 if the user wants to change format.

