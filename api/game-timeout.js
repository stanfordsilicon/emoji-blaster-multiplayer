// POST /api/game-timeout — sync mode only. Called by a client's local
// countdown when the room's 60s game clock appears to have run out.
// Idempotent, same pattern as round-timeout — goes through updateRoom's CAS
// retry since every connected client calls this independently.

const { updateRoom } = require("../lib/room-store");
const { resolveGameTimeout } = require("../lib/game-logic");
const { publish } = require("../lib/pusher");
const { logEvent } = require("../lib/analytics");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code: rawCode } = req.body || {};
  const code = (rawCode || "").toUpperCase().trim();
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  const { room, result: events } = await updateRoom(code, (r) => resolveGameTimeout(r));

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  if (events) {
    await publish(code, events);
    const gameOver = events.find((e) => e.name === "game-over");
    if (gameOver) {
      await logEvent("session-end", {
        code,
        teamScore: gameOver.data.teamScore,
        players: Object.values(room.players).map((p) => ({ username: p.username, score: p.score })),
      });
    }
  }
  res.status(200).json({ ok: true, resolved: !!events });
};
