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
import { db } from "../../../shared/api/firebase/firebase";
import { buildFriendshipId } from "../../friend/model/friend";
import { normalizeUsername } from "../../../shared/lib/validation";
import {
  getProfileVisibility,
  getSharedInvitePolicy,
  type UserProfileRow,
  type UserRow,
  type UserSearchResult,
  type UsernameRow,
} from "../model/user";

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
      };
    })
    .filter((item): item is { id: string; username: string } => Boolean(item));

  const hydratedResults = await Promise.all(
    rawResults.map((item) => getUserProfileById(item.id, currentUid))
  );

  return hydratedResults.filter((item): item is UserSearchResult => Boolean(item));
}

export async function searchUsersByUsernameOrEmail(queryValue: string, currentUid?: string) {
  const trimmedQuery = queryValue.trim();
  if (!trimmedQuery) {
    return [];
  }

  const [usernameResults, emailResults] = await Promise.all([
    searchUsersByUsername(trimmedQuery, currentUid),
    findUsersByEmail(trimmedQuery, currentUid),
  ]);

  const unique = new Map<string, UserSearchResult>();
  [...usernameResults, ...emailResults].forEach((item) => {
    unique.set(item.id, item);
  });

  return Array.from(unique.values()).sort((left, right) => left.username.localeCompare(right.username, "ru"));
}

export async function getUserProfileById(userId: string, viewerId?: string) {
  const [userSnapshot, usernameSnapshot, isFriend] = await Promise.all([
    getDoc(doc(db, "users", userId)),
    getDocs(query(collection(db, "usernames"), where("uid", "==", userId), limit(1))),
    viewerId && viewerId !== userId
      ? getDoc(doc(db, "friends", buildFriendshipId(userId, viewerId)))
          .then((snapshot) => snapshot.exists())
          .catch(() => false)
      : Promise.resolve(false),
  ]);

  if (!userSnapshot.exists() && usernameSnapshot.empty) {
    return null;
  }

  const userData = userSnapshot.exists()
    ? (userSnapshot.data() as UserProfileRow)
    : null;
  const usernameData = !usernameSnapshot.empty ? (usernameSnapshot.docs[0].data() as UsernameRow) : null;
  const username = String(userData?.username ?? usernameData?.username ?? "");

  if (!username) {
    return null;
  }

  const isOwner = viewerId === userId;
  const descriptionVisibility = getProfileVisibility(userData?.descriptionVisibility);
  const avatarVisibility = getProfileVisibility(userData?.avatarVisibility);
  const sharedInvitePolicy = getSharedInvitePolicy(userData?.sharedInvitePolicy);

  return {
    id: userId,
    username,
    usernameLower: normalizeUsername(String(userData?.usernameLower ?? usernameData?.usernameLower ?? username)),
    description: canViewField(descriptionVisibility, isOwner, isFriend)
      ? String(userData?.description ?? usernameData?.description ?? "")
      : "",
    avatarDataUrl: canViewField(avatarVisibility, isOwner, isFriend)
      ? String(userData?.avatarDataUrl ?? usernameData?.avatarDataUrl ?? "")
      : "",
    descriptionVisibility,
    avatarVisibility,
    sharedInvitePolicy,
  } satisfies UserSearchResult;
}

function canViewField(
  visibility: "public" | "friends" | "private",
  isOwner: boolean,
  isFriend: boolean
) {
  if (isOwner) {
    return true;
  }

  if (visibility === "public") {
    return true;
  }

  if (visibility === "friends") {
    return isFriend;
  }

  return false;
}

async function findUsersByEmail(email: string, currentUid?: string) {
  const candidates = Array.from(new Set([email.trim(), email.trim().toLowerCase()])).filter(Boolean);
  if (candidates.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    candidates.map((candidate) => getDocs(
      query(collection(db, "users"), where("email", "==", candidate), limit(8))
    ))
  );

  const userIds = Array.from(new Set(
    snapshots.flatMap((snapshot) => snapshot.docs.map((item) => item.id))
      .filter((id) => id && id !== currentUid)
  ));

  const profiles = await Promise.all(userIds.map((userId) => getUserProfileById(userId, currentUid)));
  return profiles.filter((item): item is UserSearchResult => Boolean(item));
}
