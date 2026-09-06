// Gated on initI18n(): the string table now arrives over the network, so
// nothing here may run until it has loaded -- applyStaticTranslations() below
// is the first statement and paints UI text. initI18n() never rejects, so
// this always runs.
//
// Wrapping the whole file moves its top-level bindings into this callback.
// That is safe here: client.js is the last script on the page, exposes
// nothing on window, and index.html has no inline handlers, so nothing
// outside this file ever referenced them.
initI18n().then(() => {

// client.js — Emoji Blaster multiplayer client (Vercel: fetch() + Pusher,
// no persistent socket). Every former socket.emit(...) is now a fetch()
// POST to /api/*; every former socket.on(...) is now a Pusher channel
// event binding. See lib/game-logic.js and the /api handlers for the
// server-side half of each of these.

applyStaticTranslations();

const PLAYER_ID_KEY = "emoji-blaster-player-id";
function getPlayerId() {
  let id = sessionStorage.getItem(PLAYER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  }
  return id;
}

// A player arriving from the QMoji 2.0 homescreen already has an arcade
// identity (?player=) -- adopt it as this game's own id too, before
// getPlayerId() below would otherwise mint an unrelated random one. Read
// synchronously off the URL (not via arcade-client.js's async initArcade())
// so it's in place before the very first getPlayerId() call, a few lines
// down, ever runs.
(function adoptArcadePlayerId() {
  const fromUrl = new URLSearchParams(location.search).get("player");
  if (fromUrl) sessionStorage.setItem(PLAYER_ID_KEY, fromUrl);
})();

const playerId = getPlayerId();

async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

let pusher = null;
let channel = null;

async function connectPusher() {
  if (pusher) return pusher;
  const { pusherKey, pusherCluster } = await fetch("/api/config").then((r) => r.json());
  pusher = new Pusher(pusherKey, { cluster: pusherCluster });
  return pusher;
}

async function subscribeToRoom(code) {
  const p = await connectPusher();
  if (channel) p.unsubscribe(channel.name);
  channel = p.subscribe(`room-${code}`);
  bindChannelEvents(channel);
  return channel;
}

const screens = {
  landing: document.getElementById("screen-landing"),
  lobby: document.getElementById("screen-lobby"),
  game: document.getElementById("screen-game"),
  gameover: document.getElementById("screen-gameover"),
};

const CONSENSUS_REQUIRED = { 1: 2, 2: 3, 3: 4 };

const CONSENSUS_LABELS = {
  1: () => t("consensus_label_level1"),
  2: () => t("consensus_label_level2"),
  3: () => t("consensus_label_level3"),
};

const CONSENSUS_DESCRIPTIONS = {
  1: () => t("consensus_desc_level1"),
  2: () => t("consensus_desc_level2"),
  3: () => t("consensus_desc_level3"),
};

const MODE_LABELS = { sync: () => t("mode_label_sync"), double: () => t("mode_label_double") };

function formatModeLabel(mode, consensusLevel) {
  const modeLabel = (MODE_LABELS[mode] || MODE_LABELS.sync)();
  const consensusLabel = (CONSENSUS_LABELS[consensusLevel] || CONSENSUS_LABELS[1])();
  return `${modeLabel} — ${consensusLabel}`;
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

// ---- Landing ----
const usernameInput = document.getElementById("username-input");
const createRoomBtn = document.getElementById("create-room-btn");
const joinCodeInput = document.getElementById("join-code-input");
const joinRoomBtn = document.getElementById("join-room-btn");
const landingError = document.getElementById("landing-error");

function getUsername() {
  const name = usernameInput.value.trim();
  if (!name) {
    landingError.textContent = t("name_required_error");
    landingError.classList.remove("hidden");
    return null;
  }
  landingError.classList.add("hidden");
  return name;
}

// ---- Mode select (only matters for room creation; joiners inherit the room's mode) ----
const modeButtons = Array.from(document.querySelectorAll("#mode-select .btn-mode"));
let selectedMode = "sync";

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedMode = btn.dataset.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b === btn));
  });
});

