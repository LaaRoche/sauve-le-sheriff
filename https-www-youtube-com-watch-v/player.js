let gameCode = localStorage.getItem("sheriffGameCode") || new URLSearchParams(location.search).get("code") || "";
let playerId = gameCode ? localStorage.getItem(`sheriffPlayerId:${gameCode}`) || "" : "";
let state = null;

const joinForm = document.querySelector("#join-form");
const playerNameInput = document.querySelector("#player-name");
const gameCodeInput = document.querySelector("#game-code");
const createGameButton = document.querySelector("#create-game");
const createPublicGameButton = document.querySelector("#create-public-game");
const refreshGamesButton = document.querySelector("#refresh-games");
const publicGameList = document.querySelector("#public-game-list");
const leaveGameButton = document.querySelector("#leave-game");
const playerView = document.querySelector("#player-view");
const displayName = document.querySelector("#player-display-name");
const playerSaloon = document.querySelector("#player-saloon");
const playerStatus = document.querySelector("#player-status");
const playerRole = document.querySelector("#player-role");
const roleCard = document.querySelector(".role-card");
const roleArt = document.querySelector("#role-art");
const playerPhase = document.querySelector("#player-phase");
const playerAction = document.querySelector("#player-action");
const timeLeft = document.querySelector("#time-left");
const clockRing = document.querySelector("#clock-ring");
const message = document.querySelector("#player-message");
const gameRosterPanel = document.querySelector("#game-roster-panel");
const gameRosterKicker = document.querySelector("#game-roster-kicker");
const gameRosterTitle = document.querySelector("#game-roster-title");
const gameRosterGrid = document.querySelector("#game-roster-grid");
const saloonVotePanel = document.querySelector("#saloon-vote-panel");
const saloonVoteList = document.querySelector("#saloon-vote-list");
const revealPanel = document.querySelector("#reveal-panel");
const revealKicker = document.querySelector("#reveal-kicker");
const revealTitle = document.querySelector("#reveal-title");
const revealCard = document.querySelector("#reveal-card");
const revealArt = document.querySelector("#reveal-art");
const revealRole = document.querySelector("#reveal-role");
const revealDetail = document.querySelector("#reveal-detail");
const spectatorPanel = document.querySelector("#spectator-panel");
const spectatorGrid = document.querySelector("#spectator-grid");
const choiceButtons = document.querySelector("#choice-buttons");
const sheriffPhoneShot = document.querySelector("#sheriff-phone-shot");
const enableVoice = document.querySelector("#enable-voice");
const muteMicButton = document.querySelector("#mute-mic");
const deafenVoiceButton = document.querySelector("#deafen-voice");
const reconnectVoiceButton = document.querySelector("#reconnect-voice");
const voiceRoom = document.querySelector("#voice-room");
const voiceStatus = document.querySelector("#voice-status");
const remoteAudio = document.querySelector("#remote-audio");
const audioSettingsOpen = document.querySelector("#audio-settings-open");
const audioSettingsClose = document.querySelector("#audio-settings-close");
const audioSettingsModal = document.querySelector("#audio-settings-modal");
const voiceVolumeInput = document.querySelector("#voice-volume");
const effectsVolumeInput = document.querySelector("#effects-volume");
const voiceSensitivityInput = document.querySelector("#voice-sensitivity");
const hostTools = document.querySelector("#host-tools");
const hostGameCode = document.querySelector("#host-game-code");
const hostPlayerCount = document.querySelector("#host-player-count");
const hostMessage = document.querySelector("#host-message");
const hostOutlawCount = document.querySelector("#host-outlaw-count");
const hostDuelDuration = document.querySelector("#host-duel-duration");
const hostResultDuration = document.querySelector("#host-result-duration");
const hostDiscussionDuration = document.querySelector("#host-discussion-duration");
const hostPlayerList = document.querySelector("#host-player-list");
const hostOutlawRecommendation = document.querySelector("#host-outlaw-recommendation");
const hostVoiceOn = document.querySelector("#host-voice-on");
const hostVoiceOff = document.querySelector("#host-voice-off");
const hostVoiceHelp = document.querySelector("#host-voice-help");
const hostStartGame = document.querySelector("#host-start-game");
const hostForceStart = document.querySelector("#host-force-start");
const hostNewGame = document.querySelector("#host-new-game");
const hostAddFakePlayers = document.querySelector("#host-add-fake-players");
const hostEndTools = document.querySelector("#host-end-tools");
const hostEndNewGame = document.querySelector("#host-end-new-game");
const endRoles = document.querySelector("#end-roles");
const endRoleList = document.querySelector("#end-role-list");

let voiceEnabled = false;
let micMuted = false;
let deafened = false;
let localStream = null;
let lastVoiceRoom = "";
let lastVoiceReady = null;
let lastVoiceMuted = null;
let lastVoiceDeafened = null;
let voiceConnectionIssue = false;
let hostTimersTouched = false;
let hostOutlawTouched = false;
let hostVoiceTouched = false;
let hostVoiceChatEnabled = true;
let voiceIceServers = [{ urls: "stun:stun.l.google.com:19302" }];
const peers = new Map();
const pendingCandidates = new Map();
const speakingIds = new Set();
const speakingMonitors = new Map();
let events = null;
let previousPhaseName = "";
let previousPhaseRunning = false;
let lastGunKey = "";
let audioContext = null;
const audioSettings = {
  voice: Number(localStorage.getItem("sheriffVoiceVolume") || 100),
  effects: Number(localStorage.getItem("sheriffEffectsVolume") || 70),
  sensitivity: localStorage.getItem("sheriffVoiceSensitivity") || "normal"
};
const sensitivityProfiles = {
  low: { openRatio: 3.2, closeRatio: 1.9, minOpen: 10, minClose: 5.8, holdMs: 420 },
  normal: { openRatio: 2.35, closeRatio: 1.55, minOpen: 7.2, minClose: 4.5, holdMs: 560 },
  high: { openRatio: 1.65, closeRatio: 1.18, minOpen: 4.6, minClose: 3.1, holdMs: 720 }
};
const soundFiles = {
  normalGun: "assets/sfx-gun-normal.mp3",
  sheriffGun: "assets/sfx-gun-sheriff.mp3"
};

function setupRulesModal() {
  const modal = document.querySelector("#rules-modal");
  document.querySelectorAll("[data-rules-open]").forEach((button) => {
    button.addEventListener("click", () => modal.classList.remove("hidden"));
  });
  document.querySelectorAll("[data-rules-close]").forEach((button) => {
    button.addEventListener("click", () => modal.classList.add("hidden"));
  });
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
}

function setupAudioSettings() {
  voiceVolumeInput.value = audioSettings.voice;
  effectsVolumeInput.value = audioSettings.effects;
  if (voiceSensitivityInput) voiceSensitivityInput.value = audioSettings.sensitivity;
  audioSettingsOpen.addEventListener("click", () => audioSettingsModal.classList.remove("hidden"));
  audioSettingsClose.addEventListener("click", () => audioSettingsModal.classList.add("hidden"));
  audioSettingsModal.addEventListener("click", (event) => {
    if (event.target === audioSettingsModal) audioSettingsModal.classList.add("hidden");
  });
  voiceVolumeInput.addEventListener("input", () => {
    audioSettings.voice = Number(voiceVolumeInput.value);
    localStorage.setItem("sheriffVoiceVolume", String(audioSettings.voice));
    updateRemoteAudioVolume();
  });
  effectsVolumeInput.addEventListener("input", () => {
    audioSettings.effects = Number(effectsVolumeInput.value);
    localStorage.setItem("sheriffEffectsVolume", String(audioSettings.effects));
  });
  voiceSensitivityInput?.addEventListener("change", () => {
    audioSettings.sensitivity = voiceSensitivityInput.value;
    localStorage.setItem("sheriffVoiceSensitivity", audioSettings.sensitivity);
  });
}

