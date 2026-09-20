import "./style.css";
import { el } from "./ui.js";
import { getSession, setSession, clearSession } from "./session.js";
import { ensureGameDocuments } from "./gameData.js";
import { renderRoleSelect } from "./views/roleSelect.js";
import { renderTeamView } from "./views/teamView.js";
import { renderOfficerView } from "./views/officerView.js";
import { renderHostView } from "./views/hostView.js";

// 개인정보 보호를 위해 서비스를 임시 종료합니다. 기능 코드는 모두 그대로 남겨두고
// 화면 진입만 막아둔 상태입니다. 다시 열려면 이 값을 false로 되돌리세요.
const SERVICE_CLOSED = true;

const app = document.getElementById("app");
let activeCleanup = null;

function renderClosedScreen(container) {
  const screen = el("div", { class: "screen" });
  const hero = el("div", { class: "hero" }, [
    el("div", { class: "radar" }),
    el("h1", { text: "서비스 종료" }),
    el("p", { text: "개인정보 보호를 위해 보라매 추격 미션 서비스를 종료했습니다." }),
  ]);
  screen.appendChild(hero);
  container.appendChild(screen);
}

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
  if (SERVICE_CLOSED) {
    mount((container) => renderClosedScreen(container));
    return;
  }

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

if (SERVICE_CLOSED) {
  route();
} else {
  ensureGameDocuments()
    .catch((err) => console.error("Failed to initialize game documents", err))
    .finally(() => route());
}
