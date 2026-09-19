import { el, showToast } from "../ui.js";
import { verifyOfficerPassword, TEAM_NAMES, OFFICER_NAMES } from "../gameData.js";
import { selectRole } from "../main.js";

const HOST_PASSWORD = import.meta.env.VITE_HOST_PASSWORD || "changeme";

export function renderRoleSelect(container) {
  let step = "role"; // role | team-number | officer-number | officer-password | host-password
  let selectedNumber = null;

  function paint() {
    container.innerHTML = "";
    container.appendChild(
      el("div", { class: "screen" }, [
        el("div", { class: "content" }, [
          el("div", { class: "hero" }, [
            el("div", { class: "radar" }),
            el("h1", { text: "보라매 추격 미션" }),
            el("p", { text: "역할을 선택하고 미션에 참여하세요" }),
          ]),
          renderStep(),
        ]),
      ])
    );
  }

  function renderStep() {
    if (step === "role") return roleCards();
    if (step === "team-number") return numberPicker(9, "team", TEAM_NAMES);
    if (step === "officer-number") return numberPicker(4, "officer-password", OFFICER_NAMES);
    if (step === "officer-password") return passwordForm("officer");
    if (step === "host-password") return passwordForm("host");
    return roleCards();
  }

  function roleCards() {
    return el("div", { class: "role-grid" }, [
      el("button", {
        class: "role-card",
        onclick: () => {
          selectedNumber = null;
          go("team-number");
        },
      }, [
        el("div", { class: "icon", text: "🎯" }),
        el("div", { class: "title", text: "팀" }),
        el("div", { class: "desc", text: "대상 위치를 추적하고 먼저 찾아내세요" }),
      ]),
      el("button", {
        class: "role-card",
        onclick: () => {
          selectedNumber = null;
          go("officer-number");
        },
      }, [
        el("div", { class: "icon", text: "🕶️" }),
        el("div", { class: "title", text: "임원단" }),
        el("div", { class: "desc", text: "숨어서 위치를 공유하고, 발견되면 체크하세요" }),
      ]),
      el("button", { class: "role-card", onclick: () => go("host-password") }, [
        el("div", { class: "icon", text: "🛰️" }),
        el("div", { class: "title", text: "진행자" }),
        el("div", { class: "desc", text: "게임 시작/초기화 및 전체 현황 관리" }),
      ]),
    ]);
  }

  function numberPicker(count, nextStep, names) {
    const wrap = el("div", { class: "panel" });
    wrap.appendChild(el("h2", { text: "번호 선택" }));
    const grid = el("div", { class: `number-grid ${count === 4 ? "of4" : ""}` });
    for (let i = 1; i <= count; i++) {
      const isSelected = selectedNumber === i;
      const btn = names
        ? el("button", {
            class: `num-btn with-name ${isSelected ? "selected" : ""}`,
            onclick: () => {
              selectedNumber = i;
              paint();
            },
          }, [
            el("span", { class: "num-btn-num", text: String(i) }),
            el("span", { class: "num-btn-name", text: names[i] }),
          ])
        : el("button", {
            class: `num-btn ${isSelected ? "selected" : ""}`,
            text: String(i),
            onclick: () => {
              selectedNumber = i;
              paint();
            },
          });
      grid.appendChild(btn);
    }
    wrap.appendChild(grid);

    const actions = el("div", { style: "display:flex; gap:8px; margin-top:16px;" }, [
      el("button", { class: "btn-secondary", text: "뒤로", onclick: () => go("role") }),
      el("button", {
        class: "btn-primary",
        text: "다음",
        disabled: selectedNumber ? null : "true",
        onclick: () => {
          if (!selectedNumber) return;
          if (nextStep === "team") {
            selectRole("team", selectedNumber);
          } else {
            go(nextStep);
          }
        },
      }),
    ]);
    actions.lastChild.style.flex = "1";
    wrap.appendChild(actions);
    return wrap;
  }

  function passwordForm(kind) {
    const wrap = el("div", { class: "panel" });
    wrap.appendChild(
      el("h2", { text: kind === "officer" ? `${OFFICER_NAMES[selectedNumber]} 입장` : "진행자 입장" })
    );
    const errorBox = el("div", { class: "error-msg" });
    const input = el("input", { type: "password", placeholder: "비밀번호", inputmode: "numeric" });

    const submit = async () => {
      const value = input.value.trim();
      if (!value) return;
      submitBtn.disabled = true;
      submitBtn.textContent = "확인 중...";
      try {
        if (kind === "officer") {
          const ok = await verifyOfficerPassword(value);
          if (ok) {
            selectRole("officer", selectedNumber);
            return;
          }
          errorBox.textContent = "비밀번호가 올바르지 않습니다.";
        } else {
          if (value === HOST_PASSWORD) {
            selectRole("host", null);
            return;
          }
          errorBox.textContent = "비밀번호가 올바르지 않습니다.";
        }
      } catch (err) {
        showToast(err.message || "확인 중 오류가 발생했습니다.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "입장";
      }
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    const submitBtn = el("button", { class: "btn-primary", text: "입장", onclick: submit });

    wrap.appendChild(el("div", { class: "field" }, [input]));
    wrap.appendChild(errorBox);
    wrap.appendChild(
      el("div", { style: "display:flex; gap:8px; margin-top:8px;" }, [
        el("button", {
          class: "btn-secondary",
          text: "뒤로",
          onclick: () => go(kind === "officer" ? "officer-number" : "role"),
        }),
        submitBtn,
      ])
    );
    submitBtn.style.flex = "1";
    return wrap;
  }

  function go(nextStep) {
    step = nextStep;
    if (nextStep !== "officer-password") selectedNumber = nextStep === "role" ? null : selectedNumber;
    paint();
  }

  paint();
}
