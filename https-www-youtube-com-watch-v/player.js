let playerId = localStorage.getItem("sheriffPlayerId") || "";
let state = null;

const joinForm = document.querySelector("#join-form");
const playerNameInput = document.querySelector("#player-name");
const playerView = document.querySelector("#player-view");
const displayName = document.querySelector("#player-display-name");
const playerSaloon = document.querySelector("#player-saloon");
const playerStatus = document.querySelector("#player-status");
const playerRole = document.querySelector("#player-role");
const roleArt = document.querySelector("#role-art");
const playerPhase = document.querySelector("#player-phase");
const playerAction = document.querySelector("#player-action");
const timeLeft = document.querySelector("#time-left");
const clockRing = document.querySelector("#clock-ring");
const message = document.querySelector("#player-message");
const volunteerDuel = document.querySelector("#volunteer-duel");
const choiceButtons = document.querySelector("#choice-buttons");
const sheriffPhoneShot = document.querySelector("#sheriff-phone-shot");
const enableVoice = document.querySelector("#enable-voice");
const voiceRoom = document.querySelector("#voice-room");
const voiceStatus = document.querySelector("#voice-status");
const remoteAudio = document.querySelector("#remote-audio");
const hostTools = document.querySelector("#host-tools");
const hostPlayerCount = document.querySelector("#host-player-count");
const hostMessage = document.querySelector("#host-message");
const hostOutlawCount = document.querySelector("#host-outlaw-count");
const hostDuelDuration = document.querySelector("#host-duel-duration");
const hostResultDuration = document.querySelector("#host-result-duration");
const hostDiscussionDuration = document.querySelector("#host-discussion-duration");
const hostPlayerList = document.querySelector("#host-player-list");
const hostStartGame = document.querySelector("#host-start-game");
const hostNewGame = document.querySelector("#host-new-game");
const hostEndTools = document.querySelector("#host-end-tools");
const hostEndNewGame = document.querySelector("#host-end-new-game");

let voiceEnabled = false;
let muted = false;
let localStream = null;
let lastVoiceRoom = "";
let hostTimersTouched = false;
const peers = new Map();
const pendingCandidates = new Map();

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

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return response.json();
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

function setScreen(phase, action, note) {
  setTask(phase, action);
  message.textContent = note || action;
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
  if (!player.alive) return "Elimines";
  if (state?.phase?.name === "final" && (duel.leftId === player.id || duel.rightId === player.id)) return "Duel";
  if ((duel.leftId === player.id || duel.rightId === player.id) && duelIsOpen(duel)) return "Duel";
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

function renderHostPlayerList() {
  if (!hostPlayerList || !state) return;
  if (!state.players.length) {
    hostPlayerList.innerHTML = "<p>Aucun joueur connecte.</p>";
    return;
  }
  hostPlayerList.innerHTML = state.players
    .map((player, index) => {
      const suffix = state.hostId === player.id ? " - organisateur" : "";
      return `<div class="host-player-item"><span>${index + 1}. ${escapeHtml(player.name)}${suffix}</span></div>`;
    })
    .join("");
}

function syncHostSettings() {
  if (hostTimersTouched || !state?.settings) return;
  hostDuelDuration.value = state.settings.duelDuration;
  hostResultDuration.value = state.settings.resultDuration;
  hostDiscussionDuration.value = state.settings.discussionDuration;
}

async function sendSignal(to, kind, payload) {
  await postJson("/api/signal", { from: playerId, to, kind, payload });
}

function voiceTargetIds() {
  const player = myPlayer();
  if (!voiceEnabled || !player || !state) return [];
  const myRoom = voiceRoomFor(player, state.duel);
  return state.players
    .filter((other) => other.id !== playerId && voiceRoomFor(other, state.duel) === myRoom)
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
    remoteAudio.append(audio);
  }
  return audio;
}

function closePeer(id) {
  const connection = peers.get(id);
  if (connection) connection.close();
  peers.delete(id);
  pendingCandidates.delete(id);
  document.querySelector(`#${peerKey(id)}`)?.remove();
}

