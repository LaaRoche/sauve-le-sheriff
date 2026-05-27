let state = null;
let wakeLock = null;

const joinUrl = document.querySelector("#join-url");
const timeLeft = document.querySelector("#time-left");
const clockRing = document.querySelector("#clock-ring");
const leftDuelist = document.querySelector("#left-duelist");
const rightDuelist = document.querySelector("#right-duelist");
const leftChoice = document.querySelector("#left-choice");
const rightChoice = document.querySelector("#right-choice");
const outcome = document.querySelector("#outcome");
const leftSelect = document.querySelector("#left-select");
const rightSelect = document.querySelector("#right-select");
const saloonA = document.querySelector("#saloon-a");
const saloonB = document.querySelector("#saloon-b");
const deadList = document.querySelector("#dead-list");
const allPlayers = document.querySelector("#all-players");
const wakeLockButton = document.querySelector("#wake-lock");
const outlawCountInput = document.querySelector("#outlaw-count");
const quickRoles = document.querySelector("#quick-roles");
const roleAdvice = document.querySelector("#role-advice");
const stepButtons = document.querySelectorAll("[data-step-target]");
const stepPages = document.querySelectorAll("[data-step]");
const resultOverlay = document.querySelector("#result-overlay");
const resultMessage = document.querySelector("#result-message");
const resultDetail = document.querySelector("#result-detail");
const overlayNewGame = document.querySelector("#overlay-new-game");
const phaseLabel = document.querySelector("#phase-label");
const phaseTime = document.querySelector("#phase-time");
const adminLock = document.querySelector("#admin-lock");
const adminContent = document.querySelector("#admin-content");
const pinDisplay = document.querySelector("#pin-display");
const pinMessage = document.querySelector("#pin-message");
const duelDurationInput = document.querySelector("#duel-duration");
const resultDurationInput = document.querySelector("#result-duration");
const transitionDurationInput = document.querySelector("#transition-duration");
const discussionDurationInput = document.querySelector("#discussion-duration");
let adminUnlocked = false;
let pinValue = "";

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function playerName(id) {
  return state?.players.find((player) => player.id === id)?.name || "Aucun joueur";
}

function choiceText(choice, revealed) {
  if (!choice) return "Pas de choix";
  if (!revealed) return "Choix recu";
  return choice === "shoot" ? "Tire" : "Ne tire pas";
}

function resolveOutcome(duel) {
  if (state?.hostMessage) return state.hostMessage;
  if (duel.sheriffShot) return "Tir anticipe du sheriff : appliquez son pouvoir maintenant.";
  if (!duel.leftId || !duel.rightId) return "Choisissez deux joueurs pour preparer le duel.";
  if (!duel.revealed && duel.remaining > 0) return "Duel en cours : les choix restent secrets.";
  if (!duel.leftChoice || !duel.rightChoice) return "Il manque un choix. Le maitre de partie tranche ou relance le duel.";

  const left = playerName(duel.leftId);
  const right = playerName(duel.rightId);

  if (duel.leftChoice === "shoot" && duel.rightChoice === "shoot") {
    return `${left} et ${right} tirent : les deux sont elimines.`;
  }
  if (duel.leftChoice === "shoot") {
    return `${left} tire : ${right} est elimine, ${left} change de saloon.`;
  }
  if (duel.rightChoice === "shoot") {
    return `${right} tire : ${left} est elimine, ${right} change de saloon.`;
  }
  return "Personne ne tire : revelation privee, puis les deux joueurs echangent de saloon.";
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  return response.json();
}

function optionFor(player) {
  const option = document.createElement("option");
  option.value = player.id;
  option.textContent = player.name;
  return option;
}

function renderSelectors(players) {
  const currentLeft = leftSelect.value || state.duel.leftId || "";
  const currentRight = rightSelect.value || state.duel.rightId || "";

  leftSelect.replaceChildren();
  rightSelect.replaceChildren();

  const emptyLeft = new Option("Choisir", "");
  const emptyRight = new Option("Choisir", "");
  leftSelect.append(emptyLeft);
  rightSelect.append(emptyRight);

  players.forEach((player) => {
    leftSelect.append(optionFor(player));
    rightSelect.append(optionFor(player));
  });

  leftSelect.value = currentLeft;
  rightSelect.value = currentRight;
}

function playerRow(player, mode = "full") {
  const row = document.createElement("div");
  row.className = "player-row";

  const name = document.createElement("strong");
  name.textContent = player.name;

  if (mode === "readonly") {
    row.append(name);
    return row;
  }

  const controls = document.createElement("div");
  controls.className = "row-controls";

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "danger";
  deleteButton.textContent = "Supprimer";
  deleteButton.addEventListener("click", () => {
    postJson("/api/delete-player", { id: player.id });
  });

  if (mode === "full") {
    const saloonButton = document.createElement("button");
    saloonButton.type = "button";
    saloonButton.textContent = player.saloon === "A" ? "Vers B" : "Vers A";
    saloonButton.addEventListener("click", () => {
      postJson("/api/player", { id: player.id, saloon: player.saloon === "A" ? "B" : "A" });
    });

    const aliveButton = document.createElement("button");
    aliveButton.type = "button";
    aliveButton.textContent = player.alive ? "Mort" : "Vivant";
    aliveButton.addEventListener("click", () => {
      postJson("/api/player", { id: player.id, alive: !player.alive });
    });

    controls.append(saloonButton, aliveButton);
  }

  controls.append(deleteButton);
  row.append(name, controls);
  return row;
}

function renderPlayers(players) {
  allPlayers.replaceChildren();
  saloonA.replaceChildren();
  saloonB.replaceChildren();
  deadList.replaceChildren();

  players.forEach((player) => {
    allPlayers.append(playerRow(player, "simple"));
    if (!player.alive) deadList.append(playerRow(player));
    else if (player.saloon === "A") {
      saloonA.append(playerRow(player, "readonly"));
    } else {
      saloonB.append(playerRow(player, "readonly"));
    }
  });

  if (!allPlayers.children.length) allPlayers.textContent = "Aucun joueur";
  if (!saloonA.children.length) saloonA.textContent = "Aucun joueur";
  if (!saloonB.children.length) saloonB.textContent = "Aucun joueur";
  if (!deadList.children.length) deadList.textContent = "Aucun mort";
}

function recommendedOutlaws(playerCount) {
  if (playerCount <= 4) return 1;
  if (playerCount <= 7) return 2;
  if (playerCount <= 10) return 3;
  return Math.max(4, Math.round(playerCount / 3));
}

function clampOutlawCount(value, playerCount) {
  const max = Math.max(1, playerCount - 1);
  return Math.max(1, Math.min(Number(value || 1), max));
}

function renderRoleTools(players) {
  const livingCount = players.filter((player) => player.alive).length;
  const recommended = clampOutlawCount(recommendedOutlaws(livingCount), livingCount);
  const max = Math.max(1, livingCount - 1);

  outlawCountInput.max = String(max);
  if (!outlawCountInput.dataset.touched) {
    outlawCountInput.value = String(recommended);
  } else {
    outlawCountInput.value = String(clampOutlawCount(outlawCountInput.value, livingCount));
  }

  quickRoles.replaceChildren();
  const values = [...new Set([recommended - 1, recommended, recommended + 1].filter((value) => value >= 1 && value <= max))];
  values.forEach((value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(value);
    button.className = Number(outlawCountInput.value) === value ? "selected" : "";
    button.addEventListener("click", () => {
      outlawCountInput.dataset.touched = "true";
      outlawCountInput.value = String(value);
      renderRoleTools(state.players);
    });
    quickRoles.append(button);
  });

  if (livingCount < 3) {
    roleAdvice.textContent = "Il faut au moins 3 joueurs pour une distribution interessante.";
    return;
  }

  roleAdvice.textContent = `Recommande pour ${livingCount} joueurs : ${recommended} hors-la-loi, 1 sheriff, ${Math.max(0, livingCount - recommended - 1)} citoyens.`;
}

function showStep(step) {
  stepPages.forEach((page) => {
    page.classList.toggle("hidden", page.dataset.step !== step);
  });
  stepButtons.forEach((button) => {
    button.classList.toggle("selected", button.dataset.stepTarget === step);
  });
  if (step === "roles") renderAdminLock();
}

function renderAdminLock() {
  adminLock.classList.toggle("hidden", adminUnlocked);
  adminContent.classList.toggle("hidden", !adminUnlocked);
  pinDisplay.textContent = pinValue.padEnd(4, "-").slice(0, 4);
}

function handlePin(input) {
  if (input === "clear") {
    pinValue = "";
    pinMessage.textContent = "Entre le code admin pour modifier les roles et les saloons.";
    renderAdminLock();
    return;
  }

  if (input === "enter") {
    if (pinValue === "1994") {
      adminUnlocked = true;
      pinValue = "";
      renderAdminLock();
      return;
    }
    pinValue = "";
    pinMessage.textContent = "Code incorrect.";
    renderAdminLock();
    return;
  }

  if (pinValue.length < 4) pinValue += input;
  renderAdminLock();
}

function render(nextState) {
  state = nextState;
  const duel = state.duel;
  const phase = state.phase || { label: "En attente", remaining: 0 };
  const winner = state.winner || "";
  const outcomeText = duel.resultMessage || resolveOutcome(duel);

  joinUrl.textContent = state.joinUrl || `${location.origin}/join.html`;
  timeLeft.textContent = String(duel.remaining);
  clockRing.classList.toggle("warning", duel.remaining <= 5);
  leftDuelist.textContent = playerName(duel.leftId);
  rightDuelist.textContent = playerName(duel.rightId);
  leftChoice.textContent = choiceText(duel.leftChoice, duel.revealed);
  rightChoice.textContent = choiceText(duel.rightChoice, duel.revealed);
  outcome.textContent = outcomeText;
  phaseLabel.textContent = phase.label || "En attente";
  phaseTime.textContent = phase.remaining ? formatTime(phase.remaining) : "--:--";
  resultMessage.textContent = winner ? `${winner} gagnent la partie.` : duel.resultMessage || "";
  resultDetail.textContent = winner ? "La partie est terminee." : duel.resultDetail || "";
  overlayNewGame.classList.toggle("hidden", !winner);
  resultOverlay.classList.toggle("hidden", !duel.resultMessage && !winner);
  renderSettings(state.settings || {});

  renderSelectors(state.players);
  renderPlayers(state.players);
  renderRoleTools(state.players);
}

function renderSettings(settings) {
  if (duelDurationInput.dataset.dirty) return;
  duelDurationInput.value = settings.duelDuration || 30;
  resultDurationInput.value = settings.resultDuration || 15;
  transitionDurationInput.value = settings.transitionDuration ?? 10;
  discussionDurationInput.value = settings.discussionDuration || 150;
}

async function toggleWakeLock() {
  if (!("wakeLock" in navigator)) {
    wakeLockButton.textContent = "Indispo.";
    return;
  }

  if (wakeLock) {
    await wakeLock.release();
    wakeLock = null;
    wakeLockButton.textContent = "Veille";
    return;
  }

  wakeLock = await navigator.wakeLock.request("screen");
  wakeLockButton.textContent = "Ecran actif";
  wakeLock.addEventListener("release", () => {
    wakeLock = null;
    wakeLockButton.textContent = "Veille";
  });
}

document.querySelector("#add-player-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.querySelector("#add-player-name");
  const name = input.value.trim();
  if (!name) return;
  await postJson("/api/join", { name });
  input.value = "";
});

document.querySelector("#set-duel").addEventListener("click", () => {
  postJson("/api/duel", { leftId: leftSelect.value, rightId: rightSelect.value });
});

document.querySelector("#assign-roles").addEventListener("click", () => {
  outlawCountInput.dataset.touched = "true";
  const livingCount = state.players.filter((player) => player.alive).length;
  const count = clampOutlawCount(outlawCountInput.value, livingCount);
  postJson("/api/assign-roles", { outlawCount: count });
});
document.querySelector("#assign-saloons").addEventListener("click", () => postJson("/api/assign-saloons"));
document.querySelector("#save-settings").addEventListener("click", () => {
  delete duelDurationInput.dataset.dirty;
  postJson("/api/settings", {
    duelDuration: duelDurationInput.value,
    resultDuration: resultDurationInput.value,
    transitionDuration: transitionDurationInput.value,
    discussionDuration: discussionDurationInput.value
  });
});
[duelDurationInput, resultDurationInput, transitionDurationInput, discussionDurationInput].forEach((input) => {
  input.addEventListener("input", () => {
    duelDurationInput.dataset.dirty = "true";
  });
});
outlawCountInput.addEventListener("input", () => {
  outlawCountInput.dataset.touched = "true";
  renderRoleTools(state?.players || []);
});
stepButtons.forEach((button) => {
  button.addEventListener("click", () => showStep(button.dataset.stepTarget));
});
document.querySelectorAll("[data-pin]").forEach((button) => {
  button.addEventListener("click", () => handlePin(button.dataset.pin));
});
document.querySelector("#start-duel").addEventListener("click", () => postJson("/api/start-duel"));
document.querySelector("#start-discussion").addEventListener("click", () => postJson("/api/start-discussion"));
document.querySelector("#reveal").addEventListener("click", () => postJson("/api/reveal"));
document.querySelector("#sheriff-shot").addEventListener("click", () => postJson("/api/sheriff-shot"));
document.querySelector("#reset-duel").addEventListener("click", () => postJson("/api/reset-duel"));
document.querySelector("#new-game").addEventListener("click", () => postJson("/api/new-game"));
overlayNewGame.addEventListener("click", () => postJson("/api/new-game"));
wakeLockButton.addEventListener("click", () => toggleWakeLock().catch(() => {
  wakeLockButton.textContent = "Indispo.";
}));

const events = new EventSource("/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
fetch("/api/state").then((response) => response.json()).then(render);