function getSensitivityProfile() {
  return sensitivityProfiles[audioSettings.sensitivity] || sensitivityProfiles.normal;
}

function ensureAudioContext() {
  if (!audioContext) audioContext = new AudioContext();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, duration, volume, type = "sine") {
  if (!volume) return;
  const context = ensureAudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.03);
}

function playBell() {
  const volume = audioSettings.effects / 100;
  playTone(740, 0.18, volume * 0.16, "triangle");
  setTimeout(() => playTone(520, 0.34, volume * 0.12, "triangle"), 120);
}

function playFallbackGunshot(delay = 0) {
  const volume = audioSettings.effects / 100;
  setTimeout(() => {
    playTone(90, 0.12, volume * 0.24, "sawtooth");
    setTimeout(() => playTone(55, 0.18, volume * 0.16, "square"), 40);
  }, delay);
}

function playSoundFile(src, delay, fallback) {
  if (!audioSettings.effects) return;
  setTimeout(() => {
    const audio = new Audio(src);
    let fallbackPlayed = false;
    const playFallbackOnce = () => {
      if (fallbackPlayed) return;
      fallbackPlayed = true;
      fallback();
    };
    audio.volume = Math.min(1, Math.max(0, audioSettings.effects / 100));
    audio.addEventListener("error", playFallbackOnce, { once: true });
    audio.play().catch(playFallbackOnce);
  }, delay);
}

function playShotSound(type = "normal", delay = 0) {
  const src = type === "sheriff" ? soundFiles.sheriffGun : soundFiles.normalGun;
  playSoundFile(src, delay, () => playFallbackGunshot(0));
}

function updateRemoteAudioVolume() {
  document.querySelectorAll("#remote-audio audio").forEach((audio) => {
    audio.volume = deafened ? 0 : audioSettings.voice / 100;
    audio.muted = deafened;
  });
}

function updateSpeakingIndicators() {
  document.querySelectorAll("[data-player-row-id]").forEach((row) => {
    row.classList.toggle("is-speaking", speakingIds.has(row.dataset.playerRowId));
  });
}

function setSpeaking(id, isSpeaking) {
  if (!id) return;
  const changed = isSpeaking ? !speakingIds.has(id) : speakingIds.has(id);
  if (!changed) return;
  if (isSpeaking) speakingIds.add(id);
  else speakingIds.delete(id);
  updateSpeakingIndicators();
}

function stopSpeakingMonitor(id) {
  const monitor = speakingMonitors.get(id);
  if (monitor) {
    monitor.stopped = true;
    if (monitor.frame) cancelAnimationFrame(monitor.frame);
  }
  speakingMonitors.delete(id);
  setSpeaking(id, false);
}

function stopAllSpeakingMonitors() {
  for (const id of [...speakingMonitors.keys()]) stopSpeakingMonitor(id);
  speakingIds.clear();
  updateSpeakingIndicators();
}

function setupSpeakingMonitor(id, stream) {
  if (!id || !stream?.getAudioTracks?.().length) return;
  stopSpeakingMonitor(id);

  try {
    const context = ensureAudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const monitor = { stopped: false, frame: 0 };
    let active = false;
    let noiseFloor = 0;
    let sampleCount = 0;
    let lastChange = 0;
    let lastSpeechAt = 0;
    const calibrationStartedAt = performance.now();

    const readVolume = () => {
      if (monitor.stopped) return;
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const value of data) {
        const delta = value - 128;
        sum += delta * delta;
      }
      const level = Math.sqrt(sum / data.length);
      const now = performance.now();
      const profile = getSensitivityProfile();
      const calibrationAge = now - calibrationStartedAt;
      const shouldLearnNoise = !active || calibrationAge < 1300;

      if (shouldLearnNoise) {
        sampleCount += 1;
        const weight = sampleCount < 24 ? 1 / sampleCount : 0.035;
        noiseFloor = noiseFloor ? noiseFloor * (1 - weight) + level * weight : level;
      }

      const openThreshold = Math.max(profile.minOpen, noiseFloor * profile.openRatio);
      const closeThreshold = Math.max(profile.minClose, noiseFloor * profile.closeRatio);
      const aboveOpen = level >= openThreshold;
      const aboveClose = level >= closeThreshold;
      if (aboveOpen) lastSpeechAt = now;

      const canActivate = sampleCount > 10 || calibrationAge > 450;
      const speaking = active
        ? aboveClose || now - lastSpeechAt < profile.holdMs
        : canActivate && aboveOpen;

      if (speaking !== active && now - lastChange > 90) {
        active = speaking;
        lastChange = now;
        setSpeaking(id, active);
      }
      monitor.frame = requestAnimationFrame(readVolume);
    };

    speakingMonitors.set(id, monitor);
    readVolume();
  } catch {
    stopSpeakingMonitor(id);
  }
}

function handleAudioCues(previous, nextState, player) {
  if (!previous || !player) return;
  const previousName = previous.phase?.name || "";
  const nextName = nextState.phase?.name || "";
  if (nextName === "discussion" && previousName !== "discussion") playBell();
  if (previousName === "discussion" && nextName !== "discussion") playBell();

  const previousDuel = previous.duel || {};
  const duel = nextState.duel || {};
  const isDuelist = duel.leftId === player.id || duel.rightId === player.id;
  if (!isDuelist) return;

  const gunKey = duel.sheriffShot
    ? `${duel.leftId}-${duel.rightId}-sheriff-shot`
    : `${duel.leftId}-${duel.rightId}-${duel.leftChoice}-${duel.rightChoice}-${duel.resultMessage}`;

  const sheriffShotStarted = duel.sheriffShot && !previousDuel.sheriffShot;
  if (sheriffShotStarted && gunKey !== lastGunKey) {
    lastGunKey = gunKey;
    playShotSound("sheriff");
    return;
  }

  const normalRevealStarted = duel.revealed && !previousDuel.revealed && !duel.sheriffShot;
  const normalShotCount = [duel.leftChoice, duel.rightChoice].filter((choice) => choice === "shoot").length;
  if (normalRevealStarted && normalShotCount > 0 && gunKey !== lastGunKey) {
    lastGunKey = gunKey;
    if (normalShotCount >= 1) playShotSound("normal", 0);
    if (normalShotCount >= 2) playShotSound("normal", 220);
  }
}

async function postJson(url, body) {
  const payload = { ...(body || {}) };
  if (gameCode && !payload.code) payload.code = gameCode;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function sendClientLog(type, details = {}) {
  if (!gameCode || !playerId) return;
  fetch("/api/client-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: gameCode, playerId, type, details })
  }).catch(() => {});
}

async function refreshPublicGames() {
  if (!publicGameList) return;
  const response = await fetch("/api/games");
  const data = await response.json();
  const games = data.games || [];
  if (!games.length) {
    publicGameList.innerHTML = "<p>Aucune partie en preparation.</p>";
    return;
  }
  publicGameList.innerHTML = games.map((game) => {
    const isPublic = game.visibility === "public";
    return `<button class="public-game-item ${isPublic ? "is-public" : "is-private"}" ${isPublic ? `data-public-code="${game.code}"` : "data-private-game"} type="button">
    <span>${escapeHtml(game.hostName)}</span>
    <strong>${game.playerCount} joueur(s)</strong>
    <em>${game.readyCount || 0} micro(s)</em>
    <small>${isPublic ? "Publique - entrer" : "Privee - code"}</small>
  </button>`;
  }).join("");
}

function showJoinError(text) {
  if (!publicGameList) return;
  publicGameList.innerHTML = `<p>${escapeHtml(text)}</p>`;
}

