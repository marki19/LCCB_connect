// Vitest setup file — runs before each test file
import { vi } from "vitest";

// Define __DEV__ global for Expo/React Native modules
globalThis.__DEV__ = true;

// Mock react-native modules that don't work in jsdom
vi.mock("react-native", () => ({
  Platform: { OS: "web", select: (obj) => obj.web },
  NativeModules: {},
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  Keyboard: { dismiss: vi.fn() },
  AccessibilityInfo: { isScreenReaderEnabled: vi.fn().mockResolvedValue(false) },
  Appearance: { getColorScheme: vi.fn().mockReturnValue("light") },
  Dimensions: { get: vi.fn().mockReturnValue({ width: 375, height: 812 }) },
  PixelRatio: { get: vi.fn().mockReturnValue(2) },
  AppState: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    currentState: "active",
  },
  // Basic components as simple DOM elements for jsdom
  View: ({ children, testID, ...props }) => {
    const div = document.createElement("div");
    if (testID) div.setAttribute("data-testid", testID);
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") div.setAttribute(key, value);
    });
    if (typeof children === "string") div.textContent = children;
    else if (Array.isArray(children)) children.forEach((c) => div.appendChild(c));
    else if (children) div.appendChild(children);
    return div;
  },
  Text: ({ children, testID, ...props }) => {
    const span = document.createElement("span");
    if (testID) span.setAttribute("data-testid", testID);
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") span.setAttribute(key, value);
    });
    if (typeof children === "string") span.textContent = children;
    else if (Array.isArray(children)) children.forEach((c) => span.appendChild(c));
    else if (children) span.appendChild(children);
    return span;
  },
  Button: ({ title, onPress, testID, ...props }) => {
    const button = document.createElement("button");
    if (testID) button.setAttribute("data-testid", testID);
    button.textContent = title;
    button.onclick = onPress;
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "title" && key !== "onPress") button.setAttribute(key, value);
    });
    return button;
  },
  TouchableOpacity: ({ children, onPress, testID, ...props }) => {
    const div = document.createElement("div");
    if (testID) div.setAttribute("data-testid", testID);
    div.onclick = onPress;
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children" && key !== "onPress") div.setAttribute(key, value);
    });
    if (typeof children === "string") div.textContent = children;
    else if (Array.isArray(children)) children.forEach((c) => div.appendChild(c));
    else if (children) div.appendChild(children);
    return div;
  },
  ScrollView: ({ children, ...props }) => {
    const div = document.createElement("div");
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") div.setAttribute(key, value);
    });
    if (typeof children === "string") div.textContent = children;
    else if (Array.isArray(children)) children.forEach((c) => div.appendChild(c));
    else if (children) div.appendChild(children);
    return div;
  },
  TextInput: ({ testID, ...props }) => {
    const input = document.createElement("input");
    if (testID) input.setAttribute("data-testid", testID);
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") input.setAttribute(key, value);
    });
    return input;
  },
  Image: ({ testID, ...props }) => {
    const img = document.createElement("img");
    if (testID) img.setAttribute("data-testid", testID);
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") img.setAttribute(key, value);
    });
    return img;
  },
  SafeAreaView: ({ children, ...props }) => {
    const div = document.createElement("div");
    Object.entries(props).forEach(([key, value]) => {
      if (key !== "children") div.setAttribute(key, value);
    });
    if (typeof children === "string") div.textContent = children;
    else if (Array.isArray(children)) children.forEach((c) => div.appendChild(c));
    else if (children) div.appendChild(children);
    return div;
  },
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => style,
  },
}));

// Mock expo modules
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn().mockResolvedValue(null),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children, href }) => {
    const a = document.createElement('a');
    a.href = href;
    if (typeof children === 'string') {
      a.textContent = children;
    } else if (children) {
      a.appendChild(children);
    }
    return a;
  },
}));

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }) => children,
}));

vi.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: vi.fn().mockResolvedValue({ canceled: true }),
  launchCameraAsync: vi.fn().mockResolvedValue({ canceled: true }),
  MediaTypeOptions: "Images",
}));

vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn().mockResolvedValue({ canceled: true }),
}));

vi.mock("expo-blob", () => ({}));

