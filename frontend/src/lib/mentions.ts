export interface MentionToken {
  username: string;
  user_id?: string;
  id?: string;
  full_name?: string;
}

export interface MentionSegment {
  text: string;
  username?: string;
  user_id?: string;
  url?: string;
}

/**
 * Checks if the caret is currently touching an @handle mention query.
 * Returns { query, start } where start is the index of '@', or null.
 */
export function mentionQueryAt(
  text: string,
  caret: number
): { query: string; start: number } | null {
  if (typeof text !== "string" || caret < 0 || caret > text.length) {
    return null;
  }

  const prefix = text.slice(0, caret);
  const lastAt = prefix.lastIndexOf("@");
  if (lastAt === -1) return null;

  // If there's a space or newline between '@' and caret, not an active mention query
  const sub = prefix.slice(lastAt + 1);
  if (/[\s\r\n]/.test(sub)) {
    return null;
  }

  // If '@' is preceded by a word character (e.g. test@example.com), ignore
  if (lastAt > 0 && /\w/.test(prefix[lastAt - 1])) {
    return null;
  }

  // Must match valid username characters (letters, numbers, dot, underscore)
  if (sub.length > 0 && !/^[a-z0-9._]+$/i.test(sub)) {
    return null;
  }

  return { query: sub, start: lastAt };
}

interface MatchCandidate {
  start: number;
  end: number;
  type: "mention" | "url";
  text: string;
  username?: string;
  user_id?: string;
  url?: string;
}

/**
 * Splits text into segments, identifying known mentions and web links.
 * URLs (http, https, www) are extracted with cleaned trailing punctuation.
 */
export function renderMentions(
  text: string,
  mentions?: MentionToken[]
): MentionSegment[] {
  if (!text) return [];

  const mentionMap = new Map<string, MentionToken>();
  if (mentions && mentions.length > 0) {
    for (const m of mentions) {
      if (m.username) {
        mentionMap.set(m.username.toLowerCase(), m);
      }
    }
  }

  const matches: MatchCandidate[] = [];

  // 1. Find URLs (http://, https://, www.)
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>()]+(?:\([^\s<>()]*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/gi;
  let urlMatch: RegExpExecArray | null;
  while ((urlMatch = urlRegex.exec(text)) !== null) {
    const raw = urlMatch[0];
    const cleanUrl = raw.startsWith("www.") ? `https://${raw}` : raw;
    matches.push({
      start: urlMatch.index,
      end: urlMatch.index + raw.length,
      type: "url",
      text: raw,
      url: cleanUrl,
    });
  }

  // 2. Find Mentions (@username)
  if (mentionMap.size > 0) {
    const mentionRegex = /(?:^|[^\w])@([a-z0-9._]{3,30})/gi;
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionRegex.exec(text)) !== null) {
      const fullMatch = mentionMatch[0];
      const username = mentionMatch[1];
      const usernameLower = username.toLowerCase();
      const token = mentionMap.get(usernameLower);

      if (token) {
        const atIndex =
          mentionMatch.index + (fullMatch.startsWith("@") ? 0 : fullMatch.indexOf("@"));
        matches.push({
          start: atIndex,
          end: atIndex + 1 + username.length,
          type: "mention",
          text: `@${username}`,
          username: token.username,
          user_id: token.user_id || token.id,
        });
      }
    }
  }

  if (matches.length === 0) {
    return [{ text }];
  }

  // Sort by start index ascending
  matches.sort((a, b) => a.start - b.start);

  const segments: MentionSegment[] = [];
  let cursor = 0;

  for (const item of matches) {
    // Avoid overlaps
    if (item.start < cursor) continue;

    if (item.start > cursor) {
      segments.push({ text: text.slice(cursor, item.start) });
    }

    if (item.type === "url") {
      segments.push({ text: item.text, url: item.url });
    } else {
      segments.push({
        text: item.text,
        username: item.username,
        user_id: item.user_id,
      });
    }

    cursor = item.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}
