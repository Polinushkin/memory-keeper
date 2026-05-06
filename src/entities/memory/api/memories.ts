import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import {
  canUserEditMemory,
  canUserViewMemory,
  normalizeMemory,
  normalizeMemoryComment,
  type NormalizedMemoryComment,
  type MemoryDocument,
  type MemoryCommentDocument,
  type NormalizedMemory,
} from "../model/memory";

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

export async function getAccessibleMemoryById(memoryId: string, userId: string): Promise<NormalizedMemory | null> {
  const snapshot = await getDoc(doc(db, "memories", memoryId));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as MemoryRecord;
  const normalized = normalizeMemory(snapshot.id, data);

  if (!canUserViewMemory({ ...normalized, ownerId: data.ownerId }, userId)) {
    throw new Error("MEMORY_ACCESS_DENIED");
  }

  return normalized;
}

export async function canEditMemory(memoryId: string, userId: string) {
  const snapshot = await getDoc(doc(db, "memories", memoryId));
  if (!snapshot.exists()) {
    return false;
  }

  const data = snapshot.data() as MemoryRecord;
  const normalized = normalizeMemory(snapshot.id, data);

  return canUserEditMemory({ ...normalized, ownerId: data.ownerId }, userId);
}

export async function deleteMemoryById(memoryId: string) {
  await deleteDoc(doc(db, "memories", memoryId));
}

export async function getPublicMemoriesByOwnerIds(ownerIds: string[]) {
  const uniqueOwnerIds = Array.from(new Set(ownerIds.map((item) => item.trim()).filter(Boolean)));
  if (uniqueOwnerIds.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    uniqueOwnerIds.map((ownerId) => getDocs(
      query(
        collection(db, "memories"),
        where("ownerId", "==", ownerId),
        where("accessType", "==", "public")
      )
    ))
  );

  const uniqueMemories = new Map<string, NormalizedMemory>();
  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((item) => {
      uniqueMemories.set(item.id, normalizeMemory(item.id, item.data() as MemoryRecord));
    });
  });

  return Array.from(uniqueMemories.values());
}

export function subscribeToMemoryComments(
  memoryId: string,
  onChange: (comments: NormalizedMemoryComment[]) => void,
  onError: (error: unknown) => void
) {
  return onSnapshot(
    query(collection(db, "memories", memoryId, "comments"), orderBy("createdAt", "asc")),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => normalizeMemoryComment(item.id, item.data() as MemoryCommentDocument)));
    },
    onError
  );
}

export async function createMemoryComment(params: {
  memoryId: string;
  authorId: string;
  authorUsername: string;
  authorAvatarDataUrl: string;
  text: string;
}) {
  await addDoc(collection(db, "memories", params.memoryId, "comments"), {
    authorId: params.authorId,
    authorUsername: params.authorUsername,
    authorAvatarDataUrl: params.authorAvatarDataUrl,
    text: params.text.trim(),
    createdAt: serverTimestamp(),
  });
}
