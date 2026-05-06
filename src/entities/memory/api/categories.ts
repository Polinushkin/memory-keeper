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

  await updateCategoryInMemories(userId, previous, (memoryCategories) => {
    const renamedCategories = memoryCategories.map((category) => (
      category === previous ? updated : category
    ));

    return buildCategoryPayload(renamedCategories);
  });

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

  await updateCategoryInMemories(userId, target, (memoryCategories) => {
    const remainingCategories = memoryCategories.filter((category) => category !== target);
    return buildCategoryPayload(remainingCategories);
  });

  return nextCategories;
}

async function updateCategoryInMemories(
  userId: string,
  targetCategory: string,
  buildPayload: (memoryCategories: string[]) => { category: string; categories: string[] }
) {
  const [legacySnapshot, multiSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, "memories"),
        where("ownerId", "==", userId),
        where("category", "==", targetCategory)
      )
    ),
    getDocs(
      query(
        collection(db, "memories"),
        where("ownerId", "==", userId),
        where("categories", "array-contains", targetCategory)
      )
    ),
  ]);

  const uniqueDocs = new Map<string, typeof legacySnapshot.docs[number]>();
  [...legacySnapshot.docs, ...multiSnapshot.docs].forEach((item) => {
    uniqueDocs.set(item.id, item);
  });

  if (uniqueDocs.size === 0) {
    return;
  }

  const batch = writeBatch(db);
  uniqueDocs.forEach((item) => {
    const data = item.data();
    const currentCategories = normalizeCategories({
      categories: Array.isArray(data.categories)
        ? data.categories
        : data.category
          ? [data.category]
          : [],
    });

    batch.update(item.ref, buildPayload(currentCategories));
  });
  await batch.commit();
}

function buildCategoryPayload(categories: string[]) {
  const normalized = normalizeCategories({ categories });
  return {
    category: normalized[0] ?? "",
    categories: normalized,
  };
}