async function joinWithCode(code) {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.focus();
    return;
  }
  const previousCode = gameCode;
  gameCode = String(code || "").trim().toUpperCase();
  const result = await postJson("/api/join", { name, code: gameCode });
  if (result.error) {
    gameCode = previousCode;
    showJoinError(result.error);
    return;
  }
  storeSession(result.state.code, result.player.id);
  render(result.state);
}

function storeSession(code, id) {
  gameCode = code || gameCode;
  playerId = id || playerId;
  if (gameCode) localStorage.setItem("sheriffGameCode", gameCode);
  if (gameCode && playerId) localStorage.setItem(`sheriffPlayerId:${gameCode}`, playerId);
  const name = playerNameInput.value.trim();
  if (name) localStorage.setItem("sheriffPlayerName", name);
  if (gameCodeInput) gameCodeInput.value = gameCode;
  connectEvents();
}

async function reconnectStoredPlayer() {
  const storedName = localStorage.getItem("sheriffPlayerName") || playerNameInput.value.trim();
  if (!gameCode || !storedName) return false;
  playerNameInput.value = storedName;
  const result = await postJson("/api/join", { name: storedName, code: gameCode });
  if (result.error) return false;
  storeSession(result.state.code, result.player.id);
  render(result.state);
  return true;
}

function resetLocalGameSession(notice = "") {
  const oldCode = gameCode;
  events?.close();
  events = null;
  for (const id of [...peers.keys()]) closePeer(id);
  stopAllSpeakingMonitors();
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  voiceEnabled = false;
  micMuted = false;
  deafened = false;
  lastVoiceRoom = "";
  lastVoiceReady = null;
  lastVoiceMuted = null;
  lastVoiceDeafened = null;
  enableVoice.textContent = "Activer le micro";
  enableVoice.classList.remove("voice-on", "voice-muted");
  muteMicButton.classList.add("hidden");
  deafenVoiceButton.classList.add("hidden");
  reconnectVoiceButton.classList.add("hidden");
  remoteAudio.innerHTML = "";
  if (oldCode) localStorage.removeItem(`sheriffPlayerId:${oldCode}`);
  localStorage.removeItem("sheriffGameCode");
  gameCode = "";
  playerId = "";
  state = null;
  if (gameCodeInput) gameCodeInput.value = "";
  joinForm.classList.remove("hidden");
  playerView.classList.add("hidden");
  leaveGameButton.classList.add("hidden");
  message.textContent = "En attente du maitre de partie.";
  if (notice) showJoinError(notice);
  setTimeout(refreshPublicGames, notice ? 2500 : 0);
}

async function leaveCurrentGame() {
  const oldCode = gameCode;
  const oldPlayerId = playerId;
  const isHost = Boolean(state?.hostId && state.hostId === oldPlayerId);
  if (oldCode && oldPlayerId) {
    if (isHost) {
      const result = await postJson("/api/close-game", {
        code: oldCode,
        playerId: oldPlayerId
      });
      if (result.error) throw new Error(result.error);
    } else {
      await postJson("/api/delete-player", { code: oldCode, id: oldPlayerId });
    }
  }
  resetLocalGameSession(
    isHost
      ? "Partie fermee. Tous les joueurs sont revenus au lobby."
      : "Tu as quitte la partie."
  );
}

function connectEvents() {
  if (!gameCode) return;
  events?.close();
  events = new EventSource(
    `/events?code=${encodeURIComponent(gameCode)}&playerId=${encodeURIComponent(playerId)}`
  );
  events.addEventListener("state", (event) => render(JSON.parse(event.data)));
  events.addEventListener("game-closed", (event) => {
    const data = JSON.parse(event.data || "{}");
    resetLocalGameSession(data.reason || "L'organisateur a ferme la partie.");
  });
  events.addEventListener("signal", (event) => {
    handleSignal(event).catch(() => {
      markVoiceIssue();
    });
  });
}

function myPlayer() {
  return state?.players.find((player) => player.id === playerId);
}

function myChoice(duel) {
  if (duel.leftId === playerId) return duel.leftChoice;
  if (duel.rightId === playerId) return duel.rightChoice;
  return null;
}

function isInDuel(duel) {
  return duel.leftId === playerId || duel.rightId === playerId;
}

function duelIsOpen(duel) {
  return Boolean(duel.leftId && duel.rightId && !duel.revealed);
}

function choiceLabel(choice) {
  if (choice === "shoot") return "Tu as choisi : tirer. Attends la fin du timer.";
  if (choice === "hold") return "Tu as choisi : ne pas tirer. La carte adverse sera revelee a la fin si personne ne tire.";
  return "Choisis secretement avant la fin du decompte.";
}

function mySaloonDuelist(duel, player) {
  if (!player) return "";
  return player.saloon === "A" ? duel.leftId : duel.rightId;
}

function mySaloonVote(player) {
  if (!player || !state?.saloonVotes) return "";
  return state.saloonVotes[player.saloon]?.[player.id] || "";
}

function playerName(id) {
  return state?.players.find((player) => player.id === id)?.name || "";
}

function duelOpponent(duel) {
  if (duel.leftId === playerId) return state?.players.find((player) => player.id === duel.rightId);
  if (duel.rightId === playerId) return state?.players.find((player) => player.id === duel.leftId);
  return null;
}

function setTask(phase, action) {
  playerPhase.textContent = phase;
  playerAction.textContent = action;
}

function setViewMode(mode) {
  playerView.dataset.mode = mode || "default";
  document.body.dataset.playerMode = playerView.dataset.mode;
  window.EmpireSheriff3D?.setMode(playerView.dataset.mode);
}

function setScreen(phase, action, note) {
  setTask(phase, action);
  message.textContent = note || action;
  const text = `${phase} ${action} ${note || ""}`.toLowerCase();
  if (text.includes("vote")) setViewMode("vote");
  else if (text.includes("duel en cours")) setViewMode("duel");
  else if (text.includes("duel") && text.includes("venir")) setViewMode("duel-ready");
  else if (text.includes("carte") || text.includes("resultat")) setViewMode("result");
  else if (text.includes("elimine") || text.includes("mort")) setViewMode("spectator");
  else if (text.includes("discussion")) setViewMode("discussion");
  else if (text.includes("preparation")) setViewMode("lobby");
  else setViewMode("default");
}

function setRevealPanel({ kicker, title, detail, role, art }) {
  revealKicker.textContent = kicker || "Resultat du duel";
  revealTitle.textContent = title || "Le duel est termine";
  revealDetail.textContent = detail || (gameUsesVoice() ? "Rejoins ton vocal." : "Observe le resultat.");
  revealCard.classList.toggle("hidden", !role);
  if (role) {
    revealRole.textContent = role;
    revealArt.src = art || roleImage(role);
  }
  revealPanel.classList.remove("hidden");
}

function hideRevealPanel() {
  revealPanel.classList.add("hidden");
  revealCard.classList.add("hidden");
}

