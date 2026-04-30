import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { normalizeMemory, type MemoryDocument, type NormalizedMemory } from "../model/memory";

type MemoryRecord = MemoryDocument & { ownerId?: string };

export async function getOwnedMemoryById(memoryId: string, ownerId: string): Promise<NormalizedMemory | null> {
  const snapshot = await getDoc(doc(db, "memories", memoryId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as MemoryRecord;
  if (data.ownerId !== ownerId) {
    throw new Error("MEMORY_ACCESS_DENIED");
  }

  return normalizeMemory(snapshot.id, data);
}

export async function deleteMemoryById(memoryId: string) {
  await deleteDoc(doc(db, "memories", memoryId));
}