// Common tail end of create/join: subscribe to the room's live channel,
// switch to the lobby, and start keeping presence/state fresh.
async function enterRoomFully(data) {
  await subscribeToRoom(data.code);
  enterRoom(data.code, data.mode, data.consensusLevel);
  startHeartbeat(data.code);
  await resyncFromSnapshot(data.code);
}

createRoomBtn.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) return;
  // arcadeLang is set moments after page load by initArcadeLink() below,
  // well before a real click can happen -- undefined here just means "no
  // arcade party" or "no curated emoji set for that language yet," and the
  // server falls back to its own default either way.
  if (arcadeRoomCode) {
    // Arrived from an arcade party -- everyone who launched Blaster from
    // that same party should land in one shared room under the party's own
    // code, without a second code to share. Try joining a room already
    // opened under it first, and only seed a fresh one under it (in
    // whichever mode is selected here) if nobody has yet.
    const joinData = await api("join-room", { code: arcadeRoomCode, username, playerId });
    if (!joinData.error) {
      await enterRoomFully(joinData);
      return;
    }
    const createData = await api("create-room", { username, mode: selectedMode, playerId, code: arcadeRoomCode, language: arcadeLang });
    if (createData.error) {
      landingError.textContent = createData.error;
      landingError.classList.remove("hidden");
      return;
    }
    await enterRoomFully(createData);
    return;
  }
  const data = await api("create-room", { username, mode: selectedMode, playerId, language: arcadeLang });
  if (data.error) {
    landingError.textContent = data.error;
    landingError.classList.remove("hidden");
    return;
  }
  await enterRoomFully(data);
});

joinRoomBtn.addEventListener("click", async () => {
  const username = getUsername();
  if (!username) return;
  const code = joinCodeInput.value.trim().toUpperCase();
  if (!code) {
    landingError.textContent = t("room_code_required_error");
    landingError.classList.remove("hidden");
    return;
  }
  const data = await api("join-room", { code, username, playerId });
  if (data.error) {
    landingError.textContent = data.error;
    landingError.classList.remove("hidden");
    return;
  }
  await enterRoomFully(data);
});

// ---- QMoji Arcade: party continuity from the homescreen ----
// Enhancement only -- if there's no ?room= or the lookup fails, none of this
// runs and the landing screen above behaves exactly as it does standalone.
// Mirrors emoji-survey-scramble's and emoji-munchers' identical pattern:
// a known party member skips the manual name/create/join screen entirely,
// reusing the arcade party's own room code as this game's room code too (so
// everyone who launched Blaster from the same party lands in the same room
// without a second code to share) -- try joining a room already opened
// under that code first, and only seed a fresh one under it if nobody has.
function navigateWithLoadingScreen(href) {
  const loadingScreen = document.getElementById("loadingScreen");
  const fill = document.getElementById("loadingBarFill");
  if (!loadingScreen || !fill) {
    window.location.href = href;
    return;
  }
  loadingScreen.classList.add("is-visible");
  loadingScreen.setAttribute("aria-hidden", "false");
  fill.style.width = "0%";
  requestAnimationFrame(() => { fill.style.width = "100%"; });
  setTimeout(() => { window.location.href = href; }, 650);
}

const backToLaunchpadBtn = document.getElementById("backToLaunchpadBtn");
let arcadeRoomCode = null;
let arcadeLang = null;
let arcadeUiLang = null;
let arcadePlayerId = null;

backToLaunchpadBtn.addEventListener("click", () => {
  navigateWithLoadingScreen(QMojiArcade.backToHomescreenUrl(arcadeRoomCode, arcadeLang, arcadePlayerId, arcadeUiLang));
});