function roleImage(role) {
  if (role === "Sheriff") return "assets/role-sheriff.svg";
  if (role === "Hors-la-loi") return "assets/role-outlaw.svg";
  if (role === "Citoyen") return "assets/role-citizen.svg";
  return "assets/role-hidden.svg";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function voiceRoomFor(player, duel) {
  if (!player) return "";
  if (state?.winner) return "Fin de partie";
  if (!player.role) return gameHasStarted() ? "Hors partie" : "Preparation";
  const isDuelist = duel.leftId === player.id || duel.rightId === player.id;
  const resultPhase = state?.phase?.name === "result";
  const duelPhase = state?.phase?.name === "duel-ready" || state?.phase?.name === "final" || duel.running;
  if (isDuelist && resultPhase && duel.leftId && duel.rightId) return "Duel";
  if (isDuelist && duelPhase && duelIsOpen(duel)) return "Duel";
  if (!player.alive) return "Elimines";
  if (state?.phase?.name === "idle") return `Saloon ${player.saloon}`;
  return `Saloon ${player.saloon}`;
}

function gameHasStarted() {
  if (!state) return false;
  return Boolean(
    state.winner ||
    state.phase?.name !== "idle" ||
    state.players.some((player) => player.role) ||
    state.duel.leftId ||
    state.duel.rightId
  );
}

function gameUsesVoice() {
  return state?.settings?.voiceChatEnabled !== false;
}

function setHostVoiceMode(enabled, touched = true) {
  hostVoiceChatEnabled = Boolean(enabled);
  if (touched) hostVoiceTouched = true;
  hostVoiceOn?.classList.toggle("selected", hostVoiceChatEnabled);
  hostVoiceOff?.classList.toggle("selected", !hostVoiceChatEnabled);
  hostVoiceOn?.setAttribute("aria-pressed", String(hostVoiceChatEnabled));
  hostVoiceOff?.setAttribute("aria-pressed", String(!hostVoiceChatEnabled));
  if (hostVoiceHelp) {
    hostVoiceHelp.textContent = hostVoiceChatEnabled
      ? "Les joueurs utilisent le vocal integre."
      : "Aucun micro demande. Ideal quand vous jouez dans la meme piece.";
  }
  if (touched && state?.hostId === playerId && !gameHasStarted()) {
    playerView.classList.toggle("is-no-voice", !hostVoiceChatEnabled);
    document.body.dataset.voiceMode = hostVoiceChatEnabled ? "with-micro" : "without-micro";
    const missingMic = hostVoiceChatEnabled
      ? state.players.filter((player) => player.alive && !player.fake && !player.voiceReady)
      : [];
    hostForceStart.classList.toggle("hidden", !missingMic.length);
    hostMessage.textContent = hostVoiceChatEnabled
      ? missingMic.length
        ? `Micro manquant : ${missingMic.map((player) => player.name).join(", ")}.`
        : "Mode avec micro selectionne. Tous les micros sont prets."
      : "Mode sans micro selectionne. Aucun micro ne sera demande.";
    renderHostPlayerList();
  }
}

function renderHostPlayerList() {
  if (!hostPlayerList || !state) return;
  if (!state.players.length) {
    hostPlayerList.innerHTML = "<p>Aucun joueur connecte.</p>";
    return;
  }
  hostPlayerList.innerHTML = state.players
    .map((player, index) => {
      const isHost = state.hostId === player.id;
      const voiceRequired = hostVoiceTouched ? hostVoiceChatEnabled : gameUsesVoice();
      const micReady = !voiceRequired || player.fake || player.voiceReady;
      const typeLabel = player.fake ? "Bot test" : "Vrai joueur";
      const hostLabel = isHost ? "Organisateur" : "Joueur";
      const readyLabel = micReady ? "Pret" : "Pas pret";
      const micLabel = !voiceRequired ? "Sans micro" : player.fake ? "Pret test" : player.voiceDeafened ? "Sourdine" : player.voiceMuted ? "Micro coupe" : player.voiceReady ? "Micro actif" : "Micro manquant";
      const canKick = state.hostId !== player.id && !gameHasStarted();
      return `<div class="host-player-item">
        <div class="host-player-main">
          <span>${index + 1}. ${escapeHtml(player.name)}</span>
          <div class="host-player-checks">
            <small class="ready">Connecte</small>
            <small class="${micReady ? "ready" : "not-ready"}">${micLabel}</small>
            <small class="${micReady ? "ready" : "not-ready"}">${readyLabel}</small>
            <small>${typeLabel}</small>
            <small class="${isHost ? "ready" : ""}">${hostLabel}</small>
          </div>
        </div>
        ${canKick ? `<button class="danger kick-player" data-kick-id="${player.id}" type="button">Kick</button>` : ""}
      </div>`;
    })
    .join("");
}

function rosterStatus(player) {
  if (!gameUsesVoice()) return "Sans micro";
  if (player.fake) return "Bot";
  if (player.voiceDeafened) return "Sourdine";
  if (player.voiceMuted) return "Micro coupe";
  if (player.voiceReady) return "Micro actif";
  return "Micro manquant";
}

function rosterRow(player, options = {}) {
  const tags = [];
  if (state?.hostId === player.id) tags.push("Organisateur");
  if (player.id === playerId) tags.push("Toi");
  if (options.showStatus) tags.push(rosterStatus(player));
  if (options.label) tags.push(options.label);
  const speaking = speakingIds.has(player.id);
  return `<div class="game-roster-row${speaking ? " is-speaking" : ""}" data-player-row-id="${player.id}">
    <span><i class="speaking-dot" aria-hidden="true"></i>${escapeHtml(player.name)}</span>
    <small>${tags.map(escapeHtml).join(" · ") || "Joueur"}</small>
  </div>`;
}

function rosterGroup(title, players, options = {}) {
  const rows = players.length
    ? players.map((player) => rosterRow(player, options)).join("")
    : "<p>Aucun joueur</p>";
  return `<section>
    <h3>${escapeHtml(title)}</h3>
    ${rows}
  </section>`;
}

function renderGameRoster(player, duel) {
  if (!gameRosterPanel || !state || !player) return;

  const sheriffShotDuelist = isInDuel(duel) && duel.sheriffShot && (duel.running || state.phase?.name === "result");
  if (!player.alive && player.role && !sheriffShotDuelist) {
    gameRosterPanel.classList.add("hidden");
    return;
  }

  const started = gameHasStarted();
  const duelIds = [duel.leftId, duel.rightId].filter(Boolean);
  gameRosterKicker.textContent = started ? "Ton groupe" : "Lobby";
  gameRosterTitle.textContent = started ? "Joueurs avec toi" : "Joueurs dans la partie";

  if (!started) {
    gameRosterGrid.innerHTML = [
      rosterGroup("Joueurs connectes", state.players, { showStatus: true })
    ].join("");
    gameRosterPanel.classList.remove("hidden");
    updateSpeakingIndicators();
    return;
  }

  const playerRoom = voiceRoomFor(player, duel);
  if (playerRoom === "Duel") {
    const duelists = state.players.filter((item) => duelIds.includes(item.id) && item.role);
    gameRosterGrid.innerHTML = rosterGroup("Duel", duelists);
  } else if (playerRoom.startsWith("Saloon ")) {
    const saloonPlayers = state.players.filter((item) => item.alive && item.role && item.saloon === player.saloon && !duelIds.includes(item.id));
    gameRosterGrid.innerHTML = rosterGroup(`Saloon ${player.saloon}`, saloonPlayers);
  } else if (state.winner) {
    gameRosterGrid.innerHTML = rosterGroup("Fin de partie", state.players.filter((item) => item.role));
  } else {
    gameRosterGrid.innerHTML = rosterGroup(playerRoom || "Ton vocal", state.players.filter((item) => item.id === player.id));
  }
  gameRosterPanel.classList.remove("hidden");
  updateSpeakingIndicators();
}

function syncHostSettings() {
  if (!state?.settings) return;
  const livingCount = state.players.filter((player) => player.alive).length;
  const recommendedOutlaws = recommendedOutlawCount(livingCount);
  if (!hostTimersTouched) {
    hostDuelDuration.value = state.settings.duelDuration;
    hostResultDuration.value = state.settings.resultDuration;
    hostDiscussionDuration.value = state.settings.discussionDuration;
  }
  if (!hostOutlawTouched) {
    hostOutlawCount.value = String(recommendedOutlaws);
  }
  if (!hostVoiceTouched) {
    setHostVoiceMode(state.settings.voiceChatEnabled !== false, false);
  }
  if (hostOutlawRecommendation) {
    hostOutlawRecommendation.textContent = `Conseille : ${recommendedOutlaws} hors-la-loi pour ${livingCount} joueur(s).`;
  }
}

function recommendedOutlawCount(playerCount) {
  if (playerCount >= 9) return 3;
  if (playerCount >= 6) return 2;
  return 1;
}

function renderSaloonVote(player) {
  if (!player || !state) return;
  const votingOpen = player.role && player.alive && state.phase?.name === "discussion" && !state.duel.leftId && !state.duel.rightId;
  saloonVotePanel.classList.toggle("hidden", !votingOpen);
  if (!votingOpen) {
    saloonVoteList.innerHTML = "";
    return;
  }

  const selectedId = mySaloonVote(player);
  const candidates = state.players.filter((item) => item.alive && item.role && item.saloon === player.saloon);
  const votes = state.saloonVotes?.[player.saloon] || {};
  const voterIds = new Set(candidates.map((candidate) => candidate.id));
  const totalVotes = Object.entries(votes).filter(([voterId]) => voterIds.has(voterId)).length || 0;
  saloonVotePanel.querySelector("span").textContent = `Saloon ${player.saloon}`;
  saloonVotePanel.querySelector("strong").textContent = "Choisir qui va au duel";
  saloonVoteList.innerHTML = candidates.map((candidate) => {
    const selected = selectedId === candidate.id ? " selected" : "";
    const label = selectedId === candidate.id ? "Annuler" : "Voter";
    const count = Object.values(votes).filter((targetId) => targetId === candidate.id).length;
    const percent = candidates.length ? Math.round((count / candidates.length) * 100) : 0;
    return `<button class="saloon-vote-choice${selected}" data-vote-target="${candidate.id}"${selected ? " data-vote-cancel=\"true\"" : ""} type="button">
      <span>${escapeHtml(candidate.name)}</span>
      <small>${count}/${candidates.length}</small>
      <i style="width:${percent}%"></i>
      <b>${label}</b>
    </button>`;
  }).join("");
  saloonVotePanel.querySelector("p").textContent = `${totalVotes}/${candidates.length} votes recus. En cas d'egalite, l'Empire tranche.`;
}

function spectatorRole(player) {
  if (!player.role) return "Hors partie";
  return player.alive ? player.role : `${player.role} - elimine`;
}

function spectatorStatus(player) {
  if (!player.role) return "Hors partie";
  return player.alive ? "Vivant" : "Elimine";
}

function spectatorGroup(title, players, className = "") {
  const rows = players.length
    ? players.map((item) => `<div class="spectator-row">
        <span>${escapeHtml(item.name)}</span>
        <strong>${escapeHtml(spectatorRole(item))}</strong>
        <em>${escapeHtml(spectatorStatus(item))}</em>
      </div>`).join("")
    : "<p>Aucun joueur</p>";
  return `<section class="${className}"><h3>${escapeHtml(title)}</h3>${rows}</section>`;
}

function spectatorPhaseCard(duel) {
  const phase = state?.phase || {};
  const remaining = duel.running ? duel.remaining : phase.running ? phase.remaining : phase.remaining || 0;
  const label = duel.running ? "Duel en cours" : phase.label || "En attente";
  return `<section class="spectator-current">
    <h3>Phase actuelle</h3>
    <div class="spectator-current-content">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(String(remaining))}</span>
      <small>secondes</small>
    </div>
  </section>`;
}

function renderSpectatorView(duel) {
  if (!spectatorGrid || !state) return;
  const title = spectatorPanel.querySelector("strong");
  const detail = spectatorPanel.querySelector("p");
  if (title) title.textContent = state.phase?.label || (duel.leftId && duel.rightId ? "Duel en cours" : "La partie continue");
  if (detail) detail.textContent = "Vue spectateur : suis les saloons, le duel et les roles reveles.";
  const duelIds = [duel.leftId, duel.rightId].filter(Boolean);
  const duelists = state.players.filter((item) => duelIds.includes(item.id));
  const saloonA = state.players.filter((item) => item.alive && item.role && item.saloon === "A" && !duelIds.includes(item.id));
  const saloonB = state.players.filter((item) => item.alive && item.role && item.saloon === "B" && !duelIds.includes(item.id));
  const eliminated = state.players.filter((item) => !item.alive && item.role);
  spectatorGrid.innerHTML = [
    spectatorGroup("Saloon A", saloonA, "spectator-saloon-a"),
    spectatorGroup("Saloon B", saloonB, "spectator-saloon-b"),
    spectatorGroup("Duel", duelists, "spectator-duel"),
    spectatorGroup("Elimines", eliminated, "spectator-eliminated"),
    spectatorPhaseCard(duel)
  ].join("");
}

async function sendSignal(to, kind, payload) {
  await postJson("/api/signal", { from: playerId, to, kind, payload });
}

function voiceTargetIds() {
  const player = myPlayer();
  if (!gameUsesVoice() || !voiceEnabled || !player || !state) return [];
  const myRoom = voiceRoomFor(player, state.duel);
  return state.players
    .filter((other) => !other.fake && other.id !== playerId && other.voiceRoom === myRoom && other.voiceReady)
    .map((other) => other.id);
}

function peerKey(id) {
  return `voice-${id}`;
}

function ensureAudioElement(id) {
  let audio = document.querySelector(`#${peerKey(id)}`);
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = peerKey(id);
    audio.autoplay = true;
    audio.playsInline = true;
    audio.volume = deafened ? 0 : audioSettings.voice / 100;
    audio.muted = deafened;
    remoteAudio.append(audio);
  }
  return audio;
}

