# LCCB Connect - UI/UX Overhaul Implementation Plan (Detailed)

## Overview
Detailed technical breakdown for each phase: root cause analysis, exact file locations, and patch instructions.

---

## Phase 1: Presence & Social Graph Accuracy (Critical)

### 1.1 Fix Campus Peers Online Status

**Root Cause:**
```
Frontend: HomeScreen.fetchActivePeers() → GET /api/public/peers → returns ALL users
Frontend: Right rail renders <View style={{backgroundColor: colors.jade}} /> for EVERY peer (line 1075)
Presence: usePresence().isOnline(id) exists but NEVER used in HomeScreen
```

**Evidence in Code:**
- `frontend/app/(tabs)/index.tsx:247-259` - `fetchActivePeers` calls `/public/peers` with no auth
- `frontend/app/(tabs)/index.tsx:1075` - Hardcoded `backgroundColor: colors.jade` for all peers
- `frontend/src/contexts/PresenceContext.tsx:144` - `isOnline = (id) => Boolean(presences[id]?.length)` exists but unused

**Patch Instructions:**

**Backend - `backend/controllers/publicController.js`:**
```javascript
// ADD: optional ?online=true filter
const getPeers = async (req, res, next) => {
  try {
    const onlineOnly = req.query.online === 'true';
    // ... existing code ...
    
    // If online filter requested AND user authenticated, filter by presence
    if (onlineOnly && req.user?.id) {
      // Need to cross-reference with Realtime presence
      // Option A: Join with presence table (if we add one)
      // Option B: Return all, let frontend filter (simpler)
    }
    
    // Simpler approach: just return all, frontend filters via usePresence()
    const publicPeers = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      year_level: u.year_level,
      department_name: u.department_name,
    }));
    res.json(publicPeers);
  } catch (error) { next(error); }
};
```

**Frontend - `frontend/app/(tabs)/index.tsx`:**
```typescript
// ADD: import usePresence
import { usePresence } from "../../src/contexts/PresenceContext";

// In component:
const { isOnline } = usePresence();

// REPLACE line 1075 hardcoded green dot:
<View
  style={{
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: isOnline(peer.id) ? colors.jade : colors.inkFaint, // REAL presence
    borderWidth: 2,
    borderColor: colors.surfacePage,
  }}
/>
```

**Frontend - `frontend/src/components/PeerPicker.tsx`:**
```typescript
// ADD: import usePresence
import { usePresence } from "../contexts/PresenceContext";

// In component:
const { isOnline, modeOf } = usePresence();

// REPLACE line 188 (Avatar without presence):
<Avatar name={item.full_name || item.username} size={44} showPresence mode={modeOf(item.id)} />
```

---

### 1.2 Filter Campus Peers by Social Graph

**Root Cause:**
```
/api/public/peers returns ALL users unconditionally
HomeScreen uses this for "Campus Peers" rail (should be friends only)
PeerPicker uses this for "New message" (should be network = friends + pending + same dept)
```

**Current Flow:**
- `publicController.getPeers()` → `userModel.getAllUsers()` → returns ALL profiles
- No `scope` parameter exists

**Patch Instructions:**

**Backend - `backend/models/userModel.js` - ADD new functions:**
```javascript
// ADD after getAllUsers (around line 60)
const getFriends = async (userId, { limit = 20, cursor = null } = {}) => {
  const params = [userId];
  const conditions = [`f.status = 'accepted'`];
  
  if (cursor) {
    params.push(cursor);
    conditions.push(`p.id > $${params.length}`);
  }
  
  params.push(limit);
  const sql = `
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    JOIN public.friendships f ON (
      (f.requester_id = p.id AND f.addressee_id = $1)
      OR (f.addressee_id = p.id AND f.requester_id = $1)
    )
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.id ASC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};

