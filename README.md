# Emoji Blaster

A typing party game: type a word for the falling emoji before it lands, in
sync with your team. There's no stored "correct answer" for any emoji —
the point of the game is to generate that word data, not check guesses
against a dictionary. Everyone types freely, and an emoji clears once
enough distinct players have independently typed the *same word as each
other*; only those matching players score. The room races a 60s clock
together, not each other. Runs entirely on Vercel: a static single-page
frontend plus a set of serverless functions backed by Redis (room state),
Pusher Channels (realtime broadcast), and MongoDB (gameplay analytics).

## Why serverless + Redis + Pusher, not a Socket.io server

The original multiplayer server was a single long-running Express +
Socket.io process holding all room state in memory. That works on a
platform like Render (one persistent process), but not on Vercel, whose
functions are stateless and short-lived — no shared memory between
requests, no long-lived WebSocket. Room state now lives in Redis (shared
across every function invocation) and realtime updates go out over Pusher
Channels instead of a socket connection.

## What's in here

```
lib/
  room-store.js      ← Redis read/write/prune helpers for room state, atomic
                         compare-and-swap via a Lua script (see note below)
  game-logic.js       ← pure game rules — spawning, consensus matching, scoring
  emoji-source.js       ← fetches the live per-language emoji set from
                            qmoji-2's admin panel, Redis-cached, falls back
                            to a small static list if qmoji-2 is unreachable
  mongo-client.js         ← cached MongoDB connection (mirrors qmoji-2's)
  analytics.js               ← logs gameplay events to MongoDB, never blocks
                                 or fails a request if Mongo is down
  pusher.js                    ← shared Pusher server SDK instance + publish helper
api/
  config.js          ← GET: public Pusher key/cluster for the client
  create-room.js      ← POST: create a room
  join-room.js         ← POST: join a room
  toggle-ready.js       ← POST: ready up / cancel ready
  force-start.js         ← POST: start the game once enough players are in,
                             even if not everyone's readied up
  set-consensus-level.js  ← POST: change a room's consensus level
  submit-guess.js           ← POST: submit a keyword guess
  round-timeout.js           ← POST: client-nudged "the falling emoji timed out" tick
  game-timeout.js              ← POST: client-nudged "the 60s clock ran out" tick
  room-reset.js                  ← POST: client-nudged "return to lobby after Game Over" tick
  heartbeat.js                     ← POST: keep-alive ping (replaces socket disconnect detection)
  room-state.js                      ← GET: room snapshot, used to resync right after joining
public/
  index.html         ← the whole app: username entry, room create/join, lobby, game, scoreboard
  client.js            ← fetch() calls + Pusher subscription behind index.html
  style.css             ← retro pixel-arcade theme
```

## Where the emoji come from

Blaster doesn't own an emoji list itself — it fetches one per-room from
qmoji-2's admin-curated "Emoji Phases" system (`GET
/api/emoji-rules?lang=xx` on the qmoji-2 deployment,
public/unauthenticated), based on the room's language. If that's
unreachable or returns nothing, it falls back to a small static list
(`lib/emoji-source.js`) so the game stays playable either way. Set
`QMOJI_ADMIN_BASE_URL` to point at the right qmoji-2 deployment
(`http://localhost:5500` for local dev against a local qmoji-2 checkout).

## Deploying on Vercel

1. **Connect this repo** as a Vercel project (framework preset: Other — no
   build step needed; `vercel.json` pins this explicitly since the project
   was previously configured for a traditional Node server and Vercel's
   dashboard setting doesn't always update itself when the code changes).
2. **Add a Redis database**: in the Vercel dashboard, go to your project →
   Storage → Marketplace, and install an **Upstash for Redis** integration
   (Vercel's own "Vercel KV" product is deprecated — Upstash is the current
   path, and it's a generous free tier). Connecting it auto-injects the
   right env vars (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` depending on how the
   integration names them — `lib/room-store.js` checks both).
3. **Create a Pusher account** at pusher.com → new **Channels** app → note
   the App ID, Key, Secret, and Cluster from its dashboard.
4. **Add environment variables** in Vercel project → Settings →
   Environment Variables:
   - `PUSHER_APP_ID`
   - `PUSHER_KEY`
   - `PUSHER_SECRET`
   - `PUSHER_CLUSTER`
   - `MONGODB_URI` — a MongoDB connection string (no database segment needed
     in the path; `lib/mongo-client.js` passes the database name explicitly)
   - `QMOJI_ADMIN_BASE_URL` — the qmoji-2 deployment to pull the emoji list
     from (e.g. `https://qmoji-2.vercel.app`)
5. **Redeploy.**

## Running locally

```bash
npm install
vercel env pull        # after steps 2-4 above, pulls the real env vars down
vercel dev
```

Then open the URL `vercel dev` prints (defaults to `http://localhost:3000`).

## How a room works

Players type words freely — nothing ever "locks in," and nothing is
checked against a stored dictionary. Each player accumulates a running list
of everything they've typed during the current round, and as soon as
enough distinct players have independently typed the *same word as each
other*, the emoji clears — only those matching players score a point, not
the whole room. Nobody ever sees what anyone else typed until that
happens — only a headcount of how close the room is to a match.

The game is timer-based (60s), not score-based: the shared team score is
however many emoji the room synced together before time ran out.

**Consensus levels**, picked in the lobby (not before anyone's joined,
since it needs to know how many players are actually in the room): Level 1
needs 2 players to agree, Level 2 needs 3, Level 3 needs 4. The room can
hold more players than the threshold — a 6-person room on Level 1 just
needs any 2 of those 6 to land on the same word. Each level stays locked
until enough players have joined to reach it.

A room auto-starts once everyone's clicked Ready, matching the current
consensus level's minimum. There's also a **Start Now** button that appears
once enough players have joined, regardless of ready state — so one player
sitting idle (or refusing to ready up) can't block the rest of the group
indefinitely.

A player who joins mid-game is held in the lobby — not dropped into the
live round — until the game ends and the room resets for a rematch.

## Known limitations (current version)

- Timers (the per-round fall duration, the 60s game clock, and the
  post-Game-Over pause before a room resets) are driven by each connected
  client's local countdown calling a dedicated `/api/*-timeout` endpoint
  when it elapses, since there's no persistent server process to hold a
  `setTimeout` — those endpoints are idempotent, so it's safe if multiple
  clients' timers fire around the same moment.
- Player presence is heartbeat-based (a ping every 5s, pruned after 20s of
  silence) rather than an instant disconnect signal, so a closed tab takes
  up to ~20s to be reflected for other players in the room.
- Double Sync shows two emoji and asks players to find a word that fits
  both, but that's purely the players' own judgment now — there's no stored
  data saying which word-pairs are "valid," so nothing enforces that a
  winning word actually relates to both emoji shown.
