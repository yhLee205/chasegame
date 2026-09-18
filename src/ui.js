export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== null && value !== undefined) {
      node.setAttribute(key, value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

let toastTimer = null;
export function showToast(message, type = "info") {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const toast = el("div", { class: `toast ${type === "error" ? "error" : ""}`, text: message });
  document.body.appendChild(toast);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

export function showModal({ title, body, actions = [] }) {
  const backdrop = el("div", { class: "modal-backdrop" });
  const sheet = el("div", { class: "modal-sheet" });
  if (title) sheet.appendChild(el("h3", { text: title }));
  if (body) sheet.appendChild(body);

  const close = () => backdrop.remove();

  const actionRow = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });
  for (const action of actions) {
    const btn = el("button", {
      class: action.class || "btn-secondary",
      text: action.label,
      onclick: () => action.onClick(close),
    });
    actionRow.appendChild(btn);
  }
  sheet.appendChild(actionRow);

  backdrop.appendChild(sheet);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.body.appendChild(backdrop);
  return close;
}

export function formatClock(date) {
  if (!date) return "-";
  return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatElapsed(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  return null;
}
