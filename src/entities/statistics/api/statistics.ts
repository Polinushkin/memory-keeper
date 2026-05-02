import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { normalizeMemory, type MemoryDocument, type NormalizedMemory } from "../../memory";

export async function getOwnedMemoriesForStatistics(userId: string): Promise<NormalizedMemory[]> {
  const snapshot = await getDocs(query(collection(db, "memories"), where("ownerId", "==", userId)));
  return snapshot.docs.map((item) => normalizeMemory(item.id, item.data() as MemoryDocument));
}
