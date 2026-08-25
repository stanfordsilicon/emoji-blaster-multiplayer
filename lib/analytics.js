"use strict";

// lib/analytics.js — persists the same events that used to only go to
// Vercel's function logs (see the console.log("[analytics] ...") calls
// throughout game-logic.js) into MongoDB, so they're queryable instead of
// scrollback.
//
// Called from API handlers AFTER a room update has committed (never from
// inside game-logic.js's mutators) -- those mutators can run more than once
// under room-store.js's CAS retry, and a Mongo write is a real side effect
// that must not happen twice for one logical event.
//
// Never allowed to break gameplay: every call is wrapped so a Mongo outage
// just means a missed analytics row, not a failed request.

const { getMongoDb } = require("./mongo-client");

const COLLECTION = "blaster_events";

async function logEvent(type, fields) {
  try {
    const db = await getMongoDb();
    await db.collection(COLLECTION).insertOne({ type, ...fields, createdAt: new Date() });
  } catch (err) {
    console.error("[analytics] failed to log event", type, err.message);
  }
}

// toggle-ready, force-start, and heartbeat can each independently trigger
// startGame() (whichever request happens to satisfy the ready/consensus
// condition first) -- game-logic.js already puts a "game-started" event at
// the front of the events array whenever that happens, so every call site
// checks for it here instead of each needing its own game-just-started
// detection.
async function logSessionStartIfPresent(room, events) {
  const started = (events || []).find((e) => e.name === "game-started");
  if (!started) return;
  await logEvent("session-start", {
    code: room.code,
    mode: started.data.mode,
    consensusLevel: started.data.consensusLevel,
    language: room.language,
    players: Object.values(room.players).map((p) => p.username),
    playerCount: Object.keys(room.players).length,
  });
}

module.exports = { logEvent, logSessionStartIfPresent };
