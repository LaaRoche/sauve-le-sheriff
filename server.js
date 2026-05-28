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
  discussionDuration: 150
};
const duelReadyDuration = 8;
const clients = new Set();
let resultResetTimer = null;
let lastPublicOrigin = "";
let activeSettings = { ...defaultSettings };
let state = createGameState("GLOBAL");
const games = new Map([[state.code, state]]);

function createGameState(code) {
  const settings = { ...defaultSettings };
  return {
    code,
    players: [],
    hostId: "",
    hostMessage: "",
    settings,
    phase: freshPhase(),
    duel: freshDuel(settings),
    saloonVotes: freshSaloonVotes()
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
  return Boolean(leftId && rightId);
}

function missingVoicePlayers() {
  return state.players.filter((player) => player.alive && (!player.voiceReady || player.voiceMuted));
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

function setupFinalDuelIfNeeded() {
  const { living, outlaws, empire } = livingCamps();
  if (living.length !== 2 || outlaws.length !== 1 || empire.length !== 1) return false;
  if (state.duel.leftId || state.duel.rightId || state.duel.running || state.duel.revealed) return false;
  state.duel = { ...freshDuel(), leftId: living[0].id, rightId: living[1].id };
  startPhase("final", "Duel final : rejoignez le vocal Duel", duelReadyDuration);
  return true;
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
      state.duel = freshDuel();
      state.saloonVotes = freshSaloonVotes();
      startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
    } else if (phase.name === "discussion") {
      if (resolveDiscussionVotes()) {
        startPhase("duel-ready", "Duel pret : rejoignez le vocal Duel", duelReadyDuration);
      } else {
        phase.label = "Discussion terminee : choisissez les duellistes";
      }
    } else if (phase.name === "duel-ready" || phase.name === "final") {
      if (!maybeStartDuelFromVoice()) {
        phase.label = "En attente des micros des duellistes";
      }
    }
  }
  return phase;
}

function publicState(req) {
  computeDuel();
  computePhase();
  if (!getWinner()) setupFinalDuelIfNeeded();
  const origin = requestOrigin(req) || lastPublicOrigin || `http://${localAddress()}:${port}`;
  if (requestOrigin(req)) lastPublicOrigin = requestOrigin(req);
  return {
    code: state.code,
    joinUrl: `${origin}/join.html`,
    players: state.players,
    hostId: state.hostId,
    winner: getWinner(),
    hostMessage: state.hostMessage,
    settings: state.settings,
    phase: state.phase,
    duel: state.duel,
    saloonVotes: state.saloonVotes
  };
}

function getWinner() {
  const { outlaws, empire } = livingCamps();
  const hasRoles = state.players.some((player) => player.role);

  if (!hasRoles) return "";
  if (outlaws.length === 0) return "L'Empire";
  if (outlaws.length > empire.length) return "Les hors-la-loi";
  return "";
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
    voiceMuted: false
  };
  state.players.push(player);
  if (!state.hostId) state.hostId = player.id;
  return player;
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

function maybeStartDuelFromVoice() {
  const duel = state.duel;
  if (!duel.leftId || !duel.rightId || duel.running || duel.revealed || duel.resolved) return false;
  const left = state.players.find((player) => player.id === duel.leftId);
  const right = state.players.find((player) => player.id === duel.rightId);
  if (!left?.alive || !right?.alive) return false;
  if (left.voiceRoom === "Duel" && right.voiceRoom === "Duel" && left.voiceReady && right.voiceReady && !left.voiceMuted && !right.voiceMuted) {
    startDuelTimer();
    return true;
  }
  return false;
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
}

function scheduleAfterDuel() {
  if (resultResetTimer) clearTimeout(resultResetTimer);
  startPhase("result", "Resultat du duel", state.settings.resultDuration);
}

function normalizeSettings(body) {
  return {
    duelDuration: clampDuration(body.duelDuration, 5, 300, defaultSettings.duelDuration),
    resultDuration: clampDuration(body.resultDuration, 3, 120, defaultSettings.resultDuration),
    discussionDuration: clampDuration(body.discussionDuration, 10, 900, defaultSettings.discussionDuration)
  };
}