function closePeer(id) {
  const connection = peers.get(id);
  if (connection) connection.close();
  peers.delete(id);
  pendingCandidates.delete(id);
  stopSpeakingMonitor(id);
  document.querySelector(`#${peerKey(id)}`)?.remove();
}

function createPeer(id) {
  if (peers.has(id)) return peers.get(id);

  const connection = new RTCPeerConnection({
    iceServers: voiceIceServers
  });

  localStream?.getTracks().forEach((track) => connection.addTrack(track, localStream));

  connection.addEventListener("icecandidate", (event) => {
    if (event.candidate) sendSignal(id, "candidate", event.candidate);
  });

  connection.addEventListener("track", (event) => {
    const stream = event.streams[0];
    ensureAudioElement(id).srcObject = stream;
    setupSpeakingMonitor(id, stream);
  });

  connection.addEventListener("connectionstatechange", () => {
    if (["failed", "disconnected"].includes(connection.connectionState)) {
      markVoiceIssue(`connection:${connection.connectionState}`, id);
      closePeer(id);
    }
  });

  connection.addEventListener("iceconnectionstatechange", () => {
    if (["failed", "disconnected"].includes(connection.iceConnectionState)) {
      markVoiceIssue(`ice:${connection.iceConnectionState}`, id);
    }
  });

  peers.set(id, connection);
  return connection;
}

function markVoiceIssue(reason = "unknown", peerId = "") {
  if (!voiceConnectionIssue) sendClientLog("voice-issue", { reason, peerId });
  voiceConnectionIssue = true;
  updateVoiceControls();
  voiceStatus.textContent = "Connexion instable. Utilise Reconnexion vocale.";
}

async function startOffer(id) {
  const connection = createPeer(id);
  const offer = await connection.createOffer();
  await connection.setLocalDescription(offer);
  await sendSignal(id, "offer", connection.localDescription);
}