(async function initArcadeLink() {
  const arcade = await QMojiArcade.initArcade();
  if (!arcade) return;
  arcadeRoomCode = arcade.roomCode;
  arcadeLang = arcade.lang;
  arcadeUiLang = arcade.uiLang;
  arcadePlayerId = arcade.playerId;

  // The homescreen's Blaster cabinet can pass ?mode= for whichever mode the
  // launching player picked there. Only relevant to the create-room path
  // below (joiners inherit the room's mode); a missing or unrecognized
  // value leaves selectedMode at its "sync" default.
  if (arcade.mode && modeButtons.some((b) => b.dataset.mode === arcade.mode)) {
    selectedMode = arcade.mode;
    modeButtons.forEach((b) => b.classList.toggle("active", b.dataset.mode === arcade.mode));
  }

  const me = (arcade.room.players || []).find((p) => p.playerId === arcadePlayerId);
  if (!me) {
    // A raw game link was opened directly (not routed through the
    // homescreen) -- just enroll whoever joins into the arcade party too.
    joinRoomBtn.addEventListener("click", () => {
      const name = usernameInput.value.trim();
      if (name) QMojiArcade.joinRoom(arcadeRoomCode, name).catch(() => {});
    });
    return;
  }

  // Known party member -- prefill their name so they don't have to retype
  // it, but leave the landing screen up rather than silently skipping it:
  // the mode buttons above are the actual decision for what the whole party
  // plays, and whoever creates the room (createRoomBtn, below) needs the
  // chance to look at and change that selection first, not just inherit
  // whatever the homescreen happened to send.
  usernameInput.value = me.name;
})();

// ---- Heartbeat (replaces socket.io's connection/disconnect signal) ----
let heartbeatInterval = null;
function startHeartbeat(code) {
  clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    api("heartbeat", { code, playerId });
  }, 5000);
}

// Fetches the current room snapshot right after subscribing, in case
// anything was published in the gap between the create/join response and
// the Pusher subscription completing.
async function resyncFromSnapshot(code) {
  try {
    const snap = await fetch(`/api/room-state?code=${encodeURIComponent(code)}`).then((r) => r.json());
    if (snap.error) return;
    applyLobbyUpdate(snap.lobby);
    applyScoreboard(snap.scoreboard);
  } catch (err) {
    // best-effort — live Pusher events will catch it up regardless
  }
}

// ---- Lobby ----
const roomCodeDisplay = document.getElementById("room-code-display");
const roomCodeSmall = document.getElementById("room-code-small");
const lobbyMode = document.getElementById("lobby-mode");
const modeSmall = document.getElementById("mode-small");
const playerList = document.getElementById("player-list");
const lobbyStatus = document.getElementById("lobby-status");
const readyBtn = document.getElementById("ready-btn");
const startNowBtn = document.getElementById("start-now-btn");
const consensusSelect = document.getElementById("consensus-select");
const consensusButtons = Array.from(document.querySelectorAll("#consensus-select .btn-mode"));
const consensusDescription = document.getElementById("consensus-description");

let currentRoomCode = null;
let currentMode = "sync";
let currentConsensusLevel = 1;
let iAmReady = false;

function enterRoom(code, mode, consensusLevel) {
  currentRoomCode = code;
  currentMode = mode || "sync";
  currentConsensusLevel = consensusLevel || 1;
  roomCodeDisplay.textContent = code;
  roomCodeSmall.textContent = code;
  const label = formatModeLabel(currentMode, currentConsensusLevel);
  lobbyMode.textContent = label;
  modeSmall.textContent = label;
  showScreen("lobby");
}

// Mirrors Moji Mojo's/Munchers' identical button -- every multiplayer game
// in the arcade should offer the same way to invite people, not just a
// bare room code players have to relay by hand. Feedback is the button's
// own label swapping briefly rather than a toast system, since this app
// doesn't have one.
const copyCodeBtn = document.getElementById("btn-copy-code");
if (copyCodeBtn) {
  const defaultLabel = copyCodeBtn.textContent;
  copyCodeBtn.addEventListener("click", async () => {
    if (!currentRoomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${currentRoomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      copyCodeBtn.textContent = t("invite_link_copied");
    } catch (e) {
      copyCodeBtn.textContent = url;
    }
    setTimeout(() => { copyCodeBtn.textContent = defaultLabel; }, 2000);
  });
}

consensusButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled || !currentRoomCode) return;
    api("set-consensus-level", { code: currentRoomCode, level: Number(btn.dataset.consensus) });
  });
});

