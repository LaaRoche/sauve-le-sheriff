import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(globalThis.process?.env?.PORT || 5205);
const defaultSettings = {
  duelDuration: 30,
  resultDuration: 15,
  discussionDuration: 150,
  voiceChatEnabled: true
};
const defaultIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const staticIceServers = loadStaticIceServers();
let iceServers = staticIceServers;
let turnStatus = {
  mode: "stun",
  configured: false,
  ready: false,
  message: "STUN par defaut"
};
const clients = new Set();
let resultResetTimer = null;
let lastPublicOrigin = "";
let activeSettings = { ...defaultSettings };
let state = createGameState("GLOBAL");
const games = new Map([[state.code, state]]);
const adminCode = "1994";

function loadStaticIceServers() {
  const json = globalThis.process?.env?.ICE_SERVERS_JSON;
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      console.warn("ICE_SERVERS_JSON invalide, utilisation du STUN par defaut.");
    }
  }

  const turnUrl = globalThis.process?.env?.TURN_URL;
  const turnUsername = globalThis.process?.env?.TURN_USERNAME;
  const turnCredential = globalThis.process?.env?.TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    return [
      ...defaultIceServers,
      { urls: turnUrl, username: turnUsername, credential: turnCredential }
    ];
  }

  return defaultIceServers;
}