function createPeer(id) {
  if (peers.has(id)) return peers.get(id);

  const connection = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  localStream?.getTracks().forEach((track) => connection.addTrack(track, localStream));

  connection.addEventListener("icecandidate", (event) => {
    if (event.candidate) sendSignal(id, "candidate", event.candidate);
  });

  connection.addEventListener("track", (event) => {
    ensureAudioElement(id).srcObject = event.streams[0];
  });

  connection.addEventListener("connectionstatechange", () => {
    if (["failed", "closed", "disconnected"].includes(connection.connectionState)) {
      closePeer(id);
    }
  });

  peers.set(id, connection);
  return connection;
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
  if (!voiceEnabled || !player || !state) return;

  const myRoom = voiceRoomFor(player, state.duel);
  voiceRoom.textContent = myRoom;
  if (myRoom !== lastVoiceRoom) {
    lastVoiceRoom = myRoom;
    await postJson("/api/voice-room", { playerId, room: myRoom });
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

  voiceStatus.textContent = targetIds.length ? `${targetIds.length} joueur(s) connecte(s) au meme vocal.` : "Tu es seul dans ce vocal pour l'instant.";
}

async function enableVoiceChat() {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  voiceEnabled = true;
  muted = false;
  enableVoice.textContent = "Micro actif";
  enableVoice.classList.add("voice-on");
  enableVoice.classList.remove("voice-muted");
  await syncVoicePeers();
  await Promise.all(voiceTargetIds().map((id) => sendSignal(id, "ready", null)));
}

function toggleMute() {
  if (!localStream) return;
  muted = !muted;
  localStream.getAudioTracks().forEach((track) => {
    track.enabled = !muted;
  });
  enableVoice.textContent = muted ? "Micro coupe" : "Micro actif";
  enableVoice.classList.toggle("voice-muted", muted);
  enableVoice.classList.toggle("voice-on", !muted);
  voiceStatus.textContent = muted ? "Ton micro est coupe." : "Ton micro est actif.";
}

function render(nextState) {
  state = nextState;
  const player = myPlayer();

  if (!player) {
    joinForm.classList.remove("hidden");
    playerView.classList.add("hidden");
    return;
  }

  joinForm.classList.add("hidden");
  playerView.classList.remove("hidden");
  displayName.textContent = player.name;
  playerSaloon.textContent = player.alive ? `Saloon ${player.saloon}` : "Elimine";
  playerStatus.textContent = player.alive ? "Connecte" : "Hors partie";
  const sheriffPowerText = player.role === "Sheriff" && player.sheriffPower === false ? " - pouvoir utilise" : "";
  playerRole.textContent = player.role ? `Role : ${player.role}${sheriffPowerText}` : "Role non attribue";
  roleArt.src = roleImage(player.role);
  const isHost = state.hostId === player.id;
  const hasStarted = gameHasStarted();
  playerView.classList.toggle("is-host-setup", isHost && !hasStarted);
  hostTools.classList.toggle("hidden", !isHost || hasStarted);
  hostEndTools.classList.toggle("hidden", !isHost || !state.winner);
  if (isHost) {
    const livingCount = state.players.filter((item) => item.alive).length;
    hostPlayerCount.textContent = `${livingCount} joueur(s) connecte(s)`;
    hostMessage.textContent = state.hostMessage || (livingCount < 3 ? "Tu peux tester a partir de 3 joueurs. L'experience complete est meilleure a 5 joueurs ou plus." : "Configure la partie puis lance quand tout le monde est pret.");
    renderHostPlayerList();
    syncHostSettings();
  }

  const duel = state.duel;
  const phase = state.phase || {};
  const saloonDuelist = mySaloonDuelist(duel, player);
  const isSelectedForDuel = saloonDuelist === player.id;
  voiceRoom.textContent = voiceRoomFor(player, duel) || "Non connecte";
  syncVoicePeers();
  const shownTime = duel.running || isInDuel(duel) ? duel.remaining : phase.remaining || duel.remaining;
  timeLeft.textContent = String(shownTime);
  timeLeft.classList.toggle("compact-time", shownTime >= 100);
  clockRing.classList.toggle("warning", shownTime <= 5 && shownTime > 0);

  if (state.winner) {
    playerStatus.textContent = "Partie terminee";
    playerSaloon.textContent = "Vocal Fin de partie";
    timeLeft.textContent = "";
    clockRing.classList.remove("warning");
    clockRing.classList.add("game-over-ring");
    message.classList.add("big-message");
    message.textContent = `${state.winner} gagnent la partie.`;
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    volunteerDuel.classList.add("hidden");
    setTask("Partie terminee", `${state.winner} gagnent. Rejoins le vocal Fin de partie.`);
    return;
  }

  message.classList.remove("big-message");
  clockRing.classList.remove("game-over-ring");

  if (!player.alive) {
    playerStatus.textContent = "Tu es mort";
    playerSaloon.textContent = "Hors partie";
    clockRing.classList.add("dead-ring");
    message.textContent = "Tu es mort. Garde le silence jusqu'a la fin de la partie.";
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    volunteerDuel.classList.add("hidden");
    setScreen("Elimine", "Tu ne participes plus.", "Reste dans le vocal Elimines et garde le silence.");
    return;
  }

  clockRing.classList.remove("dead-ring");

  if (!isInDuel(duel) || duel.revealed) {
    const canVolunteer = player.role && player.alive && (phase.name === "discussion" || phase.label === "Discussion terminee : choisissez les duellistes") && !saloonDuelist;
    volunteerDuel.classList.toggle("hidden", !canVolunteer);

    if (duel.revealed && phase.name === "result") {
      const opponent = duelOpponent(duel);
      const shouldRevealOpponent = isInDuel(duel) && duel.leftChoice === "hold" && duel.rightChoice === "hold" && !duel.sheriffShot && opponent;
      if (shouldRevealOpponent) {
        roleArt.src = roleImage(opponent.role);
        playerRole.textContent = `Carte adverse : ${opponent.role}`;
        setScreen("Carte revelee", `${opponent.name} est ${opponent.role}.`, "Regarde la carte adverse, puis rejoins ton nouveau saloon.");
      } else {
        setScreen("Resultat du duel", `Rejoins ${voiceRoomFor(player, duel)}.`, duel.resultMessage || "Resultat du duel.");
      }
    } else if (phase.name === "final" && isInDuel(duel)) {
      setScreen("Duel final", "Va dans le vocal Duel.", "Il ne reste qu'un face-a-face. Le timer demarre quand les deux joueurs sont en vocal Duel.");
    } else if (isSelectedForDuel) {
      setScreen("Duel a venir", "Va dans le vocal Duel.", "Le timer demarre quand les deux duellistes sont en vocal Duel.");
    } else if (saloonDuelist) {
      setScreen("Duel a venir", `${playerName(saloonDuelist)} represente ton saloon.`, "Un duel va commencer.");
    } else if (phase.name === "discussion") {
      setScreen("Discussion saloon", "Discute avec ton saloon.", "Choisissez ensemble qui ira au duel.");
    } else if (phase.label === "Discussion terminee : choisissez les duellistes") {
      setScreen("Choix du duel", "Votre saloon doit choisir un duelliste.", "Clique sur Je vais au duel si c'est toi.");
    } else if (!player.role) {
      setScreen("Preparation", "Attends ton role.", "Role pas encore distribue.");
    } else if (phase.name === "result") {
      setScreen(phase.label, "Suis l'indication affichee.", phase.label);
    } else {
      setScreen(duel.leftId && duel.rightId ? "Duel en cours" : "En attente", duel.leftId && duel.rightId ? "Observe le duel." : "Attends le lancement.", duel.leftId && duel.rightId ? "Un duel est en cours." : "En attente du prochain timer.");
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

  volunteerDuel.classList.add("hidden");
  const choice = myChoice(duel);
  setScreen("Duel en cours", "Choisis secretement.", duel.revealed ? "Les choix sont reveles." : choiceLabel(choice));
  choiceButtons.classList.toggle("hidden", Boolean(choice) || duel.revealed);
  sheriffPhoneShot.classList.toggle("hidden", player.role !== "Sheriff" || player.sheriffPower === false || duel.revealed);
}

joinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;
  const result = await postJson("/api/join", { name });
  playerId = result.player.id;
  localStorage.setItem("sheriffPlayerId", playerId);
  render(result.state);
});

choiceButtons.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-choice]");
  if (!button) return;
  await postJson("/api/choice", { playerId, choice: button.dataset.choice });
});

