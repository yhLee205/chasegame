import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase.js";
import { el, showToast, formatClock, tsToDate } from "../ui.js";
import { TEAM_IDS, OFFICER_NAMES, TEAM_NAMES, subscribeGameStatus, subscribeOfficers, subscribeCatches, updateOfficerLocation, setOfficerPhoto, toggleFound } from "../gameData.js";

const AUTO_UPDATE_MS = 5 * 60 * 1000;

export function renderOfficerView(container, { officerId, onExit }) {
  const unsubs = [];
  let watchId = null;
  let autoTimer = null;
  let currentLocation = null;
  let officerData = null;
  let gameStatus = null;
  let catches = [];
  const pendingTeams = new Set();

  const screen = el("div", { class: "screen" });
  const topbar = el("div", { class: "topbar" }, [
    el("h1", {}, [el("span", { class: "dot" }), `임원단 ${officerId}번 · ${OFFICER_NAMES[officerId]}`]),
    el("button", { class: "btn-ghost", text: "나가기", onclick: handleExit }),
  ]);
  const content = el("div", { class: "content" });
  screen.appendChild(topbar);
  screen.appendChild(content);
  container.appendChild(screen);

  function handleExit() {
    if (confirm("역할 선택 화면으로 돌아갈까요?")) onExit();
  }

  const gameStatusPanel = el("div", { class: "panel" });
  const locationPanel = el("div", { class: "panel" });
  const photoPanel = el("div", { class: "panel" });
  const foundPanel = el("div", { class: "panel" });

  content.appendChild(gameStatusPanel);
  content.appendChild(locationPanel);
  content.appendChild(photoPanel);
  content.appendChild(foundPanel);

  renderGameStatus();
  renderLocationPanel();
  renderPhotoPanel();
  renderFoundPanel();

  unsubs.push(subscribeGameStatus((data) => {
    gameStatus = data;
    renderGameStatus();
  }));
  unsubs.push(subscribeOfficers((data) => {
    officerData = data[officerId];
    renderLocationPanel();
    renderPhotoPanel();
    renderFoundPanel();
  }));
  unsubs.push(subscribeCatches((data) => {
    catches = data;
    renderFoundPanel();
  }));

  startGeolocation();
  autoTimer = setInterval(sendLocationUpdate, AUTO_UPDATE_MS);

  function renderGameStatus() {
    gameStatusPanel.innerHTML = "";
    gameStatusPanel.appendChild(el("h2", { text: "게임 상태" }));
    const started = gameStatus && gameStatus.started;
    gameStatusPanel.appendChild(
      el("div", { class: "status-row" }, [
        el("span", { text: "현재 상태" }),
        el("span", { class: `badge ${started ? "" : "waiting"}`, text: started ? "진행중" : "대기중" }),
      ])
    );
  }

  function startGeolocation() {
    if (!("geolocation" in navigator)) {
      showToast("이 브라우저는 GPS 위치를 지원하지 않습니다.", "error");
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        currentLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        renderLocationPanel();
      },
      (err) => {
        showToast(`위치 확인 실패: ${err.message}`, "error");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  async function sendLocationUpdate() {
    if (!currentLocation) {
      showToast("아직 GPS 위치를 확인하지 못했습니다.", "error");
      return;
    }
    try {
      await updateOfficerLocation(officerId, currentLocation);
      showToast("위치를 전송했습니다.");
    } catch (err) {
      showToast(`위치 전송 실패: ${err.message}`, "error");
    }
  }

  function renderLocationPanel() {
    locationPanel.innerHTML = "";
    locationPanel.appendChild(el("h2", { text: "내 위치" }));
    locationPanel.appendChild(
      el("div", { class: "status-row" }, [
        el("span", { text: "현재 GPS" }),
        el("span", { text: currentLocation ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}` : "확인 중..." }),
      ])
    );
    const lastSent = officerData && tsToDate(officerData.updatedAt);
    locationPanel.appendChild(
      el("div", { class: "status-row" }, [
        el("span", { text: "마지막 전송" }),
        el("span", { text: lastSent ? formatClock(lastSent) : "아직 없음" }),
      ])
    );
    locationPanel.appendChild(
      el("div", { class: "hint", text: "5분마다 자동으로 위치가 전송됩니다. 지금 바로 보내려면 아래 버튼을 누르세요." })
    );
    locationPanel.appendChild(
      el("button", { class: "btn-primary", text: "지금 위치 전송", onclick: sendLocationUpdate, style: "margin-top:8px;" })
    );
  }

  function renderPhotoPanel() {
    photoPanel.innerHTML = "";
    photoPanel.appendChild(el("h2", { text: "힌트 사진 (선택)" }));
    if (officerData && officerData.photoUrl) {
      photoPanel.appendChild(
        el("img", { src: officerData.photoUrl, style: "width:100%;border-radius:10px;margin-bottom:10px;" })
      );
    }
    const fileId = `photo-input-${officerId}`;
    const input = el("input", {
      type: "file",
      accept: "image/*",
      capture: "environment",
      id: fileId,
      onchange: handlePhotoUpload,
    });
    photoPanel.appendChild(
      el("div", { class: "photo-input-row" }, [
        el("label", { for: fileId, text: "사진 촬영/선택" }, []),
        input,
      ])
    );
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    showToast("사진 업로드 중...");
    try {
      const path = `officers/${officerId}/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await setOfficerPhoto(officerId, url);
      showToast("사진이 업로드되었습니다.");
    } catch (err) {
      showToast(`사진 업로드 실패: ${err.message}`, "error");
    } finally {
      e.target.value = "";
    }
  }

  function renderFoundPanel() {
    foundPanel.innerHTML = "";
    foundPanel.appendChild(el("h2", { text: "발견 여부 체크" }));

    const foundSet = new Set(
      catches
        .filter((c) => Number(c.officerId) === Number(officerId))
        .map((c) => Number(c.teamId))
    );

    if (foundSet.size > 0) {
      const names = TEAM_IDS.filter((id) => foundSet.has(id))
        .map((id) => TEAM_NAMES[id])
        .join(", ");
      foundPanel.appendChild(
        el("div", { class: "status-row" }, [
          el("span", { text: "나를 발견한 팀" }),
          el("span", { class: "badge caught", text: names }),
        ])
      );
    }
    foundPanel.appendChild(
      el("div", { class: "hint", text: "나를 발견한 팀의 버튼을 눌러 켜고, 잘못 눌렀으면 다시 눌러서 꺼주세요." })
    );

    const grid = el("div", { class: "number-grid", style: "margin:12px 0;" });
    for (const id of TEAM_IDS) {
      const isOn = foundSet.has(id);
      const isPending = pendingTeams.has(id);
      grid.appendChild(
        el("button", {
          class: `num-btn with-name ${isOn ? "on" : ""} ${isPending ? "pending" : ""}`,
          disabled: isPending ? "true" : null,
          onclick: () => handleToggle(id, isOn),
        }, [
          el("span", { class: "num-btn-num", text: String(id) }),
          el("span", { class: "num-btn-name", text: TEAM_NAMES[id] }),
        ])
      );
    }
    foundPanel.appendChild(grid);
  }

  async function handleToggle(teamId, wasOn) {
    pendingTeams.add(teamId);
    renderFoundPanel();
    try {
      await toggleFound(officerId, teamId);
      showToast(
        wasOn
          ? `${TEAM_NAMES[teamId]} 발견 표시를 껐습니다.`
          : `${TEAM_NAMES[teamId]}에게 발견된 것으로 표시했습니다.`
      );
    } catch (err) {
      showToast(`처리 실패: ${err.message}`, "error");
    } finally {
      pendingTeams.delete(teamId);
      renderFoundPanel();
    }
  }

  return () => {
    unsubs.forEach((u) => u());
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    if (autoTimer) clearInterval(autoTimer);
  };
}
