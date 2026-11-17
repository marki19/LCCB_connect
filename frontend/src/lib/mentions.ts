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

/**
 * Splits text into segments, identifying known mentions from the given mentions list.
 */
export function renderMentions(
  text: string,
  mentions?: MentionToken[]
): MentionSegment[] {
  if (!text) return [];
  if (!mentions || mentions.length === 0) {
    return [{ text }];
  }

  const mentionMap = new Map<string, MentionToken>();
  for (const m of mentions) {
    if (m.username) {
      mentionMap.set(m.username.toLowerCase(), m);
    }
  }

  if (mentionMap.size === 0) {
    return [{ text }];
  }

  const segments: MentionSegment[] = [];
  const re = /(?:^|[^\w])@([a-z0-9._]{3,30})/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const fullMatch = match[0];
    const username = match[1];
    const usernameLower = username.toLowerCase();
    const token = mentionMap.get(usernameLower);

    const atIndex =
      match.index + (fullMatch.startsWith("@") ? 0 : fullMatch.indexOf("@"));

    if (token) {
      if (atIndex > lastIndex) {
        segments.push({ text: text.slice(lastIndex, atIndex) });
      }
      segments.push({
        text: `@${username}`,
        username: token.username,
        user_id: token.user_id || token.id,
      });
      lastIndex = atIndex + 1 + username.length;
    }
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
