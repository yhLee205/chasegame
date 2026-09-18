const NAVER_CLIENT_ID = import.meta.env.VITE_NAVER_CLIENT_ID;

let loadPromise = null;

/** Dynamically loads the Naver Maps JS SDK v3 once and resolves with window.naver. */
export function loadNaverMaps() {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    if (window.naver && window.naver.maps) {
      resolve(window.naver);
      return;
    }
    if (!NAVER_CLIENT_ID) {
      reject(new Error("VITE_NAVER_CLIENT_ID가 설정되지 않았습니다."));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NAVER_CLIENT_ID}`;
    script.async = true;
    script.onload = () => resolve(window.naver);
    script.onerror = () => reject(new Error("네이버 지도 스크립트 로딩에 실패했습니다."));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// 보라매공원 대략적인 중심 좌표 (기본 지도 중심값)
export const BORAMAE_PARK_CENTER = { lat: 37.4956, lng: 126.9236 };
