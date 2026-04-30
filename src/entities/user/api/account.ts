import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { releaseUsername } from "./usernames";

const BATCH_LIMIT = 400;

export async function deleteAccountData(params: { userId: string; username?: string }) {
  const { userId, username } = params;

  await deleteUserMemories(userId);
  await deleteUserProfile(userId);

  if (username?.trim()) {
    await releaseUsername(username);
  }
}

async function deleteUserMemories(userId: string) {
  const memoriesSnapshot = await getDocs(
    query(collection(db, "memories"), where("ownerId", "==", userId))
  );

  const docRefs = memoriesSnapshot.docs.map((item) => item.ref);

  for (let index = 0; index < docRefs.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const chunk = docRefs.slice(index, index + BATCH_LIMIT);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

async function deleteUserProfile(userId: string) {
  await deleteDoc(doc(db, "users", userId));
}