function setupGame(outlawCountInput, options = {}) {
  state.hostMessage = "";
  const living = state.players.filter((player) => player.alive);
  if (living.length < 3) {
    state.hostMessage = "Ajoute au moins 3 joueurs pour demarrer une partie test.";
    return false;
  }
  const missingMic = missingVoicePlayers();
  if (missingMic.length && !options.force) {
    state.hostMessage = `Micro manquant : ${missingMic.map((player) => player.name).join(", ")}.`;
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
  return true;
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
      ".svg": "image/svg+xml; charset=utf-8"
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

  if (req.method === "POST" && url.pathname === "/api/create-game") {
    const body = await readBody(req);
    const game = useGame(makeGameCode());
    const name = String(body.name || "").trim().slice(0, 24) || "Joueur";
    const player = addPlayer(name);
    emit();
    sendJson(res, { code: game.code, player, state: publicState(req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await readBody(req);
    useGame(body.code);
    const name = String(body.name || "").trim().slice(0, 24) || "Joueur";
    const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      emit();
      sendJson(res, { player: existing, state: publicState(req) });
      return;
    }

    const started = gameHasStarted();
    const player = {
      id: makeId(),
      name,
      saloon: state.players.filter((item) => item.alive && item.saloon === "A").length <= state.players.filter((item) => item.alive && item.saloon === "B").length ? "A" : "B",
      alive: !started,
      role: "",
      sheriffPower: true,
      voiceRoom: "",
      voiceReady: false,
      voiceMuted: false
    };
    state.players.push(player);
    if (!state.hostId) state.hostId = player.id;
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
    if (index !== -1) state.players.splice(index, 1);
    if (state.hostId === body.id) state.hostId = state.players[0]?.id || "";
    if (state.duel.leftId === body.id || state.duel.rightId === body.id) {
      state.duel = freshDuel();
    }
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
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    useGame(body.code);
    activeSettings = normalizeSettings(body);
    state.settings = activeSettings;
    if (!state.duel.running && !state.duel.leftId && !state.duel.rightId) {
      state.duel = freshDuel();
    }
    state.hostMessage = "Reglages enregistres.";
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/setup-game") {
    const body = await readBody(req);
    useGame(body.code);
    setupGame(body.outlawCount, { force: Boolean(body.force) });
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/signal") {
    const body = await readBody(req);
    useGame(body.code);
    if (body.from && body.to && body.kind) {
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

  if (req.method === "POST" && url.pathname === "/api/assign-roles") {
    const body = await readBody(req);
    useGame(body.code);
    setupGame(body.outlawCount, { force: Boolean(body.force) });
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
      emit();
      sendJson(res, publicState(req));
      return;
    }

    if (!left.alive || !right.alive) {
      state.hostMessage = "Action impossible.";
      emit();
      sendJson(res, publicState(req));
      return;
    }

    state.duel = { ...freshDuel(), leftId: body.leftId || "", rightId: body.rightId || "" };
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start-duel") {
    const body = await readBody(req);
    useGame(body.code);
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
      player.voiceRoom = String(body.room || "");
      player.voiceReady = Boolean(body.ready);
      player.voiceMuted = Boolean(body.muted);
      maybeStartDuelFromVoice();
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
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/saloon-vote") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.playerId);
    const target = state.players.find((item) => item.id === body.targetId);
    state.hostMessage = "";

    if (!player || !target || !player.alive || !target.alive || player.saloon !== target.saloon) {
      sendJson(res, publicState(req));
      return;
    }

    if (state.phase.name === "final") {
      sendJson(res, publicState(req));
      return;
    }

    if (state.phase.name !== "discussion" || !state.phase.running) {
      sendJson(res, publicState(req));
      return;
    }

    state.saloonVotes[player.saloon][player.id] = target.id;

    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/volunteer-duel") {
    const body = await readBody(req);
    useGame(body.code);
    const player = state.players.find((item) => item.id === body.playerId);
    if (player) state.saloonVotes[player.saloon][player.id] = player.id;
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/choice") {
    const body = await readBody(req);
    useGame(body.code);
    state.hostMessage = "";
    if (state.duel.revealed || state.duel.resolved || state.duel.sheriffShot) {
      sendJson(res, publicState(req));
      return;
    }
    if (body.playerId === state.duel.leftId) state.duel.leftChoice = body.choice === "shoot" ? "shoot" : "hold";
    if (body.playerId === state.duel.rightId) state.duel.rightChoice = body.choice === "shoot" ? "shoot" : "hold";
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
        sendJson(res, publicState(req));
        return;
      }
      const targetId = state.duel.leftId === body.playerId ? state.duel.rightId : state.duel.leftId;
      if (state.duel.leftId === body.playerId) state.duel.leftChoice = "shoot";
      if (state.duel.rightId === body.playerId) state.duel.rightChoice = "shoot";
      if (state.duel.leftId === targetId) state.duel.leftChoice = "hold";
      if (state.duel.rightId === targetId) state.duel.rightChoice = "hold";
      state.duel.running = false;
      state.duel.revealed = true;
      state.duel.sheriffShot = true;
      applyResolution();
      scheduleAfterDuel();
      emit();
      sendJson(res, publicState(req));
      return;
    }
    state.hostMessage = "Action impossible.";
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

server.listen(port, "0.0.0.0", () => {
  console.log(`Host: http://127.0.0.1:${port}/`);
  console.log(`Phones: http://${localAddress()}:${port}/join.html`);
});