async function handleSignal(event) {
  if (!voiceEnabled) return;
  const signal = JSON.parse(event.data);
  if (signal.to !== playerId || signal.from === playerId) return;

  if (signal.kind === "ready") {
    const player = myPlayer();
    const other = state?.players.find((item) => item.id === signal.from);
    if (!player || !other || voiceRoomFor(player, state.duel) !== voiceRoomFor(other, state.duel)) return;
    if (playerId < signal.from) {
      closePeer(signal.from);
      await startOffer(signal.from);
    } else {
      createPeer(signal.from);
    }
    return;
  }

  const connection = createPeer(signal.from);

  if (signal.kind === "offer") {
    await connection.setRemoteDescription(signal.payload);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    await sendSignal(signal.from, "answer", connection.localDescription);
    await flushCandidates(signal.from);
  }

  if (signal.kind === "answer") {
    await connection.setRemoteDescription(signal.payload);
    await flushCandidates(signal.from);
  }

  if (signal.kind === "candidate") {
    if (connection.remoteDescription) {
      await connection.addIceCandidate(signal.payload);
    } else {
      const list = pendingCandidates.get(signal.from) || [];
      list.push(signal.payload);
      pendingCandidates.set(signal.from, list);
    }
  }
}

async function flushCandidates(id) {
  const connection = peers.get(id);
  const list = pendingCandidates.get(id) || [];
  pendingCandidates.delete(id);
  for (const candidate of list) {
    await connection.addIceCandidate(candidate);
  }
}

async function syncVoicePeers() {
  const player = myPlayer();
  if (!gameUsesVoice() || !voiceEnabled || !player || !state) return;

  const myRoom = voiceRoomFor(player, state.duel);
  voiceRoom.textContent = myRoom;
  const ready = voiceEnabled && !deafened;
  const muted = micMuted || deafened;
  if (myRoom !== lastVoiceRoom || ready !== lastVoiceReady || muted !== lastVoiceMuted || deafened !== lastVoiceDeafened) {
    lastVoiceRoom = myRoom;
    lastVoiceReady = ready;
    lastVoiceMuted = muted;
    lastVoiceDeafened = deafened;
    await postJson("/api/voice-room", { playerId, room: myRoom, ready, muted, deafened });
  }
  const targetIds = voiceTargetIds();

  for (const id of peers.keys()) {
    if (!targetIds.includes(id)) closePeer(id);
  }

  for (const id of targetIds) {
    if (!peers.has(id)) {
      createPeer(id);
      if (playerId < id) await startOffer(id);
    }
  }

  updateVoiceControls();
  if (voiceConnectionIssue) {
    voiceStatus.textContent = "Connexion instable. Utilise Reconnexion vocale.";
    return;
  }
  if (deafened) {
    voiceStatus.textContent = "Sourdine active : tu n'entends plus et ton micro est coupe.";
  } else if (micMuted) {
    voiceStatus.textContent = targetIds.length ? `Micro coupe : tu entends ${targetIds.length} joueur(s).` : "Micro coupe : aucun joueur dans ton vocal.";
  } else {
    voiceStatus.textContent = targetIds.length ? `Vocal connecte : ${targetIds.length} joueur(s) dans ton vocal.` : "Vocal connecte : aucun joueur dans ton vocal.";
  }
}

async function enableVoiceChat() {
  if (!gameUsesVoice()) return;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  voiceConnectionIssue = false;
  voiceEnabled = true;
  micMuted = false;
  deafened = false;
  updateVoiceTrackState();
  setupSpeakingMonitor(playerId, localStream);
  updateVoiceControls();
  await syncVoicePeers();
  await Promise.all(voiceTargetIds().map((id) => sendSignal(id, "ready", null)));
  sendClientLog("voice-enabled", { room: voiceRoom.textContent, targets: voiceTargetIds().length });
}

function updateVoiceTrackState() {
  if (!localStream) return;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !micMuted && !deafened;
  });
  if (micMuted || deafened) setSpeaking(playerId, false);
}

function updateVoiceControls() {
  const voiceAvailable = gameUsesVoice();
  if (!voiceAvailable) {
    enableVoice.classList.add("hidden");
    muteMicButton.classList.add("hidden");
    deafenVoiceButton.classList.add("hidden");
    reconnectVoiceButton.classList.add("hidden");
    voiceRoom.textContent = "Sans micro";
    voiceStatus.textContent = "Le vocal integre est desactive pour cette partie.";
    return;
  }
  enableVoice.classList.remove("hidden");
  if (!voiceEnabled) {
    enableVoice.textContent = "🎙️ Activer micro";
    enableVoice.classList.remove("voice-on", "voice-muted");
    muteMicButton.classList.add("hidden");
    deafenVoiceButton.classList.add("hidden");
    reconnectVoiceButton.classList.add("hidden");
    return;
  }
  enableVoice.textContent = deafened ? "🚫 Sourdine totale" : micMuted ? "🔇 Micro coupe" : "🎙️ Micro actif";
  enableVoice.classList.toggle("voice-on", !micMuted && !deafened);
  enableVoice.classList.toggle("voice-muted", micMuted || deafened);
  muteMicButton.classList.remove("hidden");
  deafenVoiceButton.classList.remove("hidden");
  reconnectVoiceButton.classList.toggle("hidden", !voiceConnectionIssue);
  muteMicButton.textContent = micMuted && !deafened ? "🎙️ Rallumer micro" : "🔇 Couper micro";
  deafenVoiceButton.textContent = deafened ? "👂 Revenir au vocal" : "🚫 Sourdine totale";
  reconnectVoiceButton.textContent = "↻ Reconnecter vocal";
  muteMicButton.classList.toggle("voice-on", !micMuted && !deafened);
  muteMicButton.classList.toggle("voice-muted", micMuted && !deafened);
  deafenVoiceButton.classList.toggle("voice-muted", deafened);
}

function stopVoiceForGame() {
  for (const id of [...peers.keys()]) closePeer(id);
  stopSpeakingMonitor(playerId);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  voiceEnabled = false;
  micMuted = false;
  deafened = false;
  voiceConnectionIssue = false;
  lastVoiceRoom = "";
  lastVoiceReady = null;
  lastVoiceMuted = null;
  lastVoiceDeafened = null;
  remoteAudio.innerHTML = "";
  updateVoiceControls();
  if (playerId && state) {
    postJson("/api/voice-room", {
      playerId,
      room: "",
      ready: false,
      muted: false,
      deafened: false
    });
  }
}

async function reconnectVoiceChat() {
  if (!voiceEnabled) return;
  sendClientLog("voice-reconnect-start", { room: voiceRoom.textContent });
  for (const id of [...peers.keys()]) closePeer(id);
  stopSpeakingMonitor(playerId);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  voiceEnabled = false;
  micMuted = false;
  deafened = false;
  lastVoiceRoom = "";
  lastVoiceReady = null;
  lastVoiceMuted = null;
  lastVoiceDeafened = null;
  updateVoiceControls();
  voiceStatus.textContent = "Reconnexion vocale...";
  await enableVoiceChat();
  sendClientLog("voice-reconnect-done", { room: voiceRoom.textContent });
}

function toggleMicMute() {
  if (!localStream) return;
  if (deafened) deafened = false;
  micMuted = !micMuted;
  updateVoiceTrackState();
  updateRemoteAudioVolume();
  updateVoiceControls();
  syncVoicePeers();
  sendClientLog("voice-mute-toggle", { muted: micMuted });
}

function toggleDeafen() {
  if (!localStream) return;
  deafened = !deafened;
  if (deafened) micMuted = true;
  updateVoiceTrackState();
  updateRemoteAudioVolume();
  updateVoiceControls();
  syncVoicePeers();
  sendClientLog("voice-deafen-toggle", { deafened });
}

