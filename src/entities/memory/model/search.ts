import { getAllTags, type NormalizedMemory } from "./memory";

export function searchMemoriesByQuery(items: NormalizedMemory[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return items.filter((item) => getMemorySearchText(item).includes(normalizedQuery));
}

export function getMemoryPreview(item: NormalizedMemory) {
  const firstTag = getAllTags(item)[0];
  const parts = [
    item.text.trim(),
    firstTag ? `Тег: ${firstTag}` : "",
    item.place ? `Место: ${item.place}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return parts || "Краткое превью недоступно";
}

function getMemorySearchText(item: NormalizedMemory) {
  return [
    item.title,
    item.text,
    item.ownerUsername,
    ...item.categories,
    ...item.emotionTags,
    ...item.placeTags,
    ...item.customTags,
    ...item.sharedWith.map((share) => share.username),
  ].join(" ").toLowerCase();
}