vi.mock("expo-constants", () => ({
  expoConfig: { extra: { eas: { projectId: "test-project-id" } } },
  easConfig: { projectId: "test-project-id" },
  manifest: {},
  manifest2: {},
}));

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  requestPermissionsAsync: vi.fn().mockResolvedValue({ granted: true }),
  getExpoPushTokenAsync: vi.fn().mockResolvedValue({ data: "test-token" }),
  setNotificationChannelAsync: vi.fn().mockResolvedValue(undefined),
  setNotificationHandler: vi.fn(),
  addPushTokenListener: vi.fn(() => ({ remove: vi.fn() })),
  addNotificationResponseReceivedListener: vi.fn(() => ({ remove: vi.fn() })),
  getLastNotificationResponse: vi.fn().mockResolvedValue(null),
  NotificationPermissionsStatus: {},
  IosAuthorizationStatus: { PROVISIONAL: "provisional" },
  AndroidImportance: { MAX: "max" },
}));

vi.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.default.call = () => {};
  return Reanimated;
});

vi.mock("lucide-react-native", () => {
  const components = [
    "AlertCircle", "Sun", "Moon", "Monitor", "Mail", "Lock", "User", "Eye", "EyeOff",
    "CheckCircle", "XCircle", "Loader2", "ArrowLeft", "Menu", "X", "Bell",
    "MessageSquare", "Settings", "LogOut", "ChevronDown", "ChevronUp", "Search",
    "Filter", "MoreVertical", "Edit", "Trash2", "Plus", "Share2", "Download",
    "Upload", "Link", "ExternalLink", "Copy", "Clipboard", "Image", "FileText",
    "Video", "Music", "Archive", "Flag", "Ban", "Shield", "UserCheck", "UserX",
    "Users", "UserPlus", "UserMinus", "Activity", "Heart", "Star", "Bookmark",
    "Tag", "Calendar", "Clock", "MapPin", "Globe", "Wifi", "WifiOff", "Battery",
    "Signal", "Bluetooth", "Camera", "Mic", "MicOff", "Volume2", "VolumeX",
    "Play", "Pause", "SkipBack", "SkipForward", "FastForward", "Rewind",
    "Repeat", "Shuffle", "Zap", "RefreshCw", "RotateCcw", "Home", "LayoutDashboard",
    "Settings2", "HelpCircle", "Info", "AlertTriangle", "Check", "X", "PlusCircle",
    "MinusCircle", "Circle", "Square", "Triangle", "Hexagon", "Octagon", "Diamond",
    "Pentagon", "Star", "Award", "Trophy", "Medal", "Crown", "Gem", "Sparkles",
    "MagicWand", "Wand2", "Sparkle", "Flame", "Lightning", "Cloud", "CloudRain",
    "CloudSnow", "CloudLightning", "CloudDrizzle", "Sun", "Moon", "CloudSun",
    "CloudMoon", "Wind", "Droplets", "Snowflake", "Thermometer", "Compass",
    "Navigation", "Map", "MapPin", "Route", "Locate", "Target", "Crosshair",
    "ZoomIn", "ZoomOut", "Maximize", "Minimize", "Fullscreen", "Minimize2",
    "Expand", "CornerUpLeft", "CornerUpRight", "CornerDownLeft", "CornerDownRight",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUpLeft", "ArrowUpRight",
    "ArrowDownLeft", "ArrowDownRight", "ArrowUpFromLine", "ArrowDownToLine",
    "ArrowLeftFromLine", "ArrowRightToLine", "Move", "MoveUp", "MoveDown",
    "MoveLeft", "MoveRight", "GripVertical", "GripHorizontal", "Grip", "Resize",
    "RotateCw", "RotateCcw", "FlipHorizontal", "FlipVertical", "AlignLeft",
    "AlignCenter", "AlignRight", "AlignJustify", "Indent", "Outdent", "List",
    "ListOrdered", "ListTodo", "ListMusic", "ListVideo", "ListChecks", "Layout",
    "LayoutDashboard", "LayoutGrid", "LayoutList", "LayoutTemplate", "Grid",
    "Grid2x2", "Grid3x3", "Table", "Table2", "TableProperties", "TableCellsMerge",
    "TableCellsSplit", "TableColumns", "TableRows", "TablePlus", "TableMinus",
    "TableDelete", "TableEdit", "TableSearch", "TableFilter", "TableSort",
    "TableExport", "TableImport", "TablePrint", "TableShare", "TableDownload",
    "TableUpload", "TableSync", "TableRefresh", "TableSettings", "TableHelp",
    "TableInfo", "TableAlert", "TableError", "TableSuccess", "TableWarning",
    "TableQuestion", "TableCheck", "TableX", "TablePlusCircle", "TableMinusCircle",
    "TableXCircle", "TableCheckCircle", "TableAlertCircle", "TableErrorCircle",
    "TableSuccessCircle", "TableWarningCircle", "TableQuestionCircle",
    "TableInfoCircle", "TableHelpCircle", "TableSettingsCircle", "TablePrintCircle",
    "TableShareCircle", "TableDownloadCircle", "TableUploadCircle", "TableSyncCircle",
    "TableRefreshCircle", "TableEditCircle", "TableDeleteCircle",
    "TableColumnsCircle", "TableRowsCircle", "TablePropertiesCircle",
    "TableCellsMergeCircle", "TableCellsSplitCircle", "TablePlusCircle2",
    "TableMinusCircle2", "TableXCircle2", "TableCheckCircle2", "TableAlertCircle2",
    "TableErrorCircle2", "TableSuccessCircle2", "TableWarningCircle2",
    "TableQuestionCircle2", "TableInfoCircle2", "TableHelpCircle2",
    "TableSettingsCircle2", "TablePrintCircle2", "TableShareCircle2",
    "TableDownloadCircle2", "TableUploadCircle2", "TableSyncCircle2",
    "TableRefreshCircle2", "TableEditCircle2", "TableDeleteCircle2",
    "TableColumnsCircle2", "TableRowsCircle2", "TablePropertiesCircle2",
    "TableCellsMergeCircle2", "TableCellsSplitCircle2", "TablePlusCircle3",
    "TableMinusCircle3", "TableXCircle3", "TableCheckCircle3",
    "TableAlertCircle3", "TableErrorCircle3", "TableSuccessCircle3",
    "TableWarningCircle3", "TableQuestionCircle3", "TableInfoCircle3",
    "TableHelpCircle3", "TableSettingsCircle3", "TablePrintCircle3",
    "TableShareCircle3", "TableDownloadCircle3", "TableUploadCircle3",
    "TableSyncCircle3", "TableRefreshCircle3", "TableEditCircle3",
    "TableDeleteCircle3", "TableColumnsCircle3", "TableRowsCircle3",
    "TablePropertiesCircle3", "TableCellsMergeCircle3", "TableCellsSplitCircle3",
  ];
  const mockComponents = {};
  for (const name of components) {
    mockComponents[name] = ({ size = 24, color = "currentColor", ...props }) => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", size);
      svg.setAttribute("height", size);
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", color);
      svg.setAttribute("stroke-width", "2");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");
      return svg;
    };
  }
  return mockComponents;
});

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      setSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn(),
  })),
}));

