import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import {
  findSimilarCategory,
  normalizeCategories,
  normalizeCategoryKey,
  normalizeCategoryName,
} from "../model/memory";

export async function getUserCategories(userId: string) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? normalizeCategories(snapshot.data()) : [];
}

export async function saveUserCategories(userId: string, categories: string[]) {
  await setDoc(
    doc(db, "users", userId),
    { categories: normalizeCategories({ categories }) },
    { merge: true }
  );
}

export async function appendUserCategory(userId: string, categoryName: string) {
  const nextName = normalizeCategoryName(categoryName);
  if (!nextName) {
    return [];
  }

  const categories = await getUserCategories(userId);
  const existing = findSimilarCategory(categories, nextName);
  if (existing) {
    throw new Error(`CATEGORY_EXISTS:${existing}`);
  }

  const nextCategories = [...categories, nextName];
  await saveUserCategories(userId, nextCategories);
  return normalizeCategories({ categories: nextCategories });
}

export async function renameCategory(userId: string, currentName: string, nextName: string) {
  const previous = normalizeCategoryName(currentName);
  const updated = normalizeCategoryName(nextName);

  if (!previous || !updated || previous === updated) {
    return getUserCategories(userId);
  }

  const categories = await getUserCategories(userId);
  const conflicting = categories.find((category) => (
    normalizeCategoryKey(category) === normalizeCategoryKey(updated)
    && normalizeCategoryKey(category) !== normalizeCategoryKey(previous)
  ));

  if (conflicting) {
    throw new Error(`CATEGORY_EXISTS:${conflicting}`);
  }

  const nextCategories = categories.map((category) => (category === previous ? updated : category));
  await saveUserCategories(userId, nextCategories);

  const memoriesSnapshot = await getDocs(
    query(
      collection(db, "memories"),
      where("ownerId", "==", userId),
      where("category", "==", previous)
    )
  );

  if (!memoriesSnapshot.empty) {
    const batch = writeBatch(db);
    memoriesSnapshot.docs.forEach((item) => {
      batch.update(item.ref, { category: updated });
    });
    await batch.commit();
  }

  return normalizeCategories({ categories: nextCategories });
}

export async function deleteCategory(userId: string, categoryName: string) {
  const target = normalizeCategoryName(categoryName);
  if (!target) {
    return getUserCategories(userId);
  }

  const categories = await getUserCategories(userId);
  const nextCategories = categories.filter((category) => category !== target);
  await saveUserCategories(userId, nextCategories);

  const memoriesSnapshot = await getDocs(
    query(
      collection(db, "memories"),
      where("ownerId", "==", userId),
      where("category", "==", target)
    )
  );

  if (!memoriesSnapshot.empty) {
    const batch = writeBatch(db);
    memoriesSnapshot.docs.forEach((item) => {
      batch.update(item.ref, { category: "" });
    });
    await batch.commit();
  }

  return nextCategories;
}
