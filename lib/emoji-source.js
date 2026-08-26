// lib/emoji-source.js — the live emoji set Blaster plays with, sourced from
// qmoji-2's per-language "Emoji Phases" admin system (GET
// /api/emoji-rules?lang=<code>, public/unauthenticated, CORS-open) with a
// cache in front of it and a hard fallback to a small static list.
//
// That endpoint returns emojis: null when a language has no admin
// assignment yet, vs. an empty array when it's assigned but genuinely has
// nothing curated -- qmoji-2's own docs ask callers not to silently
// conflate those. We still fall back to the static list in both cases
// here, since Blaster has to show *something* to keep a room playable
// either way; the distinction just isn't meaningful on this side.
//
// Blaster doesn't use stored keywords at all anymore -- the whole point of
// the game is to generate that data by watching what players agree on, not
// check them against a dictionary (see game-logic.js's handleSyncGuess). So
// this only ever needs a flat list of emoji glyphs, nothing else.
//
// This runs inside spawnEmoji, which every /api handler calls on the hot
// path of starting a game or completing a round — so it must never block on
// a slow or dead qmoji-2 deployment. The cache lives in the same Upstash
// Redis room-store.js already uses (a module-level in-memory cache would
// only help while a specific serverless container stays warm; Redis is
// shared across every invocation). Phases are per-language, so the cache is
// keyed per-language too -- different rooms can be on different languages
// at once.

const { Redis } = require("@upstash/redis");

const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const FRESH_TTL_MS = 60 * 1000; // reuse cached data younger than this without refetching
const FALLBACK_TTL_MS = 15 * 1000; // retry sooner after falling back, so recovery is quick
const FETCH_TIMEOUT_MS = 3000;
const DEFAULT_LANGUAGE = "en";

// Same admin origin qmoji-2's own arcade-proxy.js pattern uses: one env var
// for where "the homescreen" lives, defaulting to local dev.
const QMOJI_ADMIN_BASE_URL = process.env.QMOJI_ADMIN_BASE_URL || "http://localhost:5500";

// Last-resort list if qmoji-2 is unreachable and nothing is cached yet --
// just enough to keep the game playable, not meant to be curated.
const STATIC_FALLBACK_EMOJI = [
  "🤣", "😘", "👏", "😳", "😎", "👌", "💪", "😏", "💯", "😜",
  "😐", "😇", "💰", "😑", "💩", "👋", "🌈", "👊", "🥹", "😙",
];

function cacheKey(language) {
  return `emoji-source:cache:${language}`;
}

async function fetchFromAdmin(language) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${QMOJI_ADMIN_BASE_URL}/api/emoji-rules?lang=${encodeURIComponent(language)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.ok || !Array.isArray(data.emojis) || data.emojis.length === 0) return null;
    return { EMOJI_LIST: data.emojis };
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(language) {
  try {
    return await kv.get(cacheKey(language));
  } catch (err) {
    return null;
  }
}

async function writeCache(language, entry) {
  try {
    await kv.set(cacheKey(language), entry);
  } catch (err) {
    // Cache is an optimization, not a correctness requirement -- a failed
    // write just means the next call refetches instead of reusing this one.
  }
}

// Returns { EMOJI_LIST } -- either the live admin-curated set for this
// language (fetched or freshly cached) or the static fallback. Never
// throws, never blocks longer than FETCH_TIMEOUT_MS.
async function getEmojiSource(language) {
  const lang = language || DEFAULT_LANGUAGE;
  const cached = await readCache(lang);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < FRESH_TTL_MS) {
    return cached.source;
  }

  const fetched = await fetchFromAdmin(lang);
  if (fetched) {
    await writeCache(lang, { fetchedAt: now, source: fetched, isFallback: false });
    return fetched;
  }

  // Fetch failed or returned nothing usable. Reuse a still-recent cached
  // value (even one already past FRESH_TTL_MS) rather than falling all the
  // way back, since a still-live-but-slow admin source beats the static
  // list. Only fall back once there's nothing usable cached at all.
  if (cached) {
    await writeCache(lang, { fetchedAt: now - FRESH_TTL_MS + FALLBACK_TTL_MS, source: cached.source, isFallback: cached.isFallback });
    return cached.source;
  }

  const fallback = { EMOJI_LIST: STATIC_FALLBACK_EMOJI };
  await writeCache(lang, { fetchedAt: now - FRESH_TTL_MS + FALLBACK_TTL_MS, source: fallback, isFallback: true });
  return fallback;
}

module.exports = { getEmojiSource };
