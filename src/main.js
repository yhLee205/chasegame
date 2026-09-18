import "./style.css";
import { getSession, setSession, clearSession } from "./session.js";
import { ensureGameDocuments } from "./gameData.js";
import { renderRoleSelect } from "./views/roleSelect.js";
import { renderTeamView } from "./views/teamView.js";
import { renderOfficerView } from "./views/officerView.js";
import { renderHostView } from "./views/hostView.js";

const app = document.getElementById("app");
let activeCleanup = null;

function mount(renderFn) {
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch {
      // ignore cleanup errors
    }
    activeCleanup = null;
  }
  app.innerHTML = "";
  activeCleanup = renderFn(app) || null;
}

export function goToRoleSelect() {
  clearSession();
  route();
}

function route() {
  const session = getSession();
  if (!session || !session.role) {
    mount((container) => renderRoleSelect(container));
    return;
  }

  if (session.role === "team") {
    mount((container) =>
      renderTeamView(container, { teamId: session.number, onExit: goToRoleSelect })
    );
  } else if (session.role === "officer") {
    mount((container) =>
      renderOfficerView(container, { officerId: session.number, onExit: goToRoleSelect })
    );
  } else if (session.role === "host") {
    mount((container) => renderHostView(container, { onExit: goToRoleSelect }));
  } else {
    goToRoleSelect();
  }
}

export function selectRole(role, number) {
  setSession({ role, number });
  route();
}

ensureGameDocuments()
  .catch((err) => console.error("Failed to initialize game documents", err))
  .finally(() => route());
