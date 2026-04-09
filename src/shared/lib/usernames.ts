import { deleteDoc, doc, getDoc, runTransaction } from "firebase/firestore";
import { db } from "../api/firebase/firebase";
import { normalizeUsername } from "./validation";

export function getUsernameRef(username: string) {
  return doc(db, "usernames", normalizeUsername(username));
}

export async function getEmailByUsername(username: string) {
  const snap = await getDoc(getUsernameRef(username));

  if (!snap.exists()) {
    return "";
  }

  return String(snap.data().email ?? "");
}

export async function reserveUsername(params: {
  uid: string;
  username: string;
  email: string;
  currentUsername?: string;
}) {
  const normalized = normalizeUsername(params.username);
  const currentNormalized = normalizeUsername(params.currentUsername ?? "");

  const nextRef = doc(db, "usernames", normalized);
  const currentRef = currentNormalized ? doc(db, "usernames", currentNormalized) : null;

  await runTransaction(db, async (transaction) => {
    const nextSnap = await transaction.get(nextRef);

    if (nextSnap.exists()) {
      const ownerUid = String(nextSnap.data()?.uid ?? "");
      if (ownerUid !== params.uid) {
        throw new Error("USERNAME_TAKEN");
      }
    }

    transaction.set(nextRef, {
      uid: params.uid,
      username: params.username.trim(),
      usernameLower: normalized,
      email: params.email.trim(),
    });

    if (currentRef && currentNormalized !== normalized) {
      transaction.delete(currentRef);
    }
  });
}

export async function releaseUsername(username: string) {
  if (!username.trim()) return;
  await deleteDoc(getUsernameRef(username));
}
