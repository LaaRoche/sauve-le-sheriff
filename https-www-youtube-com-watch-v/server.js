import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(globalThis.process?.env?.PORT || 5204);
const defaultSettings = {
  duelDuration: 30,
  resultDuration: 15,
  transitionDuration: 10,
  discussionDuration: 150
};
const clients = new Set();
let resultResetTimer = null;
let lastPublicOrigin = "";
let activeSettings = { ...defaultSettings };

const state = {
  players: [],
  hostMessage: "",
  settings: activeSettings,
  phase: freshPhase(),
  duel: freshDuel()
};

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

function freshDuel() {
  return {
    leftId: "",
    rightId: "",
    leftChoice: "",
    rightChoice: "",
    running: false,
    startedAt: 0,
    remaining: activeSettings.duelDuration,
    revealed: false,
    resolved: false,
    sheriffShot: false,
    resultMessage: "",
    resultDetail: ""
  };
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
      startPhase("transition", "Temps mort : rejoignez vos saloons", state.settings.transitionDuration);
    } else if (phase.name === "transition") {
      startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
    } else if (phase.name === "discussion") {
      phase.label = "Discussion terminee : choisissez les duellistes";
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
    joinUrl: `${origin}/join.html`,
    players: state.players,
    winner: getWinner(),
    hostMessage: state.hostMessage,
    settings: state.settings,
    phase: state.phase,
    duel: state.duel
  };
}

function getWinner() {
  const living = state.players.filter((player) => player.alive);
  const outlaws = living.filter((player) => player.role === "Hors-la-loi").length;
  const citizens = living.filter((player) => player.role === "Citoyen" || player.role === "Sheriff").length;
  const hasRoles = state.players.some((player) => player.role);

  if (!hasRoles) return "";
  if (outlaws === 0) return "Les citoyens";
  if (outlaws > citizens) return "Les hors-la-loi";
  return "";
}

function sendJson(res, body) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
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
  const payload = `event: state\ndata: ${JSON.stringify(publicState())}\n\n`;
  for (const res of clients) res.write(payload);
}

function moveToOtherSaloon(player) {
  if (!player) return;
  player.saloon = player.saloon === "A" ? "B" : "A";
}

function applyResolution() {
  const duel = state.duel;
  if (duel.resolved) return;
  const left = state.players.find((player) => player.id === duel.leftId);
  const right = state.players.find((player) => player.id === duel.rightId);
  if (!left || !right || !duel.leftChoice || !duel.rightChoice) return;

  if (duel.leftChoice === "shoot" && duel.rightChoice === "shoot") {
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
    duel.resultDetail = `${left.name} et ${right.name} doivent se reveler leur role en prive, puis echanger de saloon.`;
  }
  duel.resolved = true;
}