function meteredAppName() {
  const raw = String(globalThis.process?.env?.METERED_APP_NAME || "").trim();
  return raw
    .replace(/^https?:\/\//i, "")
    .replace(/\.metered\.live.*$/i, "")
    .replace(/\/.*$/, "");
}

function meteredUrl(pathname, params = {}) {
  const appName = meteredAppName();
  if (!appName) return "";
  const url = new URL(`https://${appName}.metered.live${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function meteredRegion() {
  return String(globalThis.process?.env?.METERED_TURN_REGION || "global").trim() || "global";
}

function meteredExpiry() {
  const value = Number(globalThis.process?.env?.METERED_TURN_EXPIRY_SECONDS || 86400);
  return Number.isFinite(value) && value > 300 ? Math.round(value) : 86400;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function normalizeIceServers(payload) {
  const source = Array.isArray(payload) ? payload : payload?.iceServers;
  if (!Array.isArray(source) || !source.length) return null;
  return source
    .map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential
    }))
    .filter((server) => server.urls);
}

async function createMeteredCredential() {
  const secretKey = String(globalThis.process?.env?.METERED_SECRET_KEY || "").trim();
  if (!secretKey) return null;
  const url = meteredUrl("/api/v1/turn/credential", { secretKey });
  if (!url) return null;
  const credential = await fetchJson(url, {
    method: "POST",
    body: JSON.stringify({
      expirationEnSecondes: meteredExpiry(),
      expirationInSeconds: meteredExpiry(),
      label: String(globalThis.process?.env?.METERED_TURN_LABEL || "empire-sheriff-render")
    })
  });
  return credential;
}

async function fetchMeteredIceServers(apiKey) {
  const endpoints = ["/api/v1/turn/credentials", "/api/v1/turn/credential"];
  let lastError = null;
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson(meteredUrl(endpoint, {
        apiKey,
        region: meteredRegion()
      }));
      const meteredIceServers = normalizeIceServers(payload);
      if (meteredIceServers) return meteredIceServers;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Aucun serveur ICE recu");
}

async function refreshMeteredIceServers() {
  const appName = meteredAppName();
  const explicitApiKey = String(globalThis.process?.env?.METERED_TURN_API_KEY || "").trim();
  const secretKey = String(globalThis.process?.env?.METERED_SECRET_KEY || "").trim();
  if (!appName || (!explicitApiKey && !secretKey)) {
    return;
  }

  turnStatus = {
    mode: "metered",
    configured: true,
    ready: false,
    message: "Configuration Metered en cours"
  };

  try {
    const createdCredential = explicitApiKey ? null : await createMeteredCredential();
    const directIceServers = normalizeIceServers(createdCredential);
    if (directIceServers) {
      iceServers = directIceServers;
      turnStatus = {
        mode: "metered",
        configured: true,
        ready: true,
        message: "TURN Metered actif"
      };
      return;
    }
    const apiKey = explicitApiKey || createdCredential?.apiKey || createdCredential?.key || createdCredential?.id || "";
    if (!apiKey) throw new Error("Identifiant TURN Metered introuvable");
    iceServers = await fetchMeteredIceServers(apiKey);
    turnStatus = {
      mode: "metered",
      configured: true,
      ready: true,
      message: "TURN Metered actif"
    };
  } catch (error) {
    iceServers = staticIceServers;
    turnStatus = {
      mode: "metered",
      configured: true,
      ready: false,
      message: "TURN Metered indisponible, STUN par defaut"
    };
    console.warn(`TURN Metered indisponible: ${error.message}`);
  }
}

function scheduleMeteredRefresh() {
  refreshMeteredIceServers();
  setInterval(refreshMeteredIceServers, Math.min(meteredExpiry() * 1000 * 0.8, 6 * 60 * 60 * 1000));
}

function createGameState(code) {
  const settings = { ...defaultSettings };
  return {
    code,
    visibility: "private",
    players: [],
    hostId: "",
    hostMessage: "",
    settings,
    phase: freshPhase(),
    duel: freshDuel(settings),
    saloonVotes: freshSaloonVotes(),
    debugLogs: []
  };
}

function gameCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function makeGameCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = "";
    for (let index = 0; index < 5; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (games.has(code));
  return code;
}

function getGame(codeInput) {
  const code = gameCode(codeInput) || "GLOBAL";
  if (!games.has(code)) games.set(code, createGameState(code));
  return games.get(code);
}

function findGame(codeInput) {
  const code = gameCode(codeInput);
  return code ? games.get(code) : null;
}

function useGame(codeInput) {
  state = getGame(codeInput);
  activeSettings = state.settings;
  return state;
}

function freshPhase() {
  return {
    name: "idle",
    label: "En attente",
    remaining: 0,
    running: false,
    startedAt: 0,
    duration: 0
  };
}

function freshDuel(settings = activeSettings) {
  return {
    leftId: "",
    rightId: "",
    leftChoice: "",
    rightChoice: "",
    running: false,
    startedAt: 0,
    remaining: settings.duelDuration,
    revealed: false,
    resolved: false,
    sheriffShot: false,
    resultMessage: "",
    resultDetail: ""
  };
}

function freshSaloonVotes() {
  return { A: {}, B: {} };
}

function startDuelTimer() {
  computeDuel();
  state.hostMessage = "";
  state.phase = freshPhase();
  state.duel.running = true;
  state.duel.startedAt = Date.now() - (state.settings.duelDuration - state.duel.remaining) * 1000;
  state.duel.revealed = false;
  logGame("duel:start", { duration: state.settings.duelDuration });
}

function saloonDuelist(saloon) {
  return state.duel[saloon === "A" ? "leftId" : "rightId"];
}

function setSaloonDuelist(saloon, playerId) {
  if (saloon === "A") state.duel.leftId = playerId;
  if (saloon === "B") state.duel.rightId = playerId;
}

function candidatesForSaloon(saloon) {
  return state.players.filter((player) => player.alive && player.role && player.saloon === saloon);
}

function clearInvalidVotes() {
  for (const saloon of ["A", "B"]) {
    const voters = candidatesForSaloon(saloon).map((player) => player.id);
    const candidates = new Set(voters);
    for (const [voterId, targetId] of Object.entries(state.saloonVotes[saloon] || {})) {
      if (!voters.includes(voterId) || !candidates.has(targetId)) {
        delete state.saloonVotes[saloon][voterId];
      }
    }
  }
}

function pickSaloonVoteWinner(saloon) {
  const candidates = candidatesForSaloon(saloon);
  if (!candidates.length) return "";
  const votes = state.saloonVotes[saloon] || {};
  const scores = new Map(candidates.map((player) => [player.id, 0]));

  Object.values(votes).forEach((targetId) => {
    if (scores.has(targetId)) scores.set(targetId, scores.get(targetId) + 1);
  });

  const bestScore = Math.max(...scores.values());
  const tied = candidates.filter((player) => scores.get(player.id) === bestScore);
  return shuffle(tied)[0]?.id || "";
}

function resolveDiscussionVotes() {
  clearInvalidVotes();
  const leftId = pickSaloonVoteWinner("A");
  const rightId = pickSaloonVoteWinner("B");
  state.duel.leftId = leftId;
  state.duel.rightId = rightId;
  state.hostMessage = leftId && rightId ? "" : "Un saloon n'a pas de duelliste disponible.";
  logGame("vote:resolved", {
    saloonA: debugPlayer(leftId),
    saloonB: debugPlayer(rightId),
    votesA: state.saloonVotes.A,
    votesB: state.saloonVotes.B
  });
  return Boolean(leftId && rightId);
}

function missingVoicePlayers() {
  return state.players.filter((player) => player.alive && !player.fake && !player.voiceReady);
}

function livingPlayers() {
  return state.players.filter((player) => player.alive);
}

function livingCamps() {
  const living = livingPlayers();
  const outlaws = living.filter((player) => player.role === "Hors-la-loi");
  const empire = living.filter((player) => player.role === "Citoyen" || player.role === "Sheriff");
  return { living, outlaws, empire };
}

function debugPlayer(id) {
  const player = state.players.find((item) => item.id === id);
  if (!player) return "";
  return `${player.name}${player.role ? `/${player.role}` : ""}${player.alive ? "" : "/mort"}`;
}

function debugSummary() {
  const duel = state.duel || {};
  return {
    phase: state.phase?.name || "none",
    phaseLabel: state.phase?.label || "",
    phaseRemaining: state.phase?.remaining || 0,
    duelRunning: Boolean(duel.running),
    duelRemaining: duel.remaining || 0,
    duelRevealed: Boolean(duel.revealed),
    duelResolved: Boolean(duel.resolved),
    left: debugPlayer(duel.leftId),
    right: debugPlayer(duel.rightId),
    leftChoice: duel.leftChoice || "",
    rightChoice: duel.rightChoice || "",
    sheriffShot: Boolean(duel.sheriffShot),
    alive: livingPlayers().map((player) => `${player.name}:${player.saloon}:${player.role || "sans-role"}`)
  };
}

function logGame(type, details = {}) {
  if (!state.debugLogs) state.debugLogs = [];
  const entry = {
    at: new Date().toISOString(),
    code: state.code,
    type,
    ...debugSummary(),
    details
  };
  state.debugLogs.push(entry);
  if (state.debugLogs.length > 400) state.debugLogs.splice(0, state.debugLogs.length - 400);
  console.log(`[${entry.at}] [${state.code}] ${type} phase=${entry.phase}:${entry.phaseRemaining} duel=${entry.duelRunning ? "on" : "off"}:${entry.duelRemaining} left=${entry.left || "-"} right=${entry.right || "-"} ${JSON.stringify(details)}`);
}

function debugLogText(game) {
  return (game.debugLogs || []).map((entry) => {
    const details = Object.keys(entry.details || {}).length ? ` details=${JSON.stringify(entry.details)}` : "";
    return `${entry.at} [${entry.code}] ${entry.type} phase=${entry.phase}:${entry.phaseRemaining} duel=${entry.duelRunning ? "on" : "off"}:${entry.duelRemaining} left=${entry.left || "-"} right=${entry.right || "-"} choices=${entry.leftChoice || "-"}|${entry.rightChoice || "-"} sheriff=${entry.sheriffShot}${details}`;
  }).join("\n");
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function localAddress() {
  const nets = os.networkInterfaces();
  for (const items of Object.values(nets)) {
    for (const item of items || []) {
      if (item.family === "IPv4" && !item.internal) return item.address;
    }
  }
  return "127.0.0.1";
}

function requestOrigin(req) {
  if (!req?.headers?.host) return "";
  const proto = req.headers["x-forwarded-proto"] || (req.headers.host.startsWith("127.") || req.headers.host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${req.headers.host}`;
}

function computeDuel() {
  const duel = state.duel;
  if (!duel.running) return duel;

  const elapsed = Math.floor((Date.now() - duel.startedAt) / 1000);
  duel.remaining = Math.max(0, state.settings.duelDuration - elapsed);
  if (duel.remaining === 0) {
    logGame("duel:timer-ended");
    duel.running = false;
    duel.revealed = true;
    if (!duel.leftChoice) duel.leftChoice = "hold";
    if (!duel.rightChoice) duel.rightChoice = "hold";
    applyResolution();
    scheduleAfterDuel();
  }
  return duel;
}

function computePhase() {
  const phase = state.phase;
  if (!phase.running) return phase;

  const elapsed = Math.floor((Date.now() - phase.startedAt) / 1000);
  phase.remaining = Math.max(0, phase.duration - elapsed);
  if (phase.remaining === 0) {
    phase.running = false;
    if (phase.name === "result") {
      logGame("phase:result-ended");
      state.duel = freshDuel();
      state.saloonVotes = freshSaloonVotes();
      if (getResolvedWinner()) {
        state.phase = {
          name: "ended",
          label: "Partie terminee",
          remaining: 0,
          running: false,
          startedAt: 0,
          duration: 0
        };
        logGame("game:ended", { winner: getResolvedWinner() });
      } else {
        startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
      }
    } else if (phase.name === "discussion") {
      logGame("phase:discussion-ended");
      if (resolveDiscussionVotes()) {
        maybeStartDuelFromSelection();
      } else {
        phase.label = "Discussion terminee : choisissez les duellistes";
        logGame("duel:missing-duelist");
      }
    } else if (phase.name === "final") {
      logGame("phase:final-ended");
      if (!maybeStartDuelFromSelection()) {
        phase.label = "Duel impossible";
        logGame("duel:impossible");
      }
    }
  }
  return phase;
}

function publicState(req) {
  computeDuel();
  computePhase();
  const origin = requestOrigin(req) || lastPublicOrigin || `http://${localAddress()}:${port}`;
  if (requestOrigin(req)) lastPublicOrigin = requestOrigin(req);
  return {
    code: state.code,
    visibility: state.visibility,
    joinUrl: `${origin}/join.html`,
    players: state.players,
    hostId: state.hostId,
    winner: getWinner(),
    hostMessage: state.hostMessage,
    settings: state.settings,
    phase: state.phase,
    duel: state.duel,
    saloonVotes: state.saloonVotes,
    voice: {
      iceServers,
      turnStatus
    }
  };
}

function publicGameList(req) {
  const origin = requestOrigin(req) || lastPublicOrigin || `http://${localAddress()}:${port}`;
  if (requestOrigin(req)) lastPublicOrigin = requestOrigin(req);
  return [...games.values()]
    .filter((game) => {
      const previous = state;
      state = game;
      activeSettings = game.settings;
      const open = game.code !== "GLOBAL" && game.players.length > 0 && !gameHasStarted();
      state = previous;
      activeSettings = previous.settings;
      return open;
    })
    .map((game) => ({
      code: game.visibility === "public" ? game.code : "",
      visibility: game.visibility,
      hostName: game.players.find((player) => player.id === game.hostId)?.name || "Organisateur",
      playerCount: game.players.filter((player) => player.alive).length,
      readyCount: game.players.filter((player) => player.alive && (
        game.settings.voiceChatEnabled === false || player.fake || player.voiceReady
      )).length,
      joinUrl: game.visibility === "public" ? `${origin}/join.html?code=${game.code}` : ""
    }));
}

function getResolvedWinner() {
  const { outlaws, empire } = livingCamps();
  const hasRoles = state.players.some((player) => player.role);

  if (!hasRoles) return "";
  if (outlaws.length === 0) return "L'Empire";
  if (outlaws.length >= empire.length) return "Les hors-la-loi";
  return "";
}

function getWinner() {
  if (state.duel.running || state.phase.name === "result") return "";
  return getResolvedWinner();
}

function gameHasStarted() {
  return Boolean(
    state.winner ||
    state.phase.name !== "idle" ||
    state.players.some((player) => player.role) ||
    state.duel.leftId ||
    state.duel.rightId
  );
}

function sendJson(res, body) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function addPlayer(name) {
  const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const player = {
    id: makeId(),
    name,
    saloon: state.players.filter((item) => item.alive && item.saloon === "A").length <= state.players.filter((item) => item.alive && item.saloon === "B").length ? "A" : "B",
    alive: !gameHasStarted(),
    role: "",
    sheriffPower: true,
    voiceRoom: "",
    voiceReady: false,
    voiceMuted: false,
    voiceDeafened: false,
    fake: false
  };
  state.players.push(player);
  if (!state.hostId) state.hostId = player.id;
  return player;
}

function addFakePlayers(count = 5) {
  if (gameHasStarted()) {
    state.hostMessage = "Impossible pendant une partie en cours.";
    return [];
  }
  const created = [];
  for (let index = 1; index <= count; index += 1) {
    let name = `Bot ${index}`;
    let suffix = index;
    while (state.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      suffix += 1;
      name = `Bot ${suffix}`;
    }
    const player = addPlayer(name);
    player.voiceRoom = "Preparation";
    player.voiceReady = true;
    player.voiceMuted = false;
    player.fake = true;
    created.push(player);
  }
  state.hostMessage = `${created.length} faux joueurs ajoutes pour tester.`;
  return created;
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function emit() {
  emitGame(state);
}

function emitGame(game) {
  const previous = state;
  state = game;
  activeSettings = game.settings;
  const payload = `event: state\ndata: ${JSON.stringify(publicState())}\n\n`;
  for (const client of clients) {
    if (client.code === game.code) client.res.write(payload);
  }
  state = previous;
  activeSettings = previous.settings;
}

function emitSignal(signal) {
  const payload = `event: signal\ndata: ${JSON.stringify(signal)}\n\n`;
  for (const client of clients) {
    if (client.code === state.code) client.res.write(payload);
  }
}

function moveToOtherSaloon(player) {
  if (!player) return;
  player.saloon = player.saloon === "A" ? "B" : "A";
}

function ensureBothSaloonsForDiscussion() {
  const living = livingPlayers().filter((player) => player.role);
  if (living.length < 2) return;
  const saloonA = living.filter((player) => player.saloon === "A");
  const saloonB = living.filter((player) => player.saloon === "B");
  if (saloonA.length && saloonB.length) return;
  const source = saloonA.length ? saloonA : saloonB;
  const targetSaloon = saloonA.length ? "B" : "A";
  shuffle(source)[0].saloon = targetSaloon;
}

function maybeStartDuelFromSelection() {
  const duel = state.duel;
  if (!duel.leftId || !duel.rightId || duel.running || duel.revealed || duel.resolved) return false;
  const left = state.players.find((player) => player.id === duel.leftId);
  const right = state.players.find((player) => player.id === duel.rightId);
  if (!left?.alive || !right?.alive) {
    logGame("duel:start-blocked", { reason: "dead-or-missing-duelist" });
    return false;
  }
  startDuelTimer();
  return true;
}

function applyResolution() {
  const duel = state.duel;
  if (duel.resolved) return;
  const left = state.players.find((player) => player.id === duel.leftId);
  const right = state.players.find((player) => player.id === duel.rightId);
  if (!left || !right || !duel.leftChoice || !duel.rightChoice) return;

  if (duel.sheriffShot) {
    const sheriff = left.role === "Sheriff" ? left : right.role === "Sheriff" ? right : null;
    const target = sheriff?.id === left.id ? right : left;
    if (!sheriff || !target) return;
    target.alive = false;
    moveToOtherSaloon(sheriff);
    if (target.role === "Citoyen") sheriff.sheriffPower = false;
    duel.resultMessage = `${sheriff.name} utilise son pouvoir : ${target.name} est elimine, ${sheriff.name} change de saloon.`;
    duel.resultDetail = target.role === "Hors-la-loi" ? "Le sheriff garde son pouvoir." : "Le sheriff perd son pouvoir.";
  } else if (duel.leftChoice === "shoot" && duel.rightChoice === "shoot") {
    left.alive = false;
    right.alive = false;
    duel.resultMessage = `${left.name} et ${right.name} tirent : les deux sont elimines.`;
  } else if (duel.leftChoice === "shoot") {
    right.alive = false;
    moveToOtherSaloon(left);
    duel.resultMessage = `${left.name} tire : ${right.name} est elimine, ${left.name} change de saloon.`;
  } else if (duel.rightChoice === "shoot") {
    left.alive = false;
    moveToOtherSaloon(right);
    duel.resultMessage = `${right.name} tire : ${left.name} est elimine, ${right.name} change de saloon.`;
  } else {
    moveToOtherSaloon(left);
    moveToOtherSaloon(right);
    duel.resultMessage = "Personne ne tire.";
    duel.resultDetail = `${left.name} et ${right.name} voient chacun la carte adverse, puis echangent de saloon.`;
  }
  duel.resolved = true;
  logGame("duel:resolved", {
    message: duel.resultMessage,
    detail: duel.resultDetail
  });
}

function startPhase(name, label, seconds) {
  if (name === "discussion") {
    ensureBothSaloonsForDiscussion();
    state.saloonVotes = freshSaloonVotes();
  }
  state.phase = {
    name,
    label,
    remaining: seconds,
    running: seconds > 0,
    startedAt: Date.now(),
    duration: seconds
  };
  logGame("phase:start", { name, label, seconds });
}

function scheduleAfterDuel() {
  if (resultResetTimer) clearTimeout(resultResetTimer);
  startPhase("result", "Resultat du duel", state.settings.resultDuration);
}

function normalizeSettings(body) {
  const voiceChatEnabled = Object.prototype.hasOwnProperty.call(body, "voiceChatEnabled")
    ? body.voiceChatEnabled !== false && body.voiceChatEnabled !== "false"
    : state.settings?.voiceChatEnabled !== false;
  return {
    duelDuration: clampDuration(body.duelDuration, 5, 300, defaultSettings.duelDuration),
    resultDuration: clampDuration(body.resultDuration, 3, 120, defaultSettings.resultDuration),
    discussionDuration: clampDuration(body.discussionDuration, 10, 900, defaultSettings.discussionDuration),
    voiceChatEnabled
  };
}

function setupGame(outlawCountInput, options = {}) {
  state.hostMessage = "";
  const living = state.players.filter((player) => player.alive);
  if (living.length < 3) {
    state.hostMessage = "Ajoute au moins 3 joueurs pour demarrer une partie test.";
    logGame("game:setup-blocked", { reason: "not-enough-players", players: living.length });
    return false;
  }
  const missingMic = state.settings.voiceChatEnabled === false ? [] : missingVoicePlayers();
  if (missingMic.length && !options.force) {
    state.hostMessage = `Micro manquant : ${missingMic.map((player) => player.name).join(", ")}.`;
    logGame("game:setup-blocked", { reason: "missing-mic", players: missingMic.map((player) => player.name) });
    return false;
  }
  if (living.length < 5) state.hostMessage = "Partie test possible. Pour une meilleure experience, joue a 5 joueurs ou plus.";
  const outlawCount = Math.max(1, Math.min(Number(outlawCountInput || 1), Math.max(1, living.length - 1)));
  const roles = ["Sheriff"];
  for (let index = 0; index < outlawCount; index += 1) roles.push("Hors-la-loi");
  while (roles.length < living.length) roles.push("Citoyen");

  const shuffledRoles = shuffle(roles);
  living.forEach((player, index) => {
    player.role = shuffledRoles[index] || "Citoyen";
    player.sheriffPower = player.role === "Sheriff";
  });
  state.players.filter((player) => !player.alive).forEach((player) => {
    player.role = "";
    player.sheriffPower = false;
  });
  shuffle(living).forEach((player, index) => {
    player.saloon = index % 2 === 0 ? "A" : "B";
  });
  state.duel = freshDuel();
  state.saloonVotes = freshSaloonVotes();
  startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
  logGame("game:setup", { players: living.length, outlaws: outlawCount, force: Boolean(options.force) });
  return true;
}

function replayWithSamePlayers() {
  state.players.forEach((player, index) => {
    player.alive = true;
    player.role = "";
    player.sheriffPower = true;
    player.saloon = index % 2 === 0 ? "A" : "B";
    player.voiceRoom = player.fake ? "Preparation" : "";
    player.voiceReady = Boolean(player.fake);
    player.voiceMuted = false;
    player.voiceDeafened = false;
  });
  if (!state.hostId && state.players.length) state.hostId = state.players[0].id;
  state.hostMessage = "Nouvelle manche prete avec les memes joueurs.";
  state.phase = freshPhase();
  state.duel = freshDuel();
  state.saloonVotes = freshSaloonVotes();
  logGame("game:replay");
}

function clampDuration(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(Math.round(number), max));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function serveFile(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const requested = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  const file = path.resolve(requested);

  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp"
    };
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/events") {
    const game = useGame(url.searchParams.get("code"));
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    const client = { res, code: game.code };
    clients.add(client);
    res.write(`event: state\ndata: ${JSON.stringify(publicState(req))}\n\n`);
    req.on("close", () => clients.delete(client));
    return;
  }

  if (url.pathname === "/api/state") {
    useGame(url.searchParams.get("code"));
    sendJson(res, publicState(req));
    return;
  }

  if (url.pathname === "/api/games") {
    sendJson(res, { games: publicGameList(req) });
    return;
  }

  if (url.pathname === "/api/debug-log") {
    const game = findGame(url.searchParams.get("code"));
    if (url.searchParams.get("admin") !== adminCode) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Acces diagnostic refuse.");
      return;
    }
    if (!game) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Partie introuvable.");
      return;
    }
    if (url.searchParams.get("format") === "json") {
      sendJson(res, { code: game.code, logs: game.debugLogs || [] });
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(debugLogText(game) || "Aucun log pour cette partie.");
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/create-game") {
    const body = await readBody(req);
    const game = useGame(makeGameCode());
    game.visibility = body.visibility === "public" ? "public" : "private";
    const name = String(body.name || "").trim().slice(0, 24) || "Joueur";
    const player = addPlayer(name);
    logGame("game:create", { visibility: game.visibility, player: player.name });
    emit();
    sendJson(res, { code: game.code, player, state: publicState(req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await readBody(req);
    const requested = findGame(body.code);
    if (!requested) {
      sendJson(res, { error: "Partie introuvable." });
      return;
    }
    useGame(body.code);
    const name = String(body.name || "").trim().slice(0, 24) || "Joueur";
    const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      logGame("player:reconnect", { player: existing.name });
      emit();
      sendJson(res, { player: existing, state: publicState(req) });
      return;
    }

    const started = gameHasStarted();
    if (started) {
      logGame("player:join-blocked", { player: name, reason: "already-started" });
      sendJson(res, { error: "Partie deja demarree. Attends la prochaine manche." });
      return;
    }
    const player = {
      id: makeId(),
      name,
      saloon: state.players.filter((item) => item.alive && item.saloon === "A").length <= state.players.filter((item) => item.alive && item.saloon === "B").length ? "A" : "B",
      alive: true,
      role: "",
      sheriffPower: true,
      voiceRoom: "",
      voiceReady: false,
      voiceMuted: false,
      voiceDeafened: false,
      fake: false
    };
    state.players.push(player);
    if (!state.hostId) state.hostId = player.id;
    logGame("player:join", { player: player.name });
    emit();
    sendJson(res, { player, state: publicState(req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/player") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.id);
    state.hostMessage = "";
    if (player) {
      if (body.saloon === "A" || body.saloon === "B") player.saloon = body.saloon;
      if (typeof body.alive === "boolean") player.alive = body.alive;
      logGame("player:update", { player: player.name, saloon: player.saloon, alive: player.alive });
    }
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/delete-player") {
    const body = await readBody(req);
    useGame(body.code);
    state.hostMessage = "";
    const index = state.players.findIndex((item) => item.id === body.id);
    const removed = index !== -1 ? state.players[index] : null;
    if (index !== -1) state.players.splice(index, 1);
    if (state.hostId === body.id) state.hostId = state.players[0]?.id || "";
    if (state.duel.leftId === body.id || state.duel.rightId === body.id) {
      state.duel = freshDuel();
    }
    logGame("player:delete", { player: removed?.name || body.id || "" });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/fake-players") {
    const body = await readBody(req);
    useGame(body.code);
    const created = addFakePlayers(5);
    logGame("player:fake-added", { count: created.length });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/new-game") {
    const body = await readBody(req);
    useGame(body.code);
    state.players.splice(0, state.players.length);
    state.hostId = "";
    state.hostMessage = "";
    state.phase = freshPhase();
    state.duel = freshDuel();
    state.saloonVotes = freshSaloonVotes();
    logGame("game:new");
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/replay-game") {
    const body = await readBody(req);
    useGame(body.code);
    replayWithSamePlayers();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    useGame(body.code);
    activeSettings = normalizeSettings(body);
    state.settings = activeSettings;
    if (state.settings.voiceChatEnabled === false) {
      state.players.forEach((player) => {
        player.voiceRoom = "";
        player.voiceReady = false;
        player.voiceMuted = false;
        player.voiceDeafened = false;
      });
    }
    if (!state.duel.running && !state.duel.leftId && !state.duel.rightId) {
      state.duel = freshDuel();
    }
    state.hostMessage = "Reglages enregistres.";
    logGame("settings:update", state.settings);
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/setup-game") {
    const body = await readBody(req);
    useGame(body.code);
    const started = setupGame(body.outlawCount, { force: Boolean(body.force) });
    logGame("game:setup-request", { started, force: Boolean(body.force), outlawCount: body.outlawCount });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signal") {
    const body = await readBody(req);
    useGame(body.code);
    if (state.settings.voiceChatEnabled !== false && body.from && body.to && body.kind) {
      if (body.kind !== "candidate") logGame("voice:signal", { from: debugPlayer(body.from) || body.from, to: debugPlayer(body.to) || body.to, kind: body.kind });
      emitSignal({
        from: String(body.from),
        to: String(body.to),
        kind: String(body.kind),
        payload: body.payload || null
      });
    }
    sendJson(res, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/client-log") {
    const body = await readBody(req);
    useGame(body.code);
    logGame(`client:${String(body.type || "event").slice(0, 60)}`, {
      player: debugPlayer(body.playerId) || String(body.playerId || ""),
      details: body.details || {}
    });
    sendJson(res, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assign-roles") {
    const body = await readBody(req);
    useGame(body.code);
    const started = setupGame(body.outlawCount, { force: Boolean(body.force) });
    logGame("game:assign-roles", { started, force: Boolean(body.force), outlawCount: body.outlawCount });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assign-saloons") {
    const body = await readBody(req);
    useGame(body.code);
    const living = state.players.filter((player) => player.alive);
    shuffle(living).forEach((player, index) => {
      player.saloon = index % 2 === 0 ? "A" : "B";
    });
    logGame("game:assign-saloons");
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/duel") {
    const body = await readBody(req);
    useGame(body.code);
    state.hostMessage = "";
    const left = state.players.find((player) => player.id === body.leftId);
    const right = state.players.find((player) => player.id === body.rightId);

    if (!left || !right) {
      state.hostMessage = "Choisissez deux joueurs pour preparer le duel.";
      logGame("duel:manual-blocked", { reason: "missing-player" });
      emit();
      sendJson(res, publicState(req));
      return;
    }

    if (!left.alive || !right.alive) {
      state.hostMessage = "Action impossible.";
      logGame("duel:manual-blocked", { reason: "dead-player", left: left.name, right: right.name });
      emit();
      sendJson(res, publicState(req));
      return;
    }

    state.duel = { ...freshDuel(), leftId: body.leftId || "", rightId: body.rightId || "" };
    logGame("duel:manual-prepared", { left: left.name, right: right.name });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start-duel") {
    const body = await readBody(req);
    useGame(body.code);
    logGame("duel:manual-start-request");
    startDuelTimer();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/voice-room") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.playerId);
    if (player) {
      const voiceChatEnabled = state.settings.voiceChatEnabled !== false;
      player.voiceRoom = voiceChatEnabled ? String(body.room || "") : "";
      player.voiceReady = voiceChatEnabled && Boolean(body.ready);
      player.voiceMuted = voiceChatEnabled && Boolean(body.muted);
      player.voiceDeafened = voiceChatEnabled && Boolean(body.deafened);
      logGame("voice:room", {
        player: player.name,
        room: player.voiceRoom,
        ready: player.voiceReady,
        muted: player.voiceMuted,
        deafened: player.voiceDeafened
      });
      emit();
    }
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start-discussion") {
    const body = await readBody(req);
    useGame(body.code);
    state.duel = freshDuel();
    state.saloonVotes = freshSaloonVotes();
    startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
    logGame("phase:discussion-manual-start");
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/saloon-vote") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.playerId);
    state.hostMessage = "";

    if (!player || !player.alive) {
      logGame("vote:ignored", { reason: "player-missing-or-dead", playerId: body.playerId || "" });
      sendJson(res, publicState(req));
      return;
    }

    if (state.phase.name === "final") {
      logGame("vote:ignored", { reason: "final-phase", player: player.name });
      sendJson(res, publicState(req));
      return;
    }

    if (state.phase.name !== "discussion" || !state.phase.running) {
      logGame("vote:ignored", { reason: "not-discussion", player: player.name, phase: state.phase.name });
      sendJson(res, publicState(req));
      return;
    }

    if (body.cancel || !body.targetId) {
      delete state.saloonVotes[player.saloon][player.id];
      logGame("vote:cancel", { player: player.name, saloon: player.saloon });
      emit();
      sendJson(res, publicState(req));
      return;
    }

    const target = state.players.find((item) => item.id === body.targetId);
    if (!target || !target.alive || player.saloon !== target.saloon) {
      logGame("vote:ignored", { reason: "invalid-target", player: player.name, target: target?.name || body.targetId || "" });
      sendJson(res, publicState(req));
      return;
    }

    state.saloonVotes[player.saloon][player.id] = target.id;
    logGame("vote:set", { player: player.name, target: target.name, saloon: player.saloon });

    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/volunteer-duel") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.playerId);
    if (player) {
      state.saloonVotes[player.saloon][player.id] = player.id;
      logGame("vote:volunteer", { player: player.name, saloon: player.saloon });
    }
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/choice") {
    const body = await readBody(req);
    useGame(body.code);
    state.hostMessage = "";
    if (state.duel.revealed || state.duel.resolved || state.duel.sheriffShot) {
      logGame("choice:ignored", { reason: "duel-closed", playerId: body.playerId || "", choice: body.choice || "" });
      sendJson(res, publicState(req));
      return;
    }
    if (body.playerId === state.duel.leftId) state.duel.leftChoice = body.choice === "shoot" ? "shoot" : "hold";
    if (body.playerId === state.duel.rightId) state.duel.rightChoice = body.choice === "shoot" ? "shoot" : "hold";
    logGame("choice:set", { player: debugPlayer(body.playerId) || body.playerId || "", choice: body.choice === "shoot" ? "shoot" : "hold" });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reveal") {
    const body = await readBody(req);
    useGame(body.code);
    state.duel.revealed = true;
    state.hostMessage = "";
    state.duel.running = false;
    logGame("duel:manual-reveal");
    applyResolution();
    scheduleAfterDuel();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/sheriff-shot") {
    const body = await readBody(req);
    useGame(body.code);
    state.hostMessage = "";
    if (body.playerId) {
      const player = state.players.find((item) => item.id === body.playerId);
      const inDuel = state.duel.leftId === body.playerId || state.duel.rightId === body.playerId;
      if (!player || player.role !== "Sheriff" || !player.sheriffPower || !inDuel || state.duel.revealed || state.duel.resolved) {
        logGame("sheriff-shot:blocked", {
          player: player?.name || body.playerId || "",
          role: player?.role || "",
          power: Boolean(player?.sheriffPower),
          inDuel,
          revealed: Boolean(state.duel.revealed),
          resolved: Boolean(state.duel.resolved)
        });
        sendJson(res, publicState(req));
        return;
      }
      const targetId = state.duel.leftId === body.playerId ? state.duel.rightId : state.duel.leftId;
      if (state.duel.leftId === body.playerId) state.duel.leftChoice = "shoot";
      if (state.duel.rightId === body.playerId) state.duel.rightChoice = "shoot";
      if (state.duel.leftId === targetId) state.duel.leftChoice = "hold";
      if (state.duel.rightId === targetId) state.duel.rightChoice = "hold";
      state.duel.sheriffShot = true;
      logGame("sheriff-shot:accepted", { sheriff: player.name, target: debugPlayer(targetId) || targetId });
      applyResolution();
      emit();
      sendJson(res, publicState(req));
      return;
    }
    state.hostMessage = "Action impossible.";
    logGame("sheriff-shot:blocked", { reason: "missing-player-id" });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset-duel") {
    const body = await readBody(req);
    useGame(body.code);
    state.duel = freshDuel();
    state.hostMessage = "";
    state.phase = freshPhase();
    state.saloonVotes = freshSaloonVotes();
    logGame("duel:reset");
    emit();
    sendJson(res, publicState(req));
    return;
  }

  serveFile(req, res);
});

setInterval(() => {
  const previous = state;
  for (const game of games.values()) {
    state = game;
    activeSettings = game.settings;
    const before = state.duel.remaining;
    const wasRunning = state.duel.running;
    const phaseBefore = state.phase.remaining;
    const phaseWasRunning = state.phase.running;
    computeDuel();
    computePhase();
    if (wasRunning || before !== state.duel.remaining || phaseWasRunning || phaseBefore !== state.phase.remaining) emitGame(game);
  }
  state = previous;
  activeSettings = previous.settings;
}, 500);

scheduleMeteredRefresh();

server.listen(port, "0.0.0.0", () => {
  console.log(`Host: http://127.0.0.1:${port}/`);
  console.log(`Phones: http://${localAddress()}:${port}/join.html`);
});