sheriffPhoneShot.addEventListener("click", async () => {
  await postJson("/api/sheriff-shot", { playerId });
});

volunteerDuel.addEventListener("click", async () => {
  await postJson("/api/volunteer-duel", { playerId });
});

hostStartGame.addEventListener("click", async () => {
  await postJson("/api/settings", {
    duelDuration: hostDuelDuration.value,
    resultDuration: hostResultDuration.value,
    discussionDuration: hostDiscussionDuration.value
  });
  await postJson("/api/setup-game", { outlawCount: hostOutlawCount.value });
});

hostNewGame.addEventListener("click", async () => {
  localStorage.removeItem("sheriffPlayerId");
  playerId = "";
  await postJson("/api/new-game");
});

hostEndNewGame.addEventListener("click", async () => {
  localStorage.removeItem("sheriffPlayerId");
  playerId = "";
  await postJson("/api/new-game");
});

[hostDuelDuration, hostResultDuration, hostDiscussionDuration].forEach((input) => {
  input.addEventListener("input", () => {
    hostTimersTouched = true;
  });
});

enableVoice.addEventListener("click", () => {
  if (voiceEnabled) {
    toggleMute();
    return;
  }
  enableVoiceChat().catch(() => {
    voiceStatus.textContent = "Micro bloque par le navigateur. Autorise le micro puis recharge.";
  });
});

const events = new EventSource("/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
events.addEventListener("signal", (event) => {
  handleSignal(event).catch(() => {
    voiceStatus.textContent = "Connexion vocale interrompue.";
  });
});
fetch("/api/state").then((response) => response.json()).then(render);
setupRulesModal();