const getNetwork = async (userId, { limit = 50, cursor = null } = {}) => {
  // Friends + pending requests (incoming/outgoing) + same department
  const params = [userId];
  const conditions = [];
  
  // Get user's department for same-dept filter
  const user = await getUserById(userId);
  const deptId = user?.department_id;
  
  if (cursor) {
    params.push(cursor);
    conditions.push(`p.id > $${params.length}`);
  }
  
  // Complex query: UNION of friends + pending + same dept (excluding self)
  params.push(limit);
  const sql = `
    WITH user_dept AS (
      SELECT department_id FROM profiles WHERE id = $1
    ),
    friends AS (
      SELECT p.id FROM profiles p
      JOIN friendships f ON (
        (f.requester_id = p.id AND f.addressee_id = $1)
        OR (f.addressee_id = p.id AND f.requester_id = $1)
      )
      WHERE f.status = 'accepted'
    ),
    pending AS (
      SELECT p.id FROM profiles p
      JOIN friendships f ON (
        (f.requester_id = p.id AND f.addressee_id = $1)
        OR (f.addressee_id = p.id AND f.requester_id = $1)
      )
      WHERE f.status = 'pending'
    ),
    same_dept AS (
      SELECT p.id FROM profiles p
      CROSS JOIN user_dept ud
      WHERE p.department_id = ud.department_id
    )
    SELECT p.*, d.name AS department_name, c.name AS course_name
    FROM profiles p
    LEFT JOIN public.departments d ON d.id = p.department_id
    LEFT JOIN public.courses c ON c.id = p.course_id
    WHERE p.id IN (SELECT id FROM friends)
       OR p.id IN (SELECT id FROM pending)
       OR (p.id IN (SELECT id FROM same_dept) AND $1::uuid IS NOT NULL)
       AND p.id != $1
    ORDER BY p.id ASC
    LIMIT $${params.length};
  `;
  const result = await db.query(sql, params);
  return result.rows;
};
```

**Backend - `backend/controllers/publicController.js` - MODIFY getPeers:**
```javascript
const getPeers = async (req, res, next) => {
  try {
    const scope = req.query.scope || 'all'; // 'all' | 'friends' | 'network'
    const department = parseUuidFilter(req.query.department_id, "department_id");
    // ... existing validation ...
    
    let users;
    if (scope === 'friends' && req.user?.id) {
      users = await userModel.getFriends(req.user.id, {
        limit: clampLimit(req.query.limit || 20),
        cursor: req.query.cursor || null,
      });
    } else if (scope === 'network' && req.user?.id) {
      users = await userModel.getNetwork(req.user.id, {
        limit: clampLimit(req.query.limit || 50),
        cursor: req.query.cursor || null,
      });
    } else {
      // Public directory - all users (existing behavior)
      users = await userModel.getAllUsers({
        limit: clampLimit(req.query.limit || 20),
        cursor: req.query.cursor || null,
        q: parseSearch(req.query.q),
        departmentId: department.value,
        yearLevel: parseTextFilter(req.query.year_level, 50),
      });
    }
    
    const publicPeers = (users || []).map((u) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      year_level: u.year_level,
      department_name: u.department_name,
    }));
    res.json(publicPeers);
  } catch (error) { next(error); }
};
```

**Frontend - `frontend/app/(tabs)/index.tsx` - MODIFY fetchActivePeers:**
```typescript
// Line 247-259: CHANGE to use scope=friends
const fetchActivePeers = useCallback(async () => {
  try {
    const res = await apiFetch(`/public/peers?scope=friends&limit=20`);
    if (res.ok) {
      const users = await res.json();
      if (users && users.length > 0) {
        setActivePeers(users);
      }
    }
  } catch (e) {
    console.error("Failed to load peers from SQL backend:", e);
  }
}, []);
```

**Frontend - `frontend/src/components/PeerPicker.tsx` - MODIFY fetch:**
```typescript
// Line 63-65: CHANGE to use scope=network
const params = [`limit=50`, `scope=network`];
if (debouncedQuery) params.push(`q=${encodeURIComponent(debouncedQuery)}`);
const data: Peer[] = await apiJson<Peer[]>(`/public/peers?${params.join("&")}`);
```

---

### 1.3 Remove Self from Peer Lists

**Root Cause:**
- `PeerPicker` already filters at line 67: `data.filter((p) => p.id !== profile?.id)` ✓
- `HomeScreen` right rail does NOT filter self

**Patch Instructions:**

**Frontend - `frontend/app/(tabs)/index.tsx` - ADD filter:**
```typescript
// Line 252-254: ADD filter
if (users && users.length > 0) {
  setActivePeers(users.filter((u) => u.id !== profile?.id));
}
```

---

## Phase 2: Header Icons Only

### 2.1 Desktop Web Top Bar (`_layout.tsx`)

**Root Cause:**
- Lines 210-215: "Campus network" subtitle
- Lines 240-244: "Create post" text beside Plus icon
- Lines 297-301: "Admin console" text beside Shield icon
- Lines 250-258: `DesktopTab` shows labels based on `compactNav` breakpoint, not hover

**Patch Instructions:**

**File: `frontend/app/(tabs)/_layout.tsx`**

**REMOVE lines 210-215 (brand subtitle):**
```tsx
// REMOVE this block:
<View>
  <Text style={[styles.webBrandTitle, { color: colors.ink }]}>
    LCCB <Text style={{ color: colors.brand }}>Connect</Text>
  </Text>
  <Text style={[styles.webBrandSub, { color: colors.inkFaint }]}>
    {compactNav ? "Campus" : "Campus network"}
  </Text>
</View>

// REPLACE with:
<View>
  <Text style={[styles.webBrandTitle, { color: colors.ink }]}>
    LCCB <Text style={{ color: colors.brand }}>Connect</Text>
  </Text>