// Mock @testing-library/react-native to avoid Flow syntax issues
vi.mock("@testing-library/react-native", async () => {
  const actual = await vi.importActual("@testing-library/react-native");
  return {
    ...actual,
    render: vi.fn(),
    screen: {},
  };
});

// Mock react-native-safe-area-context
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
}));

// Mock @react-native-async-storage/async-storage
vi.mock("@react-native-async-storage/async-storage", () => ({
  getItem: vi.fn().mockResolvedValue(null),
  setItem: vi.fn().mockResolvedValue(undefined),
  removeItem: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
  getAllKeys: vi.fn().mockResolvedValue([]),
  multiGet: vi.fn().mockResolvedValue([]),
  multiSet: vi.fn().mockResolvedValue(undefined),
  multiRemove: vi.fn().mockResolvedValue(undefined),
}));

// Mock react-native-svg
vi.mock("react-native-svg", () => {
  const createSvgElement = (tag) => (props) => {
    const { children, ...rest } = props;
    const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(rest).forEach(([key, value]) => el.setAttribute(key, value));
    if (children) el.appendChild(typeof children === "string" ? document.createTextNode(children) : children);
    return el;
  };
  return {
    Svg: createSvgElement("svg"),
    Rect: createSvgElement("rect"),
    Circle: createSvgElement("circle"),
    Path: createSvgElement("path"),
    G: createSvgElement("g"),
  };
});

// Silence console.error in tests unless explicitly needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.("Warning: ReactDOM.render is no longer supported")) return;
    if (args[0]?.includes?.("act(...)" )) return;
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});