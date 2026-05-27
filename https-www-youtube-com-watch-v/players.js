let state = null;

const grid = document.querySelector("#players-phone-grid");

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

function choiceLabel(choice) {
  if (choice === "shoot") return "Choix : tirer";
  if (choice === "hold") return "Choix : ne pas tirer";
  return "Aucun choix";
}

function isInDuel(player, duel) {
  return duel.leftId === player.id || duel.rightId === player.id;
}

function playerChoice(player, duel) {
  if (duel.leftId === player.id) return duel.leftChoice;
  if (duel.rightId === player.id) return duel.rightChoice;
  return "";
}

function statusText(player, duel) {
  if (state.winner) return "Partie terminee";
  if (!player.alive) return "Elimine";
  if (!player.role) return "Role non attribue";
  if (!isInDuel(player, duel)) return duel.leftId && duel.rightId ? "Observe le duel" : "Attend le prochain duel";
  if (duel.revealed) return "Choix reveles";
  return playerChoice(player, duel) ? "Choix envoye" : "Doit choisir";
}

function makePlayerCard(player) {
  const duel = state.duel;
  const phase = state.phase || {};
  const card = document.createElement("article");
  card.className = "test-phone-card";
  card.classList.toggle("dead-player-card", !player.alive);
  card.classList.toggle("game-over-card", Boolean(state.winner));

  const heading = document.createElement("div");
  heading.className = "identity";
  heading.innerHTML = `
    <span>${statusText(player, duel)}</span>
    <strong>${player.name}</strong>
    <small>${player.alive ? `Saloon ${player.saloon}` : "Hors partie"}</small>
    <em>${player.role ? `Role : ${player.role}` : "Role non attribue"}</em>
  `;

  const clock = document.createElement("div");
  clock.className = `clock-ring phone-clock${duel.remaining <= 5 ? " warning" : ""}`;
  const shownTime = duel.running || isInDuel(player, duel) ? String(duel.remaining) : String(phase.remaining || duel.remaining);
  if (state.winner) {
    clock.classList.add("game-over-ring");
    clock.innerHTML = `<span></span><small>Fin</small>`;
  } else {
    clock.classList.toggle("dead-ring", !player.alive);
    clock.innerHTML = `<span>${shownTime}</span><small>${player.alive ? (duel.running || isInDuel(player, duel) ? "secondes" : phase.label || "phase") : "Mort"}</small>`;
    if (Number(shownTime) >= 100) clock.querySelector("span").classList.add("compact-time");
  }

  const message = document.createElement("p");
  message.className = "outcome";
  message.classList.toggle("big-message", Boolean(state.winner));
  message.textContent = state.winner ? `${state.winner} gagnent la partie.` : !player.alive ? "Mort : ne parle plus." : isInDuel(player, duel) ? choiceLabel(playerChoice(player, duel)) : phase.label || choiceLabel(playerChoice(player, duel));

  const actions = document.createElement("div");
  actions.className = "choice-buttons";

  const canChoose = player.alive && isInDuel(player, duel) && !duel.revealed && !playerChoice(player, duel);
  const saloonDuelist = player.saloon === "A" ? duel.leftId : duel.rightId;
  const canVolunteer = player.alive && !state.winner && !isInDuel(player, duel) && !saloonDuelist && (phase.name === "discussion" || phase.label === "Discussion terminee : choisissez les duellistes");

  if (canVolunteer) {
    const volunteer = document.createElement("button");
    volunteer.className = "primary full-width";
    volunteer.type = "button";
    volunteer.textContent = "Je vais au duel";
    volunteer.addEventListener("click", () => postJson("/api/volunteer-duel", { playerId: player.id }));
    actions.append(volunteer);
  }

  if (canChoose) {
    const shoot = document.createElement("button");
    shoot.className = "danger";
    shoot.type = "button";
    shoot.textContent = "Tirer";
    shoot.addEventListener("click", () => postJson("/api/choice", { playerId: player.id, choice: "shoot" }));

    const hold = document.createElement("button");
    hold.type = "button";
    hold.textContent = "Ne pas tirer";
    hold.addEventListener("click", () => postJson("/api/choice", { playerId: player.id, choice: "hold" }));

    actions.append(shoot, hold);
  }

  if (canChoose && player.role === "Sheriff") {
    const sheriff = document.createElement("button");
    sheriff.className = "danger full-width";
    sheriff.type = "button";
    sheriff.textContent = "Tir du sheriff";
    sheriff.addEventListener("click", () => postJson("/api/sheriff-shot", { playerId: player.id }));
    actions.append(sheriff);
  }

  card.append(heading, clock, message, actions);
  return card;
}

function render(nextState) {
  state = nextState;
  grid.replaceChildren();

  if (!state.players.length) {
    const empty = document.createElement("p");
    empty.className = "outcome";
    empty.textContent = "Aucun joueur pour le moment.";
    grid.append(empty);
    return;
  }

  state.players.forEach((player) => grid.append(makePlayerCard(player)));
}

const events = new EventSource("/events");
events.addEventListener("state", (event) => render(JSON.parse(event.data)));
fetch("/api/state").then((response) => response.json()).then(render);
setupRulesModal();
