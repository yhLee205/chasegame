import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase.js";

export const OFFICER_IDS = [1, 2, 3, 4];
export const TEAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const OFFICER_NAMES = {
  1: "이영호",
  2: "김동민",
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
      await setDoc(ref, emptyOfficerState());
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

export async function reportFound(officerId, teamId) {
  const foundAt = serverTimestamp();
  await updateDoc(officerDocRef(officerId), {
    found: true,
    foundByTeam: teamId,
    foundAt,
  });
  await addDoc(catchesCol, {
    officerId: Number(officerId),
    teamId: Number(teamId),
    foundAt,
  });
}

/** Host-only: undo the most recent catch for an officer (mistake correction). */
export async function undoFound(officerId) {
  const q = query(
    catchesCol,
    where("officerId", "==", Number(officerId)),
    orderBy("foundAt", "desc"),
    limit(1)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach((d) => batch.delete(d.ref));
  batch.update(officerDocRef(officerId), {
    found: false,
    foundByTeam: null,
    foundAt: null,
  });
  await batch.commit();
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
    batch.set(officerDocRef(id), emptyOfficerState());
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