function applyLobbyUpdate({ players, mode, consensusLevel, gameInProgress, minPlayers }) {
  currentMode = mode || currentMode;
  currentConsensusLevel = consensusLevel || currentConsensusLevel;
  lobbyMode.textContent = formatModeLabel(currentMode, currentConsensusLevel);

  playerList.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = p.username;
    const badge = document.createElement("span");
    badge.className = "ready-badge" + (p.ready ? " ready" : "");
    badge.textContent = p.ready ? t("ready_badge") : t("not_ready_badge");
    li.appendChild(name);
    li.appendChild(badge);
    playerList.appendChild(li);
  });

  consensusDescription.textContent = (CONSENSUS_DESCRIPTIONS[currentConsensusLevel] || CONSENSUS_DESCRIPTIONS[1])();
  consensusSelect.classList.remove("hidden");
  consensusDescription.classList.remove("hidden");
  consensusButtons.forEach((btn) => {
    const level = Number(btn.dataset.consensus);
    const required = CONSENSUS_REQUIRED[level];
    const unlocked = players.length >= required;
    btn.disabled = !unlocked || gameInProgress;
    btn.classList.toggle("active", level === currentConsensusLevel);
    btn.title = unlocked ? "" : t("consensus_locked_hint", { required });
  });

  const enoughToStart = players.length >= minPlayers;

  if (gameInProgress) {
    lobbyStatus.textContent = t("lobby_status_in_progress");
    readyBtn.disabled = true;
    startNowBtn.classList.add("hidden");
  } else if (!enoughToStart) {
    lobbyStatus.textContent = t("lobby_status_waiting_min", { min: minPlayers });
    readyBtn.disabled = false;
    startNowBtn.classList.add("hidden");
  } else {
    lobbyStatus.textContent = "";
    readyBtn.disabled = false;
    // Once enough players are in the room, anyone can start the game even
    // if someone hasn't (or won't) hit Ready — one holdout shouldn't be
    // able to block everyone else indefinitely.
    startNowBtn.classList.remove("hidden");
  }
}