function render(nextState) {
  const previousState = state;
  state = nextState;
  if (Array.isArray(state?.voice?.iceServers) && state.voice.iceServers.length) {
    voiceIceServers = state.voice.iceServers;
  }
  const player = myPlayer();

  if (!player) {
    joinForm.classList.remove("hidden");
    playerView.classList.add("hidden");
    leaveGameButton.classList.add("hidden");
    gameRosterPanel.classList.add("hidden");
    setViewMode("join");
    return;
  }

  handleAudioCues(previousState, nextState, player);

  joinForm.classList.add("hidden");
  playerView.classList.remove("hidden");
  leaveGameButton.classList.remove("hidden");
  displayName.textContent = player.name;
  playerSaloon.textContent = "";
  playerStatus.textContent = player.alive ? "Connecte" : "Hors partie";
  playerRole.textContent = player.role || "Role non attribue";
  roleArt.src = roleImage(player.role);
  roleCard.classList.toggle("is-citizen", player.role === "Citoyen");
  roleCard.classList.toggle("is-outlaw", player.role === "Hors-la-loi");
  roleCard.classList.toggle("is-sheriff", player.role === "Sheriff");
  roleCard.classList.toggle("is-hidden-role", !player.role);
  window.EmpireSheriff3D?.setPlayer({
    role: player.role || "",
    saloon: player.saloon || "",
    alive: player.alive
  });
  const isHost = state.hostId === player.id;
  const hasStarted = gameHasStarted();
  const voiceRequired = isHost && !hasStarted && hostVoiceTouched
    ? hostVoiceChatEnabled
    : gameUsesVoice();
  playerView.classList.toggle("is-no-voice", !voiceRequired);
  document.body.dataset.voiceMode = voiceRequired ? "with-micro" : "without-micro";
  playerView.classList.toggle("is-host-setup", isHost && !hasStarted);
  if (isHost && !hasStarted) setViewMode("host-setup");
  hostTools.classList.toggle("hidden", !isHost || hasStarted);
  hostEndTools.classList.toggle("hidden", !isHost || !state.winner);
  if (isHost) {
    hostGameCode.textContent = state.code || gameCode || "-----";
    const livingCount = state.players.filter((item) => item.alive).length;
    const botCount = state.players.filter((item) => item.alive && item.fake).length;
    const realCount = Math.max(0, livingCount - botCount);
    hostPlayerCount.textContent = `${livingCount} joueur(s) connecte(s) - ${realCount} vrai(s), ${botCount} bot(s)`;
    hostMessage.textContent = state.hostMessage || (livingCount < 3 ? "Tu peux tester a partir de 3 joueurs. L'experience complete est meilleure a 5 joueurs ou plus." : "Configure la partie puis lance quand tout le monde est pret.");
    renderHostPlayerList();
    syncHostSettings();
    const missingMic = voiceRequired
      ? state.players.filter((item) => item.alive && !item.fake && !item.voiceReady)
      : [];
    hostForceStart.classList.toggle("hidden", !voiceRequired || !missingMic.length);
    if (!state.hostMessage && voiceRequired && missingMic.length) {
      hostMessage.textContent = `Micro manquant : ${missingMic.map((item) => item.name).join(", ")}.`;
    }
  }

  const duel = state.duel;
  const phase = state.phase || {};
  const saloonDuelist = mySaloonDuelist(duel, player);
  const isSelectedForDuel = saloonDuelist === player.id;
  if (!voiceRequired) {
    if (voiceEnabled || localStream || peers.size) stopVoiceForGame();
    else updateVoiceControls();
  } else {
    voiceRoom.textContent = voiceRoomFor(player, duel) || "Non connecte";
    syncVoicePeers();
  }
  if (isHost && !hasStarted) {
    gameRosterPanel.classList.add("hidden");
  } else {
    renderGameRoster(player, duel);
  }
  const shownTime = duel.running ? duel.remaining : phase.remaining || duel.remaining;
  timeLeft.textContent = String(shownTime);
  timeLeft.classList.toggle("compact-time", shownTime >= 100);
  clockRing.classList.toggle("warning", shownTime <= 5 && shownTime > 0);

  if (state.winner) {
    playerStatus.textContent = "Partie terminee";
    setViewMode("game-over");
    playerSaloon.textContent = "";
    timeLeft.textContent = "";
    clockRing.classList.remove("warning");
    clockRing.classList.add("game-over-ring");
    message.classList.add("big-message");
    message.textContent = `${state.winner} gagnent la partie.`;
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    saloonVotePanel.classList.add("hidden");
    gameRosterPanel.classList.add("hidden");
    hideRevealPanel();
    spectatorPanel.classList.add("hidden");
    endRoles.classList.remove("hidden");
    endRoleList.innerHTML = state.players.map((item) => `<div class="end-role-item"><span>${escapeHtml(item.name)}</span><strong>${escapeHtml(item.role || "Sans role")}</strong></div>`).join("");
    setTask("Partie terminee", gameUsesVoice()
      ? `${state.winner} gagnent. Rejoins le vocal Fin de partie.`
      : `${state.winner} gagnent la partie.`);
    return;
  }

  message.classList.remove("big-message");
  clockRing.classList.remove("game-over-ring");
  endRoles.classList.add("hidden");
  spectatorPanel.classList.add("hidden");
  hideRevealPanel();
  const staysInDuelAfterSheriffShot = isInDuel(duel) && duel.sheriffShot && (duel.running || phase.name === "result");

  if (!player.alive && !staysInDuelAfterSheriffShot) {
    playerStatus.textContent = "Tu es mort";
    playerSaloon.textContent = "";
    clockRing.classList.add("dead-ring");
    if (!player.role) {
      playerStatus.textContent = "Hors partie";
      message.textContent = "La partie est deja en cours. Attends la prochaine manche.";
      setScreen("Partie en cours", "Tu rejoindras la prochaine partie.", gameUsesVoice() ? "Reste hors des vocaux de jeu." : "Observe la partie.");
    } else {
      message.textContent = "Tu es mort. Garde le silence jusqu'a la fin de la partie.";
      setScreen("Elimine", "Tu ne participes plus.", gameUsesVoice() ? "Reste dans le vocal Elimines et garde le silence." : "Observe la suite de la partie.");
    renderSpectatorView(duel);
    spectatorPanel.classList.remove("hidden");
    gameRosterPanel.classList.add("hidden");
    }
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    saloonVotePanel.classList.add("hidden");
    hideRevealPanel();
    return;
  }

  clockRing.classList.remove("dead-ring");
  renderSaloonVote(player);

  if (!isInDuel(duel) || duel.revealed) {
    if (duel.revealed && phase.name === "result") {
      const opponent = duelOpponent(duel);
      const shouldRevealOpponent = isInDuel(duel) && duel.leftChoice === "hold" && duel.rightChoice === "hold" && !duel.sheriffShot && opponent;
      if (shouldRevealOpponent) {
        setScreen("Duel en cours", "", "Carte adverse revelee.");
        setRevealPanel({
          kicker: "Carte adverse",
          title: `${opponent.name}`,
          detail: "Personne n'a tire. La carte adverse est revelee.",
          role: opponent.role,
          art: roleImage(opponent.role)
        });
        setViewMode("result");
      } else if (isInDuel(duel)) {
        setScreen("Duel en cours", "", duel.resultMessage || "Resultat du duel.");
        setRevealPanel({
          kicker: "Resultat du duel",
          title: "Le duel est termine",
          detail: duel.resultMessage || (gameUsesVoice() ? "Rejoins ton vocal." : "Observe le resultat.")
        });
        setViewMode("result");
      } else {
        setScreen("Duel en cours", "", "Rejoins ton vocal. Le detail reste secret pour les autres saloons.");
        setViewMode("result");
      }
    } else if (phase.name === "final" && isInDuel(duel)) {
      setScreen("Duel en cours", "", "Tu es designe.");
    } else if (isSelectedForDuel) {
      setScreen("Duel en cours", "", "Tu es designe.");
    } else if (saloonDuelist) {
      setScreen("Duel en cours", "", `${playerName(saloonDuelist)} represente ton saloon.`);
    } else if (phase.name === "discussion") {
      const voteTarget = playerName(mySaloonVote(player));
      setScreen("Discussion Saloon", "", voteTarget ? `Ton vote : ${voteTarget}.` : "Choisis un representant.");
    } else if (phase.label === "Discussion terminee : choisissez les duellistes") {
      setScreen("Vote termine", "L'Empire tranche.", "En cas d'egalite, un tirage aleatoire decide.");
    } else if (!player.role) {
      setScreen("Preparation", "Attends ton role.", gameUsesVoice() ? "Rejoins le vocal Preparation pendant que tout le monde arrive." : "Attends que tout le monde rejoigne la partie.");
    } else if (phase.name === "result") {
      setScreen(phase.label, "Suis l'indication affichee.", phase.label);
    } else {
      setScreen(duel.leftId && duel.rightId ? "Duel en cours" : "En attente", duel.leftId && duel.rightId ? "" : "Attends le lancement.", duel.leftId && duel.rightId ? "Un duel est en cours." : "En attente du prochain timer.");
    }

    if (phase.name === "discussion" || phase.name === "result") {
      if (!message.textContent) message.textContent = phase.label;
    } else {
      if (!message.textContent) message.textContent = player.role ? (duel.leftId && duel.rightId ? "Observe le duel en cours." : "En attente du prochain duel.") : "Role pas encore distribue.";
    }
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    return;
  }

  saloonVotePanel.classList.add("hidden");
  const choice = myChoice(duel);
  if (duel.sheriffShot && duel.resolved) {
    playerStatus.textContent = player.alive ? "Connecte" : "Tu es mort";
    setScreen("Duel en cours", "", duel.resultMessage || "Tir du sheriff.");
    setRevealPanel({
      kicker: "Tir du sheriff",
      title: "Pouvoir du sheriff",
      detail: [duel.resultMessage, duel.resultDetail].filter(Boolean).join(" ")
    });
    setViewMode("result");
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    return;
  }
  setScreen("Duel en cours", "", duel.revealed ? "Les choix sont reveles." : choiceLabel(choice));
  choiceButtons.classList.toggle("hidden", duel.revealed);
  choiceButtons.querySelectorAll("[data-choice]").forEach((button) => {
    button.classList.toggle("selected-choice", button.dataset.choice === choice);
  });
  sheriffPhoneShot.classList.toggle("hidden", player.role !== "Sheriff" || player.sheriffPower === false || duel.revealed || duel.sheriffShot || duel.resolved);
}

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const wantedCode = gameCodeInput.value.trim().toUpperCase();
  if (!wantedCode) {
    gameCodeInput.focus();
    return;
  }
  await joinWithCode(wantedCode);
});