</View>
```

**MODIFY `webCreateButton` (lines 224-246) - icon only with tooltip:**
```tsx
// REPLACE the entire isAction block:
if (isAction) {
  return (
    <Pressable
      key={name}
      accessibilityRole="button"
      accessibilityLabel="Create a post"
      onPress={() => router.push("/create")}
      style={({ pressed }) => [
        styles.webCreateButton,
        { backgroundColor: colors.brandSolid, opacity: pressed ? 0.88 : 1 },
      ]}
    >
      <Plus size={16} color={colors.textOnPrimary} strokeWidth={2.5} />
      {/* REMOVE the compactActions conditional text block */}
    </Pressable>
  );
}
```

**MODIFY `webAdminButton` (lines 280-302) - icon only:**
```tsx
// REPLACE:
{adminUser ? (
  <Pressable
    onPress={() => { setAdminAppPreview(false); router.push("/(admin)"); }}
    accessibilityRole="button"
    accessibilityLabel="Open the admin console"
    style={({ pressed }) => [
      styles.webAdminButton,
      { borderColor: colors.line, backgroundColor: pressed ? colors.panelInset : "transparent" },
    ]}
  >
    <Shield size={16} color={colors.brand} strokeWidth={2.2} />
    {/* REMOVE compactActions conditional text */}
  </Pressable>
) : departmentAdmin ? (
  <Pressable
    onPress={() => router.push("/(moderation)" as any)}
    accessibilityRole="button"
    accessibilityLabel="Open the moderation console"
    style={[styles.webTab, { borderWidth: 1, borderColor: colors.border, marginLeft: 8 }]}
  >
    <Shield size={18} color={colors.action} strokeWidth={2.2} />
    {/* REMOVE text label */}
  </Pressable>
) : null}
```

**MODIFY `DesktopTab` component (lines 35-96) - hover-based labels:**
```tsx
function DesktopTab({
  label,
  icon: Icon,
  focused,
  onPress,
  colors,
}: {
  label: string;
  icon: any;
  focused: boolean;
  onPress: () => void;
  colors: ThemeTokens;
}) {
  const [hovered, setHovered] = useState(false);
  const [focusVisible, setFocusVisible] = useState(false);
  const showLabel = hovered || focusVisible; // ONLY show on hover/focus

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onFocus={() => setFocusVisible(true)}
      onBlur={() => setFocusVisible(false)}
      style={[
        styles.webTab,
        {
          backgroundColor: focused
            ? colors.brandWash
            : hovered
            ? colors.panelInset
            : "transparent",
        },
        focusRing(colors, focusVisible),
      ]}
    >
      <Icon size={17} color={focused ? colors.brand : colors.inkFaint} strokeWidth={focused ? 2.4 : 2} />
      {showLabel ? (
        <Text
          style={[
            styles.webTabLabel,
            { color: focused ? colors.brand : colors.inkSoft, fontWeight: focused ? "700" : "600" },
          ]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}
```

**REMOVE `showLabel` prop from all `DesktopTab` calls (lines 250, 257).**

---

## Phase 3: Sidebar Interactivity

### 3.1 Left Rail - Collapsible Sections

**File: `frontend/app/(tabs)/index.tsx` lines 431-540**

**Current Structure (flat):**
```tsx
<SideLink icon={Users} label="Campus Feed" ... />
<SideLink icon={BookOpen} label="Thesis Repository" ... />
<SideLink icon={FolderGit2} label="Capstones & Projects" ... />
<SideLink icon={MessageSquare} label="Messages" badgeCount={unreadCount} ... />
<SideLink icon={Settings} label="Settings & Privacy" ... />
```

**Target Structure (collapsible groups):**
```tsx
<CollapsibleSection title="Navigation" defaultOpen>
  <SideLink icon={Home} label="Home" active={filter==="all"} ... />
  <SideLink icon={BookOpen} label="Repository" ... />
  <SideLink icon={FolderGit2} label="Projects" active={filter==="projects"} ... />
</CollapsibleSection>

<CollapsibleSection title="Communication" defaultOpen>
  <SideLink icon={MessageSquare} label="Messages" badgeCount={unreadCount} ... />
  <SideLink icon={Users} label="Friends" ... />
</CollapsibleSection>

<CollapsibleSection title="Settings" defaultClosed>
  <SideLink icon={Settings} label="Settings & Privacy" ... />
  <SideLink icon={Palette} label="Appearance" ... />
  <SideLink icon={BellRing} label="Notifications" ... />
</CollapsibleSection>
```

**Patch Instructions:**

**ADD new component `CollapsibleSection` above `SideLink` (around line 109):**
```tsx
function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  colors: ThemeTokens;
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  return (
    <View>
      <Pressable
        onPress={() => setOpen(!open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.x3, paddingVertical: SPACE.x2 }}
      >
        <Text style={{ ...TYPE.micro, fontSize: 8.5, color: colors.inkFaint, textTransform: "uppercase", letterSpacing: 0.8 }}>
          {title}
        </Text>
        <ChevronDown size={12} color={colors.inkFaint} style={{ transform: [{ rotate: open ? "0deg" : "-90deg" }] }} />
      </Pressable>
      {open && <View style={{ paddingLeft: SPACE.x3 }}>{children}</View>}
    </View>
  );
}
```

**REPLACE lines 488-539 with collapsible structure.**

---

### 3.2 Right Rail - Modular Plugin System

**File: `frontend/app/(tabs)/index.tsx` lines 915-1096**

**Current (hardcoded cards):**
1. Deposit manuscript (lines 926-978) - REMOVE
2. Academic deadlines (lines 980-1016) - REMOVE  
3. Campus peers (lines 1018-1095) - KEEP, make modular

**Target: Module registry + user preferences**

**ADD `src/lib/railModules.ts`:**
```typescript
export type RailModuleId = "peers" | "quickActions" | "deadlines" | "stats";

export interface RailModule {
  id: RailModuleId;
  title: string;
  Icon: any;
  enabled: boolean;
  order: number;
  render: (props: { profile: any; colors: any; router: any }) => React.ReactNode;
}

export const DEFAULT_MODULES: RailModule[] = [
  {
    id: "peers",
    title: "Campus Peers",
    Icon: Users,
    enabled: true,
    order: 1,
    render: ({ profile, colors, router }) => <PeersModule profile={profile} colors={colors} router={router} />,
  },
  {
    id: "quickActions",
    title: "Quick Actions",
    Icon: Zap,
    enabled: true,
    order: 2,
    render: ({ profile, colors, router }) => <QuickActionsModule colors={colors} router={router} />,
  },
  {
    id: "deadlines",
    title: "Upcoming Deadlines",
    Icon: Calendar,
    enabled: false, // disabled by default - requires calendar integration
    order: 3,
    render: ({ colors }) => <DeadlinesModule colors={colors} />,
  },
  {
    id: "stats",
    title: "My Stats",
    Icon: BarChart2,
    enabled: true,
    order: 4,
    render: ({ profile, colors }) => <StatsModule profile={profile} colors={colors} />,
  },
];
```

**ADD `src/components/RightRail.tsx` (new component):**
```tsx
import { DEFAULT_MODULES } from "../lib/railModules";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { useRouter } from "expo-router";

export default function RightRail({ isWideWeb }: { isWideWeb: boolean }) {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const router = useRouter();
  const [enabledModules, setEnabledModules] = useState<typeof DEFAULT_MODULES>(DEFAULT_MODULES);
  
  // Load from AsyncStorage on mount
  useEffect(() => {
    // TODO: load user preferences
  }, []);
  
  const sortedModules = [...enabledModules]
    .filter(m => m.enabled)
    .sort((a, b) => a.order - b.order);
  
  return (
    <View style={{ width: isWideWeb ? 320 : 312, paddingHorizontal: SPACE.x4, paddingTop: SPACE.x5, borderLeftWidth: 1, borderLeftColor: colors.line, backgroundColor: colors.surfacePage }}>
      {sortedModules.map((module) => (
        <View key={module.id} style={{ marginBottom: SPACE.x5 }}>
          {module.render({ profile, colors, router })}
        </View>
      ))}
    </View>
  );
}
```

**REPLACE lines 915-1096 in `index.tsx` with:**
```tsx
{isDesktopWeb && <RightRail isWideWeb={isWideWeb} />}
```

**In `SettingsSidebar.tsx` - ADD module manager section:**
```tsx
// After "App" section, ADD:
<SectionLabel label="Dashboard" />
<MenuItem icon={<LayoutDashboard size={20} color={colors.action} />} label="Customize Right Rail" onPress={() => router.push("/settings/rail")} />
```

---

## Phase 4: Messaging UX Overhaul

### 4.1 PeerPicker - Policy-Aware Labels

**File: `frontend/src/components/PeerPicker.tsx`**

**Current (lines 199-236):**
```tsx
<TouchableOpacity onPress={() => handleMessage(item)} style={{ backgroundColor: colors.action }}>
  <MessageSquare size={14} color="#FFFFFF" />
  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700", marginLeft: 6 }}>Message</Text>
</TouchableOpacity>
```

**Problem:** Always shows "Message" even for users who require a request.

**Fix: Fetch policy decision for each peer**

**Backend - ADD endpoint `/api/conversations/preview?peer_id=X`:**
```javascript
// backend/controllers/messageController.js - ADD
const previewConversation = async (req, res, next) => {
  try {
    const { peer_id } = req.query;
    if (!peer_id) return res.status(400).json({ error: "peer_id required" });
    
    // Check if already friends (direct)
    const friendship = await db.query(
      `SELECT status FROM friendships WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [req.user.id, peer_id]
    );
    
    if (friendship.rows[0]?.status === 'accepted') {
      return res.json({ policy: 'direct', canMessage: true });
    }
    
    // Check recipient's messaging policy
    const recipient = await db.query(
      `SELECT messaging_policy, messaging_allowlist FROM profiles WHERE id = $1`,
      [peer_id]
    );
    
    const policy = recipient.rows[0]?.messaging_policy || 'request';
    let canMessage = false;
    
    if (policy === 'everyone') canMessage = true;
    else if (policy === 'department') {
      const requester = await db.query(`SELECT department_id FROM profiles WHERE id = $1`, [req.user.id]);
      canMessage = requester.rows[0]?.department_id === recipient.rows[0]?.department_id;
    } else if (policy === 'selected') {
      const allowlist = recipient.rows[0]?.messaging_allowlist || [];
      canMessage = allowlist.includes(req.user.id);
    }
    // 'nobody' and 'request' -> cannot message directly
    
    res.json({ policy, canMessage, requiresRequest: !canMessage });
  } catch (error) { next(error); }
};
```

**Frontend - `PeerPicker.tsx` - MODIFY renderItem:**
```tsx
// ADD state for policies
const [policies, setPolicies] = useState<Record<string, { policy: string; canMessage: boolean }>>({});

// In useEffect after fetching peers, fetch policies for visible peers
useEffect(() => {
  if (!visible || peers.length === 0) return;
  const fetchPolicies = async () => {
    const results: Record<string, any> = {};
    for (const peer of peers.slice(0, 20)) { // limit to first 20
      try {
        const res = await apiFetch(`/conversations/preview?peer_id=${peer.id}`);
        if (res.ok) results[peer.id] = await res.json();
      } catch {}
    }
    setPolicies(results);
  };
  fetchPolicies();
}, [visible, peers]);

// In renderItem (around line 199):
const policy = policies[item.id];
const canMessage = policy?.canMessage;
const label = canMessage ? "Message" : "Request";
const iconColor = canMessage ? "#FFFFFF" : colors.action;
const bgColor = canMessage ? colors.action : colors.brandWash;

return (
  <TouchableOpacity
    disabled={isBusy}
    onPress={() => canMessage ? handleMessage(item) : handleAdd(item)}
    style={{
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: bgColor,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 18,
      opacity: isBusy ? 0.6 : 1,
    }}
  >
    {canMessage ? (
      <MessageSquare size={14} color={iconColor} />
    ) : (
      <UserPlus size={14} color={iconColor} />
    )}
    <Text style={{ color: iconColor, fontSize: 13, fontWeight: "700", marginLeft: 6 }}>
      {label}
    </Text>
  </TouchableOpacity>
);
```

---

### 4.2 Group PeerPicker List

**Target:** Section headers: "Friends" → "Same Department" → "Others"

**Patch:**
```tsx
// In PeerPicker, group peers by relationship
const groupedPeers = useMemo(() => {
  const friends = peers.filter(p => p.is_friend); // need to add this field
  const sameDept = peers.filter(p => !p.is_friend && p.department_id === profile?.department_id);
  const others = peers.filter(p => !p.is_friend && p.department_id !== profile?.department_id);
  return [
    { title: "Friends", data: friends },
    { title: "Same Department", data: sameDept },
    { title: "Others", data: others },
  ].filter(g => g.data.length > 0);
}, [peers, profile?.department_id]);

// In FlatList, use SectionList instead:
<SectionList
  sections={groupedPeers}
  keyExtractor={(item) => item.id}
  renderSectionHeader={({ section }) => (
    <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontSize: 11, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase" }}>
      {section.title}
    </Text>
  )}
  renderItem={({ item }) => (/* existing renderItem */)}}
/>
```

---

## Phase 5: Remove "Hello Mark" Hero Banner

**File: `frontend/app/(tabs)/index.tsx` lines 562-678**

**Current (Hero Gradient Card):**
- Lines 564-678: Entire `ListHeaderComponent` with `LinearGradient`
- Lines 599-608: `Hello, ${firstName}` greeting
- Lines 610-622: "Here is what your campus is building..." description
- Lines 624-676: Stats + Share button

**Target: Compact Stats Bar**

**REPLACE lines 562-678 with:**
```tsx
ListHeaderComponent={
  <View style={{ marginBottom: SPACE.x3, paddingHorizontal: SPACE.x4 }}>
    {/* Compact stats bar */}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACE.x2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.x4 }}>
        <HeroStat value={activePeers.length} label="Active" colors={colors} loading={loading} />
        <HeroStat value={posts.length} label="Posts" colors={colors} loading={loading} />
      </View>
      {!isGuest && (
        <Pressable accessibilityRole="button" accessibilityLabel="Share something with campus" onPress={goCreate} style={({ pressed }) => ({ minHeight: 40, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, backgroundColor: colors.brandSolid, paddingHorizontal: SPACE.x3, opacity: pressed ? 0.85 : 1 })}>
          <PenLine size={13} color={colors.textOnPrimary} />
          <Text style={{ ...TYPE.caption, fontWeight: "700", color: colors.textOnPrimary }}>Share</Text>
        </Pressable>
      )}
    </View>
    
    {/* Filter chips (existing) */}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 0, gap: SPACE.x2 }}>
      {FILTERS.map((item) => { /* existing filter chip code */ })}
    </ScrollView>
  </View>
}
```

**DELETE `HeroStat` component if no longer used elsewhere, or keep for right rail stats module.**

---

## Phase 6: Profile Completion Onboarding

### 6.1 Backend Migration

**File: `backend/migrations/XXX_profile_completion.sql`:**
```sql
-- Add profile completion tracking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;

-- Backfill existing complete profiles
UPDATE profiles 
SET profile_completed_at = NOW()
WHERE department_id IS NOT NULL 
  AND course_id IS NOT NULL 
  AND year_level IS NOT NULL 
  AND full_name IS NOT NULL
  AND profile_completed_at IS NULL;

-- Index for querying incomplete profiles
CREATE INDEX IF NOT EXISTS idx_profiles_incomplete ON profiles (profile_completed_at) WHERE profile_completed_at IS NULL;
```

### 6.2 Backend Middleware

**File: `backend/middleware/requireCompleteProfile.js` (NEW):**
```javascript
const requireCompleteProfile = (req, res, next) => {
  const profile = req.profile; // Set by loadProfile middleware
  
  if (!profile) {
    return res.status(401).json({ error: "Authentication required", code: "unauthenticated" });
  }
  
  if (!profile.profile_completed_at) {
    return res.status(403).json({
      error: "Complete your profile to access this feature",
      code: "profile_incomplete",
      required_fields: ["department_id", "course_id", "year_level", "full_name"].filter(
        (field) => !profile[field]
      ),
    });
  }
  
  next();
};

module.exports = { requireCompleteProfile };
```

### 6.3 Apply Middleware to Write Endpoints

**Files to modify:**
- `backend/routes/postRouter.js` - POST `/api/posts`
- `backend/routes/messageRouter.js` - POST `/api/conversations`, POST `/api/messages`
- `backend/routes/thesisRouter.js` - POST `/api/theses`
- `backend/routes/friendRouter.js` - POST `/api/friends/request`

**Example - `postRouter.js`:**
```javascript
const { requireCompleteProfile } = require("../middleware/requireCompleteProfile");

router.post("/", requireAuth, loadProfile, requireActiveAccount, requireCompleteProfile, createPost);
```

### 6.4 Frontend AuthContext

**File: `frontend/src/contexts/AuthContext.tsx` - ADD:**
```typescript
// In AuthContextType:
profileComplete: boolean;
checkProfileComplete: () => Promise<void>;

// In Provider:
const [profileComplete, setProfileComplete] = useState(false);

const checkProfileComplete = useCallback(async () => {
  if (!profile) { setProfileComplete(false); return; }
  const complete = !!profile.profile_completed_at;
  setProfileComplete(complete);
}, [profile]);

// Call in loadProfile effect
useEffect(() => { void checkProfileComplete(); }, [checkProfileComplete]);
```

### 6.5 ProfileCompletionModal Component (NEW)

**File: `frontend/src/components/ProfileCompletionModal.tsx`:**
```tsx
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { ArrowRight, X, User, School, Award, Pen } from "lucide-react-native";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";
import { useTheme } from "../contexts/ThemeContext";
import { SPACE, RADIUS, TYPE, elevation } from "../lib/tokens";

type Props = { visible: boolean; onComplete: () => void; onSkip: () => void };

export default function ProfileCompletionModal({ visible, onComplete, onSkip }: Props) {
  const { profile, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    department_id: profile?.department_id || "",
    course_id: profile?.course_id || "",
    year_level: profile?.year_level || "",
    bio: "",
  });
  const [departments, setDepartments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) { fetchCatalog(); }
  }, [visible]);

  const fetchCatalog = async () => {
    try {
      const [deptRes, courseRes] = await Promise.all([
        apiFetch("/public/departments"),
        apiFetch("/public/courses"),
      ]);
      if (deptRes.ok) setDepartments(await deptRes.json());
      if (courseRes.ok) setCourses(await courseRes.json());
    } catch {}
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await refreshProfile();
        onComplete();
      }
    } catch {}
    setLoading(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "center" }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1, marginHorizontal: SPACE.x4, justifyContent: "center" }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.xxl, padding: SPACE.x5, ...elevation("xl", colors) }}>
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.x3 }}>
              <Text style={{ ...TYPE.h2, fontSize: 20, color: colors.ink }}>Complete Your Profile</Text>
              <TouchableOpacity onPress={onSkip} style={{ padding: 4 }}>
                <X size={20} color={colors.inkFaint} />
              </TouchableOpacity>
            </View>

            {/* Progress indicator */}
            <View style={{ flexDirection: "row", gap: 4, marginBottom: SPACE.x4 }}>
              {[1, 2, 3].map((n) => (
                <View key={n} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: n <= step ? colors.brand : colors.border }} />
              ))}
            </View>

            {/* Step 1: Basic Info */}
            {step === 1 && (
              <View style={{ gap: SPACE.x3 }}>
                <Text style={{ ...TYPE.bodyStrong, color: colors.ink }}>Basic Information</Text>
                <TextInput
                  placeholder="Full Name"
                  value={form.full_name}
                  onChangeText={(v) => setForm({ ...form, full_name: v })}
                  style={{ ...TYPE.input, paddingHorizontal: SPACE.x3, paddingVertical: SPACE.x2, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, backgroundColor: colors.panel, color: colors.ink }}
                />
                <TouchableOpacity onPress={() => setForm({ ...form, full_name: form.full_name })} disabled={!form.full_name.trim()} style={{ ...styles.nextButton, opacity: form.full_name.trim() ? 1 : 0.5 }}>
                  <Text style={{ color: colors.textOnPrimary, fontWeight: "700" }}>Continue</Text>
                  <ArrowRight size={16} color={colors.textOnPrimary} />
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Academic */}
            {step === 2 && (
              <View style={{ gap: SPACE.x3 }}>
                <Text style={{ ...TYPE.bodyStrong, color: colors.ink }}>Academic Details</Text>
                <View style={{ gap: SPACE.x2 }}>
                  <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>Department</Text>
                  <TouchableOpacity style={{ ...TYPE.input, paddingHorizontal: SPACE.x3, paddingVertical: SPACE.x2, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, backgroundColor: colors.panel }}>
                    <Text style={{ color: form.department_id ? colors.ink : colors.inkFaint }}>
                      {departments.find(d => d.id === form.department_id)?.name || "Select department"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: SPACE.x2 }}>
                  <Text style={{ ...TYPE.caption, color: colors.inkFaint }}>Course</Text>
                  <TouchableOpacity style={{ ...TYPE.input, paddingHorizontal: SPACE.x3, paddingVertical: SPACE.x2, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, backgroundColor: colors.panel }}>
                    <Text style={{ color: form.course_id ? colors.ink : colors.inkFaint }}>
                      {courses.find(c => c.id === form.course_id)?.name || "Select course"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  placeholder="Year Level (e.g., 1st Year, 2nd Year)"
                  value={form.year_level}
                  onChangeText={(v) => setForm({ ...form, year_level: v })}
                  style={{ ...TYPE.input, paddingHorizontal: SPACE.x3, paddingVertical: SPACE.x2, borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, backgroundColor: colors.panel, color: colors.ink }}
                />
                <TouchableOpacity disabled={!form.department_id || !form.course_id || !form.year_level.trim()} style={{ ...styles.nextButton, opacity: (form.department_id && form.course_id && form.year_level.trim()) ? 1 : 0.5 }}>
                  <Text style={{ color: colors.textOnPrimary, fontWeight: "700" }}>Finish</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Skip button */}
            <TouchableOpacity onPress={onSkip} style={{ marginTop: SPACE.x3, alignItems: "center" }}>
              <Text style={{ ...TYPE.caption, fontWeight: "600", color: colors.inkFaint }}>Skip for now (limited access)</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: SPACE.x2,
    borderRadius: RADIUS.md,
    backgroundColor: colors.brandSolid,
  },
});
```

### 6.6 Integration Hook

**File: `frontend/src/hooks/useProfileCompletion.ts` (NEW):**
```typescript
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";

export function useProfileCompletion() {
  const { profile, profileComplete, checkProfileComplete } = useAuth();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (profile && !profileComplete && !showModal) {
      setShowModal(true);
    }
  }, [profile, profileComplete]);

  const handleComplete = () => {
    setShowModal(false);
  };

  const handleSkip = () => {
    // Mark as "skipped" locally so we don't nag every session
    // Could store in AsyncStorage with timestamp
    setShowModal(false);
  };

  return { showModal, onComplete: handleComplete, onSkip: handleSkip };
}
```

### 6.7 Integrate in HomeScreen

**File: `frontend/app/(tabs)/index.tsx`:**
```tsx
import { useProfileCompletion } from "../../src/hooks/useProfileCompletion";
import ProfileCompletionModal from "../../src/components/ProfileCompletionModal";

// In component:
const { showModal, onComplete, onSkip } = useProfileCompletion();

// In return, before closing View:
<ProfileCompletionModal visible={showModal} onComplete={onComplete} onSkip={onSkip} />
```

---

## Phase 7: Right Rail Cleanup

**File: `frontend/app/(tabs)/index.tsx`**

**DELETE lines 926-978** (Deposit manuscript card)

**DELETE lines 980-1016** (Academic deadlines card)

**KEEP lines 1018-1095** (Campus peers) - but will be replaced by RightRail module system in Phase 3.2

---

## Phase 8: Responsiveness Audit

### 8.1 Breakpoint Verification Checklist

| Breakpoint | File | Component | Test |
|------------|------|-----------|------|
| `< 380` | `HomeHeader.tsx:80` | `compact` | Header text truncation |
| `< 480` | `index.tsx:229` | `compact` | Hero stats, filter chips scroll |
| `< 768` | `_layout.tsx:161` | `isDesktopWeb` | Mobile tab bar, no rails |
| `< 1120` | `_layout.tsx:162` | `compactNav` | Top bar icons only |
| `< 1200` | `index.tsx:227` | `isDesktopWeb` | Left rail appears |
| `< 1320` | `_layout.tsx:163` | `compactActions` | Admin button icon-only |
| `< 1600` | `index.tsx:228` | `isWideWeb` | Wide rail widths |

### 8.2 Specific Fixes

**PeerPicker Modal - `PeerPicker.tsx` line 119:**
```tsx
// ADD maxWidth for desktop
style={{
  backgroundColor: colors.surface,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  maxHeight: "85%",
  paddingBottom: 12,
  maxWidth: 520, // ADD
  alignSelf: "center", // ADD for desktop
}}
```

**SettingsSidebar - `SettingsSidebar.tsx` line 44-47:**
```tsx
// Current is correct for mobile, verify desktop
const sidebarWidth = Platform.OS === "web" && width >= 768
  ? DESKTOP_SIDEBAR_WIDTH // 360
  : Math.min(MOBILE_SIDEBAR_MAX_WIDTH, Math.round(width * MOBILE_SIDEBAR_RATIO));
```

**PostCard - `PostCard.tsx` verify max-width:**
```tsx
// Should respect feed container maxWidth (760/860)
```

---

## Phase 9: Technical Debt & Polish

### 9.1 Avatar Presence Colors

**File: `frontend/src/components/Avatar.tsx` - VERIFY:**
```tsx
// Should map mode to color:
const presenceColors = {
  online: colors.jade,
  away: colors.amber,
  busy: colors.destructive,
  invisible: colors.inkFaint,
  offline: "transparent",
};

const dotColor = mode ? presenceColors[mode] : "transparent";
```

### 9.2 Performance: Limit Peers

**File: `frontend/app/(tabs)/index.tsx` line 250:**
```tsx
// CHANGE limit from default to 20
const res = await apiFetch(`/public/peers?scope=friends&limit=20`);
```

**File: `frontend/src/components/PeerPicker.tsx` line 63:**
```tsx
// CHANGE limit from 100 to 50
const params = ["limit=50", "scope=network"];
```

### 9.3 Accessibility

**Verify all icon-only buttons have `accessibilityLabel`:**
- `_layout.tsx` webCreateButton ✓
- `_layout.tsx` webAdminButton ✓
- `_layout.tsx` webIconButton (theme toggle) ✓
- `HomeHeader.tsx` IconButtons ✓
- `PeerPicker.tsx` handleMessage/handleAdd buttons - ADD labels

---

## File Change Summary

### Backend (6 files)
| File | Action |
|------|--------|
| `backend/migrations/XXX_profile_completion.sql` | CREATE |
| `backend/middleware/requireCompleteProfile.js` | CREATE |
| `backend/controllers/publicController.js` | MODIFY (scope, online) |
| `backend/controllers/messageController.js` | MODIFY (add previewConversation) |
| `backend/models/userModel.js` | MODIFY (add getFriends, getNetwork) |
| `backend/routes/publicRouter.js` | MODIFY (pass scope) |
| `backend/routes/postRouter.js` | MODIFY (add middleware) |
| `backend/routes/messageRouter.js` | MODIFY (add middleware) |
| `backend/routes/thesisRouter.js` | MODIFY (add middleware) |
| `backend/routes/friendRouter.js` | MODIFY (add middleware) |

### Frontend (18 files)
| File | Action |
|------|--------|
| `frontend/app/(tabs)/index.tsx` | MODIFY (hero, peers, rails) |
| `frontend/app/(tabs)/_layout.tsx` | MODIFY (header icons only) |
| `frontend/src/components/HomeHeader.tsx` | VERIFY (already icons) |
| `frontend/src/components/SettingsSidebar.tsx` | MODIFY (module manager link) |
| `frontend/src/components/PeerPicker.tsx` | MODIFY (policy, grouping) |
| `frontend/src/components/Avatar.tsx` | VERIFY (presence colors) |
| `frontend/src/components/ProfileCompletionModal.tsx` | CREATE |
| `frontend/src/components/RightRail.tsx` | CREATE |
| `frontend/src/contexts/AuthContext.tsx` | MODIFY (profileComplete) |
| `frontend/src/hooks/useProfileCompletion.ts` | CREATE |
| `frontend/src/lib/railModules.ts` | CREATE |
| `frontend/src/lib/api.ts` | MODIFY (peers params) |
| `frontend/app/messages/index.tsx` | VERIFY |
| `frontend/app/friends.tsx` | VERIFY |
| `frontend/app/(auth)/*` | VERIFY (signup flow) |

---

## Dependencies

No new npm packages required. All components use existing:
- `lucide-react-native` (icons)
- `react-native` primitives
- `expo-router` (navigation)
- `@react-native-async-storage/async-storage` (preferences)