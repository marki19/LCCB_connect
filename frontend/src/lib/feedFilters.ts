export type FeedFilterItem = {
  kind?: string | null;
  post_kind?: string | null;
  repository_type?: string | null;
  type?: string | null;
  previewUrl?: string | null;
  preview_metadata?: any;
};

/**
 * Determines whether a post or feed item matches the active feed category filter.
 * Centralizes all kind, repository_type, and legacy type checks.
 */
export function matchesFeedFilter(item: FeedFilterItem, filter: string): boolean {
  if (!filter || filter === "all") return true;

  const effectiveKind = item.post_kind || item.kind;
  const effectiveRepoType = item.repository_type;

  switch (filter) {
    case "projects":
      if (effectiveKind === "repository") {
        return effectiveRepoType === "project" || effectiveRepoType === "capstone";
      }
      return item.type === "project" || item.type === "capstone";

    case "theses":
      if (effectiveKind === "repository") {
        return effectiveRepoType === "thesis";
      }
      return item.type === "thesis";

    case "websites":
      return item.type === "website" || Boolean(item.previewUrl || item.preview_metadata);

    case "discussions":
      if (effectiveKind === "repository") return false;
      if (effectiveKind === "discussion") return true;
      return (
        item.type === "discussion" ||
        item.type === "text" ||
        item.type === "image" ||
        item.type === "website" ||
        !item.type
      );

    case "announcements":
      return effectiveKind === "announcement" || item.type === "announcement";

    default:
      return true;
  }
}
