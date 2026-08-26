// lib/emoji-source.js — the live emoji set Blaster plays with, per Game
// Language, sourced from qmoji-2's Phase system (GET /api/emoji-rules?lang=,
// public/unauthenticated) with a cache in front of it and a hard fallback to
// the static emojiDB.js list.
//
// This runs inside spawnEmoji, which every /api handler calls on the hot
// path of starting a game or completing a round — so it must never block on
// a slow or dead qmoji-2 deployment. The cache lives in the same Upstash
// Redis room-store.js already uses (a module-level in-memory cache would
// only help while a specific serverless container stays warm; Redis is
// shared across every invocation).
//
// qmoji-2's Phase system only curates *which emoji* a language may play
// with, not keyword data for them (see EmojiPhaseRepository.js) — Blaster
// still needs a keyword per emoji to actually run Sync/Double Sync, and the
// only keyword data that exists anywhere is the static emojiDB.js list. So
// a curated set is used to *restrict* that static list down to the emoji
// both (a) an admin has actually assigned to this language's phase and (b)
// Blaster has real keywords for -- never to replace the keyword data
// itself.

const { Redis } = require("@upstash/redis");
const { EMOJI_DB: STATIC_EMOJI_DB, EMOJI_LIST: STATIC_EMOJI_LIST, SHARED_PAIRS: STATIC_SHARED_PAIRS } = require("../emojiDB");

const kv = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CACHE_KEY_PREFIX = "emoji-source:cache:";
const FRESH_TTL_MS = 60 * 1000; // reuse cached data younger than this without refetching
const FALLBACK_TTL_MS = 15 * 1000; // retry sooner after falling back, so recovery is quick
const FETCH_TIMEOUT_MS = 3000;

// Same admin origin qmoji-2's own arcade-proxy.js pattern uses: one env var
// for where "the homescreen" lives, defaulting to local dev.
const QMOJI_ADMIN_BASE_URL = process.env.QMOJI_ADMIN_BASE_URL || "http://localhost:5500";

// Pairwise shared-keyword computation is O(n^2) — fine for the 20-emoji
// static list (190 pairs), not fine if an admin curates hundreds. Cap how
// many enabled emoji get pulled into Double Sync's pairing pool; the rest
// still play fine in Sync mode, they just can't be picked for Double Sync.
const MAX_EMOJI_FOR_PAIRS = 150;

const STATIC_SOURCE = { EMOJI_DB: STATIC_EMOJI_DB, EMOJI_LIST: STATIC_EMOJI_LIST, SHARED_PAIRS: STATIC_SHARED_PAIRS };

function sharedKeywords(emojiDB, a, b) {
  const setB = new Set((emojiDB[b] || []).map((k) => k.toLowerCase()));
  return (emojiDB[a] || []).filter((k) => setB.has(k.toLowerCase()));
}

function buildSharedPairs(emojiDB, emojiList) {
  const pool = emojiList.slice(0, MAX_EMOJI_FOR_PAIRS);
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i];
      const b = pool[j];
      const shared = sharedKeywords(emojiDB, a, b);
      if (shared.length > 0) pairs.push({ a, b, shared });
    }
  }
  return pairs;
}

function buildSourceFromEmojiList(emojiList) {
  const emojiDB = {};
  for (const e of emojiList) emojiDB[e] = STATIC_EMOJI_DB[e];
  return { EMOJI_DB: emojiDB, EMOJI_LIST: emojiList, SHARED_PAIRS: buildSharedPairs(emojiDB, emojiList) };
}

// Returns null (never throws) when there's nothing usable for this
// language: no curation yet (data.emojis === null), or a curated set that
// doesn't overlap with any emoji Blaster actually has keywords for.
async function fetchFromAdmin(lang) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${QMOJI_ADMIN_BASE_URL}/api/emoji-rules?lang=${encodeURIComponent(lang)}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.ok || !Array.isArray(data.emojis)) return null;

    const usable = data.emojis.filter((e) => Object.prototype.hasOwnProperty.call(STATIC_EMOJI_DB, e));
    if (usable.length === 0) return null;

    return buildSourceFromEmojiList(usable);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCache(lang) {
  try {
    return await kv.get(CACHE_KEY_PREFIX + lang);
  } catch (err) {
    return null;
  }
}

async function writeCache(lang, entry) {
  try {
    await kv.set(CACHE_KEY_PREFIX + lang, entry);
  } catch (err) {
    // Cache is an optimization, not a correctness requirement -- a failed
    // write just means the next call refetches instead of reusing this one.
  }
}

// Returns { EMOJI_DB, EMOJI_LIST, SHARED_PAIRS } for the given Game
// Language -- either its curated set (fetched or freshly cached) or the
// static fallback if nothing's been curated for it (or qmoji-2 is
// unreachable). Never throws, never blocks longer than FETCH_TIMEOUT_MS.
// `lang` defaults to "en" so every existing call site (no language known)
// keeps working exactly as before this file became language-aware.
async function getEmojiSource(lang) {
  const key = lang || "en";
  const cached = await readCache(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < FRESH_TTL_MS) {
    return cached.source;
  }

  const fetched = await fetchFromAdmin(key);
  if (fetched) {
    await writeCache(key, { fetchedAt: now, source: fetched, isFallback: false });
    return fetched;
  }

  // Fetch failed or returned nothing usable. Reuse a still-recent cached
  // value (even one already past FRESH_TTL_MS) rather than falling all the
  // way back, since a still-live-but-slow admin source beats the static
  // list. Only fall back once there's nothing usable cached at all.
  if (cached) {
    await writeCache(key, { fetchedAt: now - FRESH_TTL_MS + FALLBACK_TTL_MS, source: cached.source, isFallback: cached.isFallback });
    return cached.source;
  }

  await writeCache(key, { fetchedAt: now - FRESH_TTL_MS + FALLBACK_TTL_MS, source: STATIC_SOURCE, isFallback: true });
  return STATIC_SOURCE;
}

module.exports = { getEmojiSource };