function startPhase(name, label, seconds) {
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
    transitionDuration: clampDuration(body.transitionDuration, 0, 120, defaultSettings.transitionDuration),
    discussionDuration: clampDuration(body.discussionDuration, 10, 900, defaultSettings.discussionDuration)
  };
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
      ".js": "text/javascript; charset=utf-8"
    };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });
    clients.add(res);
    res.write(`event: state\ndata: ${JSON.stringify(publicState(req))}\n\n`);
    req.on("close", () => clients.delete(res));
    return;
  }

  if (url.pathname === "/api/state") {
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/join") {
    const body = await readBody(req);
    const name = String(body.name || "").trim().slice(0, 24) || "Joueur";
    const existing = state.players.find((player) => player.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      emit();
      sendJson(res, { player: existing, state: publicState(req) });
      return;
    }

    const player = {
      id: makeId(),
      name,
      saloon: state.players.filter((item) => item.alive && item.saloon === "A").length <= state.players.filter((item) => item.alive && item.saloon === "B").length ? "A" : "B",
      alive: true,
      role: ""
    };
    state.players.push(player);
    emit();
    sendJson(res, { player, state: publicState(req) });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/player") {
    const body = await readBody(req);
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
    state.hostMessage = "";
    const index = state.players.findIndex((item) => item.id === body.id);
    if (index !== -1) state.players.splice(index, 1);
    if (state.duel.leftId === body.id || state.duel.rightId === body.id) {
      state.duel = freshDuel();
    }
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/new-game") {
    state.players.splice(0, state.players.length);
    state.hostMessage = "";
    state.phase = freshPhase();
    state.duel = freshDuel();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    const body = await readBody(req);
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

  if (req.method === "POST" && url.pathname === "/api/assign-roles") {
    const body = await readBody(req);
    state.hostMessage = "";
    const living = state.players.filter((player) => player.alive);
    state.hostMessage = "";
    if (living.length < 2) {
      emit();
      sendJson(res, publicState(req));
      return;
    }
    const outlawCount = Math.max(1, Math.min(Number(body.outlawCount || 1), Math.max(1, living.length - 1)));
    const roles = ["Sheriff"];
    for (let index = 0; index < outlawCount; index += 1) roles.push("Hors-la-loi");
    while (roles.length < living.length) roles.push("Citoyen");

    const shuffledRoles = shuffle(roles);
    living.forEach((player, index) => {
      player.role = shuffledRoles[index] || "Citoyen";
    });
    state.players.filter((player) => !player.alive).forEach((player) => {
      player.role = "";
    });

    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/assign-saloons") {
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
    computeDuel();
    state.hostMessage = "";
    state.phase = freshPhase();
    state.duel.running = true;
    state.duel.startedAt = Date.now() - (state.settings.duelDuration - state.duel.remaining) * 1000;
    state.duel.revealed = false;
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/start-discussion") {
    startPhase("discussion", "Discussion dans les saloons", state.settings.discussionDuration);
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/choice") {
    const body = await readBody(req);
    state.hostMessage = "";
    if (body.playerId === state.duel.leftId) state.duel.leftChoice = body.choice === "shoot" ? "shoot" : "hold";
    if (body.playerId === state.duel.rightId) state.duel.rightChoice = body.choice === "shoot" ? "shoot" : "hold";
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reveal") {
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
    state.hostMessage = "";
    if (body.playerId) {
      const player = state.players.find((item) => item.id === body.playerId);
      const inDuel = state.duel.leftId === body.playerId || state.duel.rightId === body.playerId;
      if (!player || player.role !== "Sheriff" || !inDuel) {
        sendJson(res, publicState(req));
        return;
      }
      if (state.duel.leftId === body.playerId) state.duel.leftChoice = "shoot";
      if (state.duel.rightId === body.playerId) state.duel.rightChoice = "shoot";
      if (state.duel.leftId !== body.playerId && !state.duel.leftChoice) state.duel.leftChoice = "hold";
      if (state.duel.rightId !== body.playerId && !state.duel.rightChoice) state.duel.rightChoice = "hold";
      state.duel.running = false;
      state.duel.revealed = true;
      state.duel.sheriffShot = true;
      applyResolution();
      state.duel.resultDetail = "Tir anticipe du sheriff.";
      scheduleAfterDuel();
      emit();
      sendJson(res, publicState(req));
      return;
    }
    state.duel.sheriffShot = true;
    state.duel.running = false;
    state.duel.revealed = true;
    state.duel.resultMessage = "Le sheriff tire avant la fin du duel.";
    state.duel.resultDetail = "Le joueur vise par le sheriff est elimine. Le maitre de partie applique ce tir, puis relance la manche.";
    scheduleAfterDuel();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/reset-duel") {
    state.duel = freshDuel();
    state.hostMessage = "";
    state.phase = freshPhase();
    emit();
    sendJson(res, publicState(req));
    return;
  }

  serveFile(req, res);
});

setInterval(() => {
  const before = state.duel.remaining;
  const wasRunning = state.duel.running;
  const phaseBefore = state.phase.remaining;
  const phaseWasRunning = state.phase.running;
  computeDuel();
  computePhase();
  if (wasRunning || before !== state.duel.remaining || phaseWasRunning || phaseBefore !== state.phase.remaining) emit();
}, 500);

server.listen(port, "0.0.0.0", () => {
  console.log(`Host: http://127.0.0.1:${port}/`);
  console.log(`Phones: http://${localAddress()}:${port}/join.html`);
});