async function createGame(visibility) {
  const name = playerNameInput.value.trim();
  if (!name) {
    playerNameInput.focus();
    return;
  }
  const result = await postJson("/api/create-game", { name, visibility });
  storeSession(result.code, result.player.id);
  render(result.state);
}

createGameButton.addEventListener("click", async () => {
  await createGame("private");
});

createPublicGameButton.addEventListener("click", async () => {
  await createGame("public");
});

refreshGamesButton.addEventListener("click", () => {
  refreshPublicGames();
});

publicGameList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-public-code]");
  if (!button) {
    if (event.target.closest("[data-private-game]")) {
      gameCodeInput.focus();
      showJoinError("Entre le code de la partie privee pour la rejoindre.");
    }
    return;
  }
  await joinWithCode(button.dataset.publicCode);
});

leaveGameButton.addEventListener("click", () => {
  leaveCurrentGame().catch(() => {
    resetLocalGameSession("Impossible de joindre la partie. Retour au lobby.");
  });
});

choiceButtons.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-choice]");
  if (!button) return;
  sendClientLog("button-choice", { choice: button.dataset.choice });
  await postJson("/api/choice", { playerId, choice: button.dataset.choice });
});

sheriffPhoneShot.addEventListener("click", async () => {
  sendClientLog("button-sheriff-shot");
  await postJson("/api/sheriff-shot", { playerId });
});

saloonVoteList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-vote-target]");
  if (!button) return;
  sendClientLog("button-vote", {
    targetId: button.dataset.voteTarget,
    cancel: button.dataset.voteCancel === "true"
  });
  await postJson("/api/saloon-vote", {
    playerId,
    targetId: button.dataset.voteTarget,
    cancel: button.dataset.voteCancel === "true"
  });
});

hostPlayerList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-kick-id]");
  if (!button) return;
  await postJson("/api/delete-player", { id: button.dataset.kickId });
});

hostStartGame.addEventListener("click", async () => {
  await postJson("/api/settings", {
    duelDuration: hostDuelDuration.value,
    resultDuration: hostResultDuration.value,
    discussionDuration: hostDiscussionDuration.value,
    voiceChatEnabled: hostVoiceChatEnabled
  });
  await postJson("/api/setup-game", { outlawCount: hostOutlawCount.value });
});

hostForceStart.addEventListener("click", async () => {
  await postJson("/api/settings", {
    duelDuration: hostDuelDuration.value,
    resultDuration: hostResultDuration.value,
    discussionDuration: hostDiscussionDuration.value,
    voiceChatEnabled: hostVoiceChatEnabled
  });
  await postJson("/api/setup-game", { outlawCount: hostOutlawCount.value, force: true });
});

hostNewGame.addEventListener("click", async () => {
  await leaveCurrentGame();
});

hostAddFakePlayers.addEventListener("click", async () => {
  await postJson("/api/fake-players", {});
});

hostEndNewGame.addEventListener("click", async () => {
  const nextState = await postJson("/api/replay-game", { code: gameCode });
  render(nextState);
});

[hostDuelDuration, hostResultDuration, hostDiscussionDuration].forEach((input) => {
  input.addEventListener("input", () => {
    hostTimersTouched = true;
  });
});

hostOutlawCount.addEventListener("input", () => {
  hostOutlawTouched = true;
});

hostVoiceOn?.addEventListener("click", () => {
  setHostVoiceMode(true);
});

hostVoiceOff?.addEventListener("click", () => {
  setHostVoiceMode(false);
});

enableVoice.addEventListener("click", () => {
  if (!gameUsesVoice()) return;
  if (voiceEnabled) return;
  sendClientLog("voice-enable-click");
  enableVoiceChat().catch(() => {
    sendClientLog("voice-enable-failed");
    voiceStatus.textContent = "Micro bloque par le navigateur. Autorise le micro puis recharge.";
  });
});

muteMicButton.addEventListener("click", () => {
  toggleMicMute();
});

deafenVoiceButton.addEventListener("click", () => {
  toggleDeafen();
});

reconnectVoiceButton.addEventListener("click", () => {
  reconnectVoiceChat().catch(() => {
    voiceStatus.textContent = "Connexion instable. Autorise le micro puis reessaie.";
  });
});

if (gameCodeInput) gameCodeInput.value = gameCode;
const storedPlayerName = localStorage.getItem("sheriffPlayerName") || "";
if (storedPlayerName && !playerNameInput.value) playerNameInput.value = storedPlayerName;
if (gameCode) {
  reconnectStoredPlayer().then((connected) => {
    if (!connected) {
      connectEvents();
      fetch(`/api/state?code=${encodeURIComponent(gameCode)}`).then((response) => response.json()).then(render);
    }
  });
}
refreshPublicGames();
setInterval(() => {
  if (!joinForm.classList.contains("hidden")) refreshPublicGames();
}, 5000);
setupRulesModal();
setupAudioSettings();
