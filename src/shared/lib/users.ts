import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../api/firebase/firebase";
import { normalizeUsername } from "./validation";

type UserRow = {
  username?: string;
  usernameLower?: string;
};

export async function isUsernameTaken(username: string, currentUid?: string) {
  const normalized = normalizeUsername(username);
  if (!normalized) return false;

  const byNormalized = await getDocs(
    query(collection(db, "users"), where("usernameLower", "==", normalized))
  );

  if (byNormalized.docs.some((doc) => doc.id !== currentUid)) {
    return true;
  }

  const byExact = await getDocs(
    query(collection(db, "users"), where("username", "==", username.trim()))
  );

  return byExact.docs.some((doc) => {
    if (doc.id === currentUid) return false;

    const data = doc.data() as UserRow;
    return normalizeUsername(data.usernameLower ?? data.username ?? "") === normalized;
  });
}
