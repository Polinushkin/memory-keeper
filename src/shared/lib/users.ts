import {
  collection,
  doc,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  where,
} from "firebase/firestore";
import { db } from "../api/firebase/firebase";
import { normalizeUsername } from "./validation";

type UserRow = {
  username?: string;
  usernameLower?: string;
};

type UsernameRow = {
  uid?: string;
  username?: string;
  usernameLower?: string;
  description?: string;
  avatarDataUrl?: string;
};

type UserProfileRow = {
  description?: string;
  avatarDataUrl?: string;
};

export async function isUsernameTaken(username: string, currentUid?: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const byNormalized = await getDocs(
    query(collection(db, "users"), where("usernameLower", "==", normalized))
  );

  if (byNormalized.docs.some((item) => item.id !== currentUid)) {
    return true;
  }

  const byExact = await getDocs(
    query(collection(db, "users"), where("username", "==", username.trim()))
  );

  return byExact.docs.some((item) => {
    if (item.id === currentUid) return false;

    const data = item.data() as UserRow;
    return normalizeUsername(data.usernameLower ?? data.username ?? "") === normalized;
  });
}

export type UserSearchResult = {
  id: string;
  username: string;
  usernameLower: string;
  description: string;
  avatarDataUrl: string;
};

export async function searchUsersByUsername(username: string, currentUid?: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return [];
  }

  const usernameSnapshots = await getDocs(
    query(
      collection(db, "usernames"),
      orderBy("usernameLower"),
      startAt(normalized),
      endAt(`${normalized}\uf8ff`),
      limit(8)
    )
  );

  const rawResults = usernameSnapshots.docs
    .map((snapshot) => {
      const usernameData = snapshot.data() as UsernameRow;
      const uid = String(usernameData.uid ?? "");

      if (!uid || uid === currentUid) {
        return null;
      }

      return {
        id: uid,
        username: String(usernameData.username ?? snapshot.id),
        usernameLower: normalizeUsername(String(usernameData.usernameLower ?? usernameData.username ?? snapshot.id)),
        description: String(usernameData.description ?? ""),
        avatarDataUrl: String(usernameData.avatarDataUrl ?? ""),
      };
    })
    .filter((item): item is UserSearchResult => Boolean(item));

  const hydratedResults = await Promise.all(
    rawResults.map(async (item) => {
      if (item.description && item.avatarDataUrl) {
        return item;
      }

      try {
        const userSnapshot = await getDoc(doc(db, "users", item.id));
        if (!userSnapshot.exists()) {
          return item;
        }

        const userData = userSnapshot.data() as UserProfileRow;
        return {
          ...item,
          description: item.description || String(userData.description ?? ""),
          avatarDataUrl: item.avatarDataUrl || String(userData.avatarDataUrl ?? ""),
        };
      } catch {
        return item;
      }
    })
  );

  return hydratedResults;
}
