let playerId = localStorage.getItem("sheriffPlayerId") || "";
let state = null;

const joinForm = document.querySelector("#join-form");
const playerNameInput = document.querySelector("#player-name");
const playerView = document.querySelector("#player-view");
const displayName = document.querySelector("#player-display-name");
const playerSaloon = document.querySelector("#player-saloon");
const playerStatus = document.querySelector("#player-status");
const playerRole = document.querySelector("#player-role");
const timeLeft = document.querySelector("#time-left");
const clockRing = document.querySelector("#clock-ring");
const message = document.querySelector("#player-message");
const choiceButtons = document.querySelector("#choice-buttons");
const sheriffPhoneShot = document.querySelector("#sheriff-phone-shot");

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

function choiceLabel(choice) {
  if (choice === "shoot") return "Tu as choisi : tirer.";
  if (choice === "hold") return "Tu as choisi : ne pas tirer.";
  return "Choisis secretement avant la fin du decompte.";
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
  playerRole.textContent = player.role ? `Role : ${player.role}` : "Role non attribue";

  const duel = state.duel;
  const phase = state.phase || {};
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
    return;
  }

  clockRing.classList.remove("dead-ring");

  if (!isInDuel(duel)) {
    if (phase.name === "transition" || phase.name === "discussion" || phase.name === "result") {
      message.textContent = phase.label;
    } else {
      message.textContent = player.role ? (duel.leftId && duel.rightId ? "Observe le duel en cours." : "En attente du prochain duel.") : "Role pas encore distribue.";
    }
    choiceButtons.classList.add("hidden");
    sheriffPhoneShot.classList.add("hidden");
    return;
  }

  const choice = myChoice(duel);
  message.textContent = duel.revealed ? "Les choix sont reveles sur l'ecran du maitre de partie." : choiceLabel(choice);
  choiceButtons.classList.toggle("hidden", Boolean(choice) || duel.revealed);
  sheriffPhoneShot.classList.toggle("hidden", player.role !== "Sheriff" || duel.revealed);
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

const events = new EventSource("/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
fetch("/api/state").then((response) => response.json()).then(render);
