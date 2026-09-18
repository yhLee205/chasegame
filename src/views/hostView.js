import { el, showToast, formatClock, tsToDate } from "../ui.js";
import { loadNaverMaps, BORAMAE_PARK_CENTER } from "../naverMap.js";
import {
  OFFICER_IDS,
  TEAM_IDS,
  subscribeGameStatus,
  subscribeOfficers,
  subscribeTeams,
  subscribeCatches,
  startNewGame,
  endGame,
  undoFound,
  changeOfficerPassword,
} from "../gameData.js";

export function renderHostView(container, { onExit }) {
  const unsubs = [];
  let map = null;
  let naverNs = null;
  const markers = {};

  let gameStatus = null;
  let officers = {};
  let teams = {};
  let catches = [];

  const screen = el("div", { class: "screen" });
  const topbar = el("div", { class: "topbar" }, [
    el("h1", {}, [el("span", { class: "dot" }), "진행자 콘솔"]),
    el("button", { class: "btn-ghost", text: "나가기", onclick: handleExit }),
  ]);
  const content = el("div", { class: "content" });
  screen.appendChild(topbar);
  screen.appendChild(content);
  container.appendChild(screen);

  function handleExit() {
    if (confirm("역할 선택 화면으로 돌아갈까요?")) onExit();
  }

  const controlPanel = el("div", { class: "panel" });
  const passwordPanel = el("div", { class: "panel" });
  const mapWrap = el("div", { class: "map-wrap" }, [el("div", { id: "map" })]);
  const officerPanel = el("div", { class: "panel" });
  const teamPanel = el("div", { class: "panel" });
  const logPanel = el("div", { class: "panel" });

  content.appendChild(controlPanel);
  content.appendChild(passwordPanel);
  content.appendChild(mapWrap);
  content.appendChild(officerPanel);
  content.appendChild(teamPanel);
  content.appendChild(logPanel);

  loadNaverMaps()
    .then((naver) => {
      naverNs = naver;
      map = new naver.maps.Map("map", {
        center: new naver.maps.LatLng(BORAMAE_PARK_CENTER.lat, BORAMAE_PARK_CENTER.lng),
        zoom: 16,
      });
      renderMap();
    })
    .catch((err) => {
      mapWrap.innerHTML = "";
      mapWrap.appendChild(el("div", { class: "error-msg", text: `지도를 불러오지 못했습니다: ${err.message}` }));
    });

  unsubs.push(subscribeGameStatus((data) => {
    gameStatus = data;
    renderControl();
  }));
  unsubs.push(subscribeOfficers((data) => {
    officers = data;
    renderMap();
    renderOfficerPanel();
  }));
  unsubs.push(subscribeTeams((data) => {
    teams = data;
    renderMap();
    renderTeamPanel();
  }));
  unsubs.push(subscribeCatches((data) => {
    catches = data;
    renderLogPanel();
  }));

  renderControl();
  renderPasswordPanel();
  renderOfficerPanel();
  renderTeamPanel();
  renderLogPanel();

  function renderControl() {
    controlPanel.innerHTML = "";
    controlPanel.appendChild(el("h2", { text: "게임 제어" }));
    const started = gameStatus && gameStatus.started;
    controlPanel.appendChild(
      el("div", { class: "status-row" }, [
        el("span", { text: "현재 상태" }),
        el("span", { class: `badge ${started ? "" : "waiting"}`, text: started ? "진행중" : "대기중" }),
      ])
    );
    const startTime = gameStatus && tsToDate(gameStatus.startTime);
    controlPanel.appendChild(
      el("div", { class: "status-row" }, [
        el("span", { text: "시작 시각" }),
        el("span", { text: startTime ? formatClock(startTime) : "-" }),
      ])
    );
    controlPanel.appendChild(
      el("div", { class: "hint", text: "새 게임을 시작하면 모든 위치, 사진, 발견 기록이 전부 초기화됩니다." })
    );
    controlPanel.appendChild(
      el("button", {
        class: "btn-primary",
        text: "🚀 새 게임 시작 (전체 초기화)",
        style: "margin-top:10px;",
        onclick: async () => {
          if (!confirm("정말 새 게임을 시작할까요? 모든 위치/사진/발견 기록이 초기화됩니다.")) return;
          try {
            await startNewGame();
            showToast("새 게임을 시작했습니다.");
          } catch (err) {
            showToast(`시작 실패: ${err.message}`, "error");
          }
        },
      })
    );
    if (started) {
      controlPanel.appendChild(
        el("button", {
          class: "btn-secondary",
          text: "게임 일시 종료",
          style: "margin-top:8px;",
          onclick: async () => {
            if (!confirm("게임을 종료 상태로 표시할까요? (기록은 유지됩니다)")) return;
            await endGame();
            showToast("게임을 종료 상태로 변경했습니다.");
          },
        })
      );
    }
  }

  function renderPasswordPanel() {
    passwordPanel.innerHTML = "";
    passwordPanel.appendChild(el("h2", { text: "임원단 입장 비밀번호 변경" }));
    const input = el("input", { type: "text", placeholder: "새 비밀번호", inputmode: "numeric" });
    passwordPanel.appendChild(el("div", { class: "field" }, [input]));
    passwordPanel.appendChild(
      el("button", {
        class: "btn-secondary",
        text: "비밀번호 변경",
        style: "margin-top:8px;",
        onclick: async () => {
          const value = input.value.trim();
          if (!value) return;
          try {
            await changeOfficerPassword(value);
            showToast("임원단 비밀번호가 변경되었습니다.");
            input.value = "";
          } catch (err) {
            showToast(`변경 실패: ${err.message}`, "error");
          }
        },
      })
    );
  }

  function renderMap() {
    if (!map || !naverNs) return;
    for (const id of OFFICER_IDS) {
      const key = `o${id}`;
      const o = officers[id];
      upsertMarker(key, o && o.location, `<div class="target-marker" style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;font-weight:700;${o && o.found ? "opacity:0.4;" : ""}">임${id}</div>`);
    }
    for (const id of TEAM_IDS) {
      const key = `t${id}`;
      const t = teams[id];
      upsertMarker(key, t && t.location, `<div class="self-marker" style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#04140d;font-weight:700;">${id}</div>`);
    }
  }

  function upsertMarker(key, location, content) {
    if (!location) {
      if (markers[key]) {
        markers[key].setMap(null);
        delete markers[key];
      }
      return;
    }
    const pos = new naverNs.maps.LatLng(location.lat, location.lng);
    if (!markers[key]) {
      markers[key] = new naverNs.maps.Marker({ position: pos, map, icon: { content, anchor: new naverNs.maps.Point(15, 15) } });
    } else {
      markers[key].setPosition(pos);
      markers[key].setIcon({ content, anchor: new naverNs.maps.Point(15, 15) });
    }
  }

  function renderOfficerPanel() {
    officerPanel.innerHTML = "";
    officerPanel.appendChild(el("h2", { text: "임원단 현황" }));
    for (const id of OFFICER_IDS) {
      const o = officers[id] || {};
      const row = el("div", { class: "status-row" });
      row.appendChild(el("span", { text: `임원 ${id}` }));
      const right = el("div", { style: "display:flex; align-items:center; gap:8px;" });
      right.appendChild(
        el("span", {
          class: `badge ${o.found ? "caught" : "waiting"}`,
          text: o.found ? `${o.foundByTeam}팀에게 발견 (${formatClock(tsToDate(o.foundAt))})` : "미발견",
        })
      );
      if (o.found) {
        right.appendChild(
          el("button", {
            class: "btn-ghost",
            text: "취소",
            onclick: async () => {
              if (!confirm(`임원 ${id}의 발견 기록을 취소할까요?`)) return;
              try {
                await undoFound(id);
                showToast("발견 기록을 취소했습니다.");
              } catch (err) {
                showToast(`취소 실패: ${err.message}`, "error");
              }
            },
          })
        );
      }
      row.appendChild(right);
      officerPanel.appendChild(row);
    }
  }

  function renderTeamPanel() {
    teamPanel.innerHTML = "";
    teamPanel.appendChild(el("h2", { text: "팀 위치 갱신 현황" }));
    for (const id of TEAM_IDS) {
      const t = teams[id] || {};
      const updated = tsToDate(t.updatedAt);
      teamPanel.appendChild(
        el("div", { class: "status-row" }, [
          el("span", { text: `${id}팀` }),
          el("span", { class: "hint", text: updated ? `${formatClock(updated)} 갱신` : "위치 없음" }),
        ])
      );
    }
  }

  function renderLogPanel() {
    logPanel.innerHTML = "";
    logPanel.appendChild(el("h2", { text: "발견 기록 로그" }));
    if (catches.length === 0) {
      logPanel.appendChild(el("div", { class: "hint", text: "아직 발견 기록이 없습니다." }));
      return;
    }
    [...catches].reverse().forEach((c) => {
      logPanel.appendChild(
        el("div", { class: "status-row" }, [
          el("span", { text: `${c.teamId}팀 → 임원 ${c.officerId}` }),
          el("span", { class: "hint", text: formatClock(tsToDate(c.foundAt)) }),
        ])
      );
    });
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}
