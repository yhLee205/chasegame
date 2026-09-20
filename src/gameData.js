import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase.js";

export const OFFICER_IDS = [1, 2, 3, 4];
export const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const OFFICER_NAMES = {
  1: "이영호",
  2: "정하준",
  3: "남규빈",
  4: "최가은",
};

export const TEAM_NAMES = {
  1: "민수순",
  2: "샤론순",
  3: "호현순",
  4: "미연순",
  5: "승희순",
  6: "은혜순",
  7: "재혁순",
  8: "성재순",
  9: "은민순",
};

const gameDocRef = doc(db, "game", "status");
const officerDocRef = (id) => doc(db, "officers", String(id));
const teamDocRef = (id) => doc(db, "teams", String(id));
const catchesCol = collection(db, "catches");
/** One doc per (officer, team) pair, so a team's catch on an officer is a simple on/off toggle. */
const catchDocRef = (officerId, teamId) => doc(catchesCol, `${officerId}_${teamId}`);

const DEFAULT_OFFICER_PASSWORD =
  import.meta.env.VITE_DEFAULT_OFFICER_PASSWORD || "0000";

/** Creates the game/status doc and officer/team docs if they don't exist yet. Safe to call repeatedly. */
export async function ensureGameDocuments() {
  const snap = await getDoc(gameDocRef);
  if (!snap.exists()) {
    await setDoc(gameDocRef, {
      started: false,
      startTime: null,
      officerPassword: DEFAULT_OFFICER_PASSWORD,
      resetCount: 0,
    });
  }

  for (const id of OFFICER_IDS) {
    const ref = officerDocRef(id);
    const s = await getDoc(ref);
    if (!s.exists()) {
      await setDoc(ref, { ...emptyOfficerState(), name: OFFICER_NAMES[id] });
    }
  }
  for (const id of TEAM_IDS) {
    const ref = teamDocRef(id);
    const s = await getDoc(ref);
    if (!s.exists()) {
      await setDoc(ref, emptyTeamState());
    }
  }
}

function emptyOfficerState() {
  return {
    location: null,
    updatedAt: null,
    photoUrl: null,
    photoUpdatedAt: null,
    found: false,
    foundByTeam: null,
    foundAt: null,
  };
}

function emptyTeamState() {
  return {
    location: null,
    updatedAt: null,
  };
}

export function subscribeGameStatus(cb) {
  return onSnapshot(gameDocRef, (snap) => cb(snap.exists() ? snap.data() : null));
}

export function subscribeOfficers(cb) {
  return onSnapshot(collection(db, "officers"), (snap) => {
    const map = {};
    snap.forEach((d) => (map[d.id] = d.data()));
    cb(map);
  });
}

export function subscribeTeams(cb) {
  return onSnapshot(collection(db, "teams"), (snap) => {
    const map = {};
    snap.forEach((d) => (map[d.id] = d.data()));
    cb(map);
  });
}

export function subscribeCatches(cb) {
  return onSnapshot(query(catchesCol, orderBy("foundAt", "asc")), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function updateOfficerLocation(officerId, location) {
  await updateDoc(officerDocRef(officerId), {
    location,
    updatedAt: serverTimestamp(),
  });
}

export async function updateTeamLocation(teamId, location) {
  await updateDoc(teamDocRef(teamId), {
    location,
    updatedAt: serverTimestamp(),
  });
}

export async function setOfficerPhoto(officerId, photoUrl) {
  await updateDoc(officerDocRef(officerId), {
    photoUrl,
    photoUpdatedAt: serverTimestamp(),
  });
}

/** Host-only: renames an officer mid-game (e.g. a substitution). Persists across new games. */
export async function updateOfficerName(officerId, newName) {
  await updateDoc(officerDocRef(officerId), { name: newName });
}

/** Current display name for an officer: the live Firestore override if the host has set one, else the default. */
export function officerName(officers, id) {
  return (officers && officers[id] && officers[id].name) || OFFICER_NAMES[id];
}

/** Finds the catch doc with the latest foundAt among a snapshot's docs (client-side, avoids needing a composite index). */
function latestCatchDoc(snap) {
  let latest = null;
  snap.forEach((d) => {
    const data = d.data();
    if (!data.foundAt) return;
    if (!latest || data.foundAt.toMillis() > latest.data.foundAt.toMillis()) {
      latest = { ref: d.ref, data };
    }
  });
  return latest;
}

/** Recomputes an officer's summary fields from the most recent remaining catch (or clears them if none). */
async function refreshOfficerSummary(officerId) {
  const q = query(catchesCol, where("officerId", "==", Number(officerId)));
  const snap = await getDocs(q);
  const latest = latestCatchDoc(snap);
  if (!latest) {
    await updateDoc(officerDocRef(officerId), { found: false, foundByTeam: null, foundAt: null });
  } else {
    await updateDoc(officerDocRef(officerId), {
      found: true,
      foundByTeam: latest.data.teamId,
      foundAt: latest.data.foundAt,
    });
  }
}

/** Toggles whether a specific team has found a specific officer on/off, independently of other teams. */
export async function toggleFound(officerId, teamId) {
  const ref = catchDocRef(officerId, teamId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
  } else {
    await setDoc(ref, {
      officerId: Number(officerId),
      teamId: Number(teamId),
      foundAt: serverTimestamp(),
    });
  }
  await refreshOfficerSummary(officerId);
}

/** Host-only: undo the most recently recorded catch for an officer (mistake correction). */
export async function undoFound(officerId) {
  const q = query(catchesCol, where("officerId", "==", Number(officerId)));
  const snap = await getDocs(q);
  const latest = latestCatchDoc(snap);
  if (!latest) return;
  await deleteDoc(latest.ref);
  await refreshOfficerSummary(officerId);
}

export async function verifyOfficerPassword(password) {
  const snap = await getDoc(gameDocRef);
  if (!snap.exists()) return false;
  return snap.data().officerPassword === password;
}

export async function changeOfficerPassword(newPassword) {
  await updateDoc(gameDocRef, { officerPassword: newPassword });
}

/** Host-only: wipes all locations/photos/catch records and starts a fresh game. */
export async function startNewGame() {
  const catchesSnap = await getDocs(catchesCol);
  const batch = writeBatch(db);
  catchesSnap.forEach((d) => batch.delete(d.ref));
  for (const id of OFFICER_IDS) {
    // merge:true so a name the host set earlier survives a new-game reset.
    batch.set(officerDocRef(id), emptyOfficerState(), { merge: true });
  }
  for (const id of TEAM_IDS) {
    batch.set(teamDocRef(id), emptyTeamState());
  }
  await batch.commit();

  const current = await getDoc(gameDocRef);
  const resetCount = current.exists() ? (current.data().resetCount || 0) + 1 : 1;
  await updateDoc(gameDocRef, {
    started: true,
    startTime: serverTimestamp(),
    resetCount,
  });
}

export async function endGame() {
  await updateDoc(gameDocRef, { started: false });
}
