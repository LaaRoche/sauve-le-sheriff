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

let voiceEnabled = false;
let muted = false;
let localStream = null;
let lastVoiceRoom = "";
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
  if (choice === "shoot") return "Tu as choisi : tirer.";
  if (choice === "hold") return "Tu as choisi : ne pas tirer.";
  return "Choisis secretement avant la fin du decompte.";
}

function mySaloonDuelist(duel, player) {
  if (!player) return "";
  return player.saloon === "A" ? duel.leftId : duel.rightId;
}

function playerName(id) {
  return state?.players.find((player) => player.id === id)?.name || "";
}

function setTask(phase, action) {
  playerPhase.textContent = phase;
  playerAction.textContent = action;
}

function roleImage(role) {
  if (role === "Sheriff") return "assets/role-sheriff.svg";
  if (role === "Hors-la-loi") return "assets/role-outlaw.svg";
  if (role === "Citoyen") return "assets/role-citizen.svg";
  return "assets/role-hidden.svg";
}

function voiceRoomFor(player, duel) {
  if (!player) return "";
  if (!player.alive) return "Elimines";
  if ((duel.leftId === player.id || duel.rightId === player.id) && duelIsOpen(duel)) return "Duel";
  return `Saloon ${player.saloon}`;
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
    playerSaloon.textContent = player.alive ? "Vivant" : "Mort";
    timeLeft.textContent = "";
    clockRing.classList.remove("warning");
    clockRing.classList.add("game-over-ring");
    message.classList.add("big-message");
    message.textContent = `${state.winner} gagnent la partie.`;
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    volunteerDuel.classList.add("hidden");
    setTask("Partie terminee", `${state.winner} gagnent.`);
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
    setTask("Mort", "Tu ne participes plus aux discussions.");
    return;
  }

  clockRing.classList.remove("dead-ring");

  if (!isInDuel(duel) || duel.revealed) {
    const canVolunteer = player.role && player.alive && (phase.name === "discussion" || phase.label === "Discussion terminee : choisissez les duellistes") && !saloonDuelist;
    volunteerDuel.classList.toggle("hidden", !canVolunteer);

    if (duel.revealed && phase.name === "result") {
      setTask("Retour vocal", `Retourne dans le vocal ${voiceRoomFor(player, duel)}.`);
      message.textContent = duel.resultMessage || "Resultat du duel.";
    } else if (phase.name === "transition") {
      setTask("Temps mort", `Rejoins le vocal ${voiceRoomFor(player, duel)}.`);
      message.textContent = phase.label;
    } else if (isSelectedForDuel) {
      setTask("Duel", "Tu es le duelliste de ton saloon. Va dans le vocal Duel.");
      message.textContent = "Tu es choisi pour le duel.";
    } else if (saloonDuelist) {
      setTask("Duel", `${playerName(saloonDuelist)} represente ton saloon.`);
      message.textContent = "Attends le duel.";
    } else if (phase.name === "discussion") {
      setTask("Discussion", "Parle avec ton saloon. Si vous decidez que tu y vas, clique sur Je vais au duel.");
      message.textContent = phase.label;
    } else if (phase.label === "Discussion terminee : choisissez les duellistes") {
      setTask("Choix du duel", "Votre saloon doit choisir un duelliste.");
      message.textContent = phase.label;
    } else if (!player.role) {
      setTask("Preparation", "Attends que les roles soient distribues.");
      message.textContent = "Role pas encore distribue.";
    } else if (phase.name === "transition" || phase.name === "result") {
      setTask(phase.label, "Suis l'indication affichee.");
      message.textContent = phase.label;
    } else {
      setTask("Attente", "Attends le prochain timer.");
      message.textContent = duel.leftId && duel.rightId ? "Observe le duel en cours." : "En attente du prochain duel.";
    }

    if (phase.name === "transition" || phase.name === "discussion" || phase.name === "result") {
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
  setTask("Duel", "Choisis secretement : tirer ou ne pas tirer.");
  message.textContent = duel.revealed ? "Les choix sont reveles sur l'ecran du maitre de partie." : choiceLabel(choice);
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
