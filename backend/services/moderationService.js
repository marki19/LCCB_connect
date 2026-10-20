/**
 * AI Moderation Service
 * Inspects posts, thesis titles/abstracts, and comments for hate speech,
 * foul language, harassment, and inappropriate content.
 * 
 * Free-tier engine:
 * 1. Google Gemini 1.5 Flash (via GEMINI_API_KEY if configured).
 * 2. Instant local dictionary & heuristic scanner (runs zero-latency fallback).
 */

const LOCAL_FOUL_WORDS = [
  // Profanity & foul language (English & Filipino commonly encountered)
  "gago", "tarantado", "tangina", "putangina", "bobo", "inutil",
  "pota", "ulol", "pakyu", "fuck", "shit", "bitch", "asshole",
  "cunt", "motherfucker", "dickhead", "bastard", "nigger", "nigga",
  "faggot", "kill yourself", "kys", "hate you all"
];

function localRuleScan(text) {
  if (!text || typeof text !== "string") {
    return { flagged: false, score: 0, reason: null, category: null };
  }

  const lower = text.toLowerCase();
  for (const word of LOCAL_FOUL_WORDS) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      return {
        flagged: true,
        score: 0.95,
        reason: `Flagged for inappropriate/foul term: "${word}"`,
        category: "profanity_or_harassment",
      };
    }
  }

  return { flagged: false, score: 0, reason: null, category: null };
}

async function geminiScan(text, context = "post") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null; // triggers fallback to local rule scan
  }

  const prompt = `You are an academic content moderation filter for an institutional university portal (LCCB Connect).
Evaluate the following student ${context} content for violations:
- Hate speech or identity-based attacks
- Foul/obscene language or explicit vulgarity
- Harassment, threats, or severe bullying
- Commercial spam or academic fraud

Content to evaluate:
"""${text.replace(/"/g, '\\"')}"""

Respond with valid JSON only in this format:
{
  "flagged": true or false,
  "score": number between 0.0 and 1.0 (where >= 0.7 means flagged),
  "reason": "Brief 1-sentence reason why it is flagged, or null if clean",
  "category": "hate_speech" | "foul_language" | "harassment" | "spam" | null
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!res.ok) {
      console.warn("[moderation] Gemini API request returned status:", res.status);
      return null;
    }

    const json = await res.json();
    const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) return null;

    const parsed = JSON.parse(candidateText);
    return {
      flagged: Boolean(parsed.flagged),
      score: typeof parsed.score === "number" ? parsed.score : parsed.flagged ? 0.9 : 0.0,
      reason: parsed.reason || (parsed.flagged ? "Flagged by AI moderation" : null),
      category: parsed.category || (parsed.flagged ? "policy_violation" : null),
    };
  } catch (err) {
    console.warn("[moderation] Gemini API call failed, using local scanner:", err.message);
    return null;
  }
}

async function scanText(input, context = "post") {
  const text = typeof input === "string" ? input : (input?.content || input?.text || (input ? String(input) : ""));
  if (!text || !text.trim()) {
    return { flagged: false, score: 0, reason: null, category: null };
  }

  // 1. Try Gemini API first if available
  const aiResult = await geminiScan(text, context);
  if (aiResult) {
    return aiResult;
  }

  // 2. Fall back to local rule-based heuristic scanner
  return localRuleScan(text);
}

async function scanPost(post = {}) {
  const title = post.title || "";
  const content = post.content || "";
  const combined = [title, content].filter(Boolean).join("\n\n");
  return scanText(combined, "post/broadcast");
}

async function scanComment(input) {
  const text = typeof input === "string" ? input : (input?.content || input?.text || "");
  return scanText(text, "discussion comment");
}

async function scanThesis({ title, abstract }) {
  const combined = [title, abstract].filter(Boolean).join("\n\n");
  return scanText(combined, "thesis manuscript");
}

module.exports = {
  scanText,
  scanPost,
  scanComment,
  scanThesis,
  localRuleScan,
};