function applyScoreboard(entries) {
  scoreboardList.innerHTML = "";
  entries.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.username} — ${p.score}`;
    scoreboardList.appendChild(li);
  });
}

readyBtn.addEventListener("click", () => {
  iAmReady = !iAmReady;
  readyBtn.textContent = iAmReady ? t("cancel_ready_button") : t("ready_up_button");
  api("toggle-ready", { code: currentRoomCode, playerId });
});

startNowBtn.addEventListener("click", () => {
  api("force-start", { code: currentRoomCode });
});

// ---- Game ----
const fallingEmojiEl = document.getElementById("falling-emoji");
const fallingEmoji2El = document.getElementById("falling-emoji-2");
const fallZone = document.getElementById("fall-zone");
const roundFeedback = document.getElementById("round-feedback");
const guessInput = document.getElementById("guess-input");
const scoreboardList = document.getElementById("scoreboard-list");
const scoreboardHint = document.getElementById("scoreboard-hint");
const timerSmall = document.getElementById("timer-small");

let countdownInterval = null;
let roundTimeoutHandle = null;
let gameTimeoutFired = false;

function stopCountdown() {
  clearInterval(countdownInterval);
  countdownInterval = null;
  timerSmall.textContent = "";
  timerSmall.classList.add("hidden");
}

function startCountdown(endsAt) {
  clearInterval(countdownInterval);
  gameTimeoutFired = false;
  timerSmall.classList.remove("hidden");

  function tick() {
    const remainingMs = Math.max(0, endsAt - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const ss = String(totalSeconds % 60).padStart(2, "0");
    timerSmall.textContent = `⏱ ${mm}:${ss}`;
    if (remainingMs <= 0) {
      clearInterval(countdownInterval);
      if (!gameTimeoutFired) {
        gameTimeoutFired = true;
        api("game-timeout", { code: currentRoomCode });
      }
    }
  }

  tick();
  countdownInterval = setInterval(tick, 250);
}

function armRoundTimeout(fallDurationMs) {
  clearTimeout(roundTimeoutHandle);
  roundTimeoutHandle = setTimeout(() => {
    api("round-timeout", { code: currentRoomCode });
  }, fallDurationMs + 250); // small buffer past the visual fall duration
}

// Resets one falling-emoji element to the top and animates it down over
// fallDuration — shared by both slots so Double Sync's two emojis fall in
// lockstep with Sync's single one.
function dropEmoji(el, text, fallDuration) {
  el.textContent = text;
  el.style.transition = "none";
  el.style.top = "-80px";
  // Force reflow so the next transition actually animates from the top.
  void el.offsetHeight;
  el.style.transition = `top ${fallDuration}ms linear`;
  el.style.top = `${fallZone.clientHeight - 20}px`;
}

function bindChannelEvents(ch) {
  ch.bind("lobby-update", applyLobbyUpdate);
  ch.bind("scoreboard", applyScoreboard);

  ch.bind("room-reset", () => {
    iAmReady = false;
    readyBtn.textContent = t("ready_up_button");
    stopCountdown();
    clearTimeout(roundTimeoutHandle);
    showScreen("lobby");
  });

  ch.bind("game-started", ({ mode, consensusLevel, endsAt }) => {
    showScreen("game");
    guessInput.value = "";
    guessInput.focus();
    currentMode = mode || currentMode;
    currentConsensusLevel = consensusLevel || currentConsensusLevel;
    modeSmall.textContent = formatModeLabel(currentMode, currentConsensusLevel);
    scoreboardHint.textContent = t("scoreboard_hint");
    if (endsAt) {
      startCountdown(endsAt);
    } else {
      stopCountdown();
    }
  });

  ch.bind("emoji-spawn", ({ emoji, fallDuration }) => {
    roundFeedback.textContent = "";
    const emojis = Array.isArray(emoji) ? emoji : [emoji];

    dropEmoji(fallingEmojiEl, emojis[0], fallDuration);
    if (emojis.length > 1) {
      fallingEmojiEl.style.left = "30%";
      fallingEmoji2El.classList.remove("hidden");
      fallingEmoji2El.style.left = "70%";
      dropEmoji(fallingEmoji2El, emojis[1], fallDuration);
    } else {
      fallingEmojiEl.style.left = "50%";
      fallingEmoji2El.classList.add("hidden");
    }

    guessInput.value = "";
    guessInput.focus();
    armRoundTimeout(fallDuration);
  });

  ch.bind("emoji-correct", ({ username, guess }) => {
    clearTimeout(roundTimeoutHandle);
    roundFeedback.textContent = t("emoji_correct", { username, guess });
  });

  ch.bind("emoji-miss", () => {
    clearTimeout(roundTimeoutHandle);
    roundFeedback.textContent = t("emoji_miss");
  });

  // Never reveals which word anyone typed — just how close the room is to
  // consensus (best overlap so far vs. how many are needed), so guessing
  // stays private until the room actually lands on a shared word.
  ch.bind("sync-progress", ({ bestCount, required }) => {
    roundFeedback.textContent = t("sync_progress", { bestCount, required });
  });

  ch.bind("game-over", ({ teamScore, scoreboard }) => {
    clearTimeout(roundTimeoutHandle);
    stopCountdown();
    gameoverWinner.textContent = t("game_over_summary", { teamScore });
    gameoverScoreboardList.innerHTML = "";
    scoreboard.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.username} — ${p.score}`;
      gameoverScoreboardList.appendChild(li);
    });
    showScreen("gameover");
    setTimeout(() => api("room-reset", { code: currentRoomCode }), 4000);
  });
}

// ---- Game over ----
const gameoverWinner = document.getElementById("gameover-winner");
const gameoverScoreboardList = document.getElementById("gameover-scoreboard-list");
const playAgainBtn = document.getElementById("play-again-btn");

playAgainBtn.addEventListener("click", () => {
  window.location.reload();
});

async function submitGuess() {
  const guess = guessInput.value.trim();
  if (!guess) return;
  guessInput.value = ""; // clear immediately so the next word can be typed right away — no "locking in"
  await api("submit-guess", { code: currentRoomCode, playerId, guess });
}

guessInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGuess();
});

});
