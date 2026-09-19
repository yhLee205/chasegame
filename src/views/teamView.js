import { el, showToast, formatClock, tsToDate } from "../ui.js";
import { loadNaverMaps, BORAMAE_PARK_CENTER } from "../naverMap.js";
import {
  OFFICER_IDS,
  TEAM_IDS,
  TEAM_NAMES,
  officerName,
  subscribeGameStatus,
  subscribeOfficers,
  subscribeTeams,
  subscribeCatches,
  updateTeamLocation,
} from "../gameData.js";
import { distanceMeters, bearingDegrees, compassLabel, formatDistance } from "../geo.js";

const WRITE_INTERVAL_MS = 10000;

export function renderTeamView(container, { teamId, onExit }) {
  const unsubs = [];
  let map = null;
  let naverNs = null;
  const officerMarkers = {};
  let selfMarker = null;
  let watchId = null;
  let lastWriteAt = 0;
  let selfLocation = null;

  let officers = {};
  let teams = {};
  let catches = [];
  let gameStatus = null;

  const screen = el("div", { class: "screen" });
  const topbar = el("div", { class: "topbar" }, [
    el("h1", {}, [el("span", { class: "dot" }), `${TEAM_NAMES[teamId]} (${teamId}팀)`]),
    el("button", { class: "btn-ghost", text: "나가기", onclick: handleExit }),
  ]);
  const content = el("div", { class: "content" });
  screen.appendChild(topbar);
  screen.appendChild(content);
  container.appendChild(screen);

  const gpsStatusEl = el("div", { class: "hint", text: "GPS 위치 확인 중..." });
  const mapWrap = el("div", { class: "map-wrap" }, [el("div", { id: "map" })]);
  const targetPanel = el("div", { class: "panel" }, [el("h2", { text: "대상 현황" })]);
  const targetList = el("div", { class: "target-list" });
  targetPanel.appendChild(targetList);
  const boardPanel = el("div", { class: "panel" }, [el("h2", { text: "실시간 리더보드" })]);
  const boardList = el("div", {});
  boardPanel.appendChild(boardList);

  content.appendChild(gpsStatusEl);
  content.appendChild(mapWrap);
  content.appendChild(targetPanel);
  content.appendChild(boardPanel);

  function handleExit() {
    if (confirm("역할 선택 화면으로 돌아갈까요?")) onExit();
  }

  loadNaverMaps()
    .then((naver) => {
      naverNs = naver;
      map = new naver.maps.Map("map", {
        center: new naver.maps.LatLng(BORAMAE_PARK_CENTER.lat, BORAMAE_PARK_CENTER.lng),
        zoom: 16,
      });
      renderMarkers();
    })
    .catch((err) => {
      mapWrap.innerHTML = "";
      mapWrap.appendChild(el("div", { class: "error-msg", text: `지도를 불러오지 못했습니다: ${err.message}` }));
    });

  unsubs.push(subscribeGameStatus((data) => {
    gameStatus = data;
    renderBoard();
  }));
  unsubs.push(subscribeOfficers((data) => {
    officers = data;
    renderMarkers();
    renderTargets();
    renderBoard();
  }));
  unsubs.push(subscribeTeams((data) => {
    teams = data;
  }));
  unsubs.push(subscribeCatches((data) => {
    catches = data;
    renderBoard();
    renderTargets();
  }));

  startGeolocation();

  function startGeolocation() {
    if (!("geolocation" in navigator)) {
      gpsStatusEl.textContent = "이 브라우저는 GPS 위치를 지원하지 않습니다.";
      gpsStatusEl.classList.add("error-msg");
      return;
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        selfLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        gpsStatusEl.textContent = `내 위치 추적 중 (정확도 ${Math.round(pos.coords.accuracy)}m)`;
        gpsStatusEl.classList.remove("error-msg");
        renderMarkers();
        const now = Date.now();
        if (now - lastWriteAt > WRITE_INTERVAL_MS) {
          lastWriteAt = now;
          updateTeamLocation(teamId, selfLocation).catch(() => {});
        }
      },
      (err) => {
        gpsStatusEl.classList.add("error-msg");
        if (err.code === err.PERMISSION_DENIED) {
          gpsStatusEl.textContent = "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 접근을 허용해주세요.";
        } else {
          gpsStatusEl.textContent = `위치 확인 실패: ${err.message}`;
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
  }

  function renderMarkers() {
    if (!map || !naverNs) return;

    for (const id of OFFICER_IDS) {
      const o = officers[id];
      const hasLoc = o && o.location;
      if (!hasLoc) {
        if (officerMarkers[id]) {
          officerMarkers[id].setMap(null);
          delete officerMarkers[id];
        }
        continue;
      }
      const pos = new naverNs.maps.LatLng(o.location.lat, o.location.lng);
      if (!officerMarkers[id]) {
        officerMarkers[id] = new naverNs.maps.Marker({
          position: pos,
          map,
          icon: {
            content: `<div class="target-marker" style="${o.found ? "opacity:0.35;" : ""}"></div>`,
            anchor: new naverNs.maps.Point(13, 13),
          },
        });
      } else {
        officerMarkers[id].setPosition(pos);
        officerMarkers[id].setIcon({
          content: `<div class="target-marker" style="${o.found ? "opacity:0.35;" : ""}"></div>`,
          anchor: new naverNs.maps.Point(13, 13),
        });
      }
    }

    if (selfLocation) {
      const pos = new naverNs.maps.LatLng(selfLocation.lat, selfLocation.lng);
      if (!selfMarker) {
        selfMarker = new naverNs.maps.Marker({
          position: pos,
          map,
          icon: { content: '<div class="self-marker"></div>', anchor: new naverNs.maps.Point(10, 10) },
          zIndex: 100,
        });
        map.setCenter(pos);
      } else {
        selfMarker.setPosition(pos);
      }
    }
  }

  function renderTargets() {
    targetList.innerHTML = "";
    for (const id of OFFICER_IDS) {
      const o = officers[id] || {};
      const foundTeamIds = new Set(
        catches.filter((c) => Number(c.officerId) === id).map((c) => Number(c.teamId))
      );
      const foundCount = foundTeamIds.size;
      const item = el("div", { class: "target-item" });
      if (o.photoUrl) {
        item.appendChild(el("img", { class: "thumb", src: o.photoUrl, alt: "hint" }));
      } else {
        item.appendChild(el("div", { class: "thumb" }));
      }
      const info = el("div", { class: "info" });
      info.appendChild(el("div", { class: "name", text: officerName(officers, id) }));

      let metaText = "위치 정보 없음";
      if (o.location) {
        if (selfLocation) {
          const dist = distanceMeters(selfLocation, o.location);
          const bearing = bearingDegrees(selfLocation, o.location);
          metaText = `${formatDistance(dist)} · ${compassLabel(bearing)}쪽`;
        } else {
          metaText = "내 위치를 확인하면 거리가 표시돼요";
        }
      }
      info.appendChild(el("div", { class: "meta", text: metaText }));
      item.appendChild(info);

      item.appendChild(
        el("span", {
          class: `badge ${foundCount > 0 ? "caught" : "waiting"}`,
          text: foundCount > 0 ? `발견됨 (${foundCount}팀)` : "수색중",
        })
      );
      targetList.appendChild(item);
    }
  }

  function renderBoard() {
    boardList.innerHTML = "";
    const startTime = tsToDate(gameStatus && gameStatus.startTime);

    const rows = TEAM_IDS.map((id) => {
      const teamCatches = catches.filter((c) => Number(c.teamId) === id);
      // Dedupe by officerId: legacy catch records (from before the per-team on/off
      // toggle) could contain more than one entry per officer, which made this count
      // exceed the number of officers. A team can only ever have caught each officer once.
      const count = new Set(teamCatches.map((c) => Number(c.officerId))).size;
      let lastCatchDate = null;
      for (const c of teamCatches) {
        const d = tsToDate(c.foundAt);
        if (d && (!lastCatchDate || d > lastCatchDate)) lastCatchDate = d;
      }
      const elapsedMs = lastCatchDate && startTime ? lastCatchDate - startTime : Infinity;
      return { id, count, elapsedMs, lastCatchDate };
    });

    rows.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.elapsedMs - b.elapsedMs;
    });

    rows.forEach((row, idx) => {
      const rank = idx + 1;
      const timeText =
        row.count === 0 ? "-" : row.elapsedMs === Infinity ? formatClock(row.lastCatchDate) : msToClock(row.elapsedMs);
      boardList.appendChild(
        el("div", { class: `leaderboard-row ${rank === 1 && row.count > 0 ? "top1" : ""}` }, [
          el("div", { class: "rank", text: String(rank) }),
          el("div", { class: "team-name", text: `${TEAM_NAMES[row.id]}${row.id === Number(teamId) ? " (나)" : ""}` }),
          el("div", { class: "count", text: `${row.count}/4` }),
          el("div", { class: "time", text: timeText }),
        ])
      );
    });
  }

  function msToClock(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}분 ${String(s).padStart(2, "0")}초`;
  }

  return () => {
    unsubs.forEach((u) => u());
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  };
}
