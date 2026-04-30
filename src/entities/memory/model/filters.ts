import type { MemoryAccessType, NormalizedMemory } from "./memory";

export type MemoryFilters = {
  category: string;
  tag: string;
  place: string;
  dateFrom: string;
  dateTo: string;
  accessType: "" | MemoryAccessType;
};

export function applyMemoryFilters(items: NormalizedMemory[], filters: MemoryFilters) {
  return items
    .filter((item) => (filters.category ? item.category === filters.category : true))
    .filter((item) => {
      if (!filters.tag.trim()) {
        return true;
      }

      const normalizedQuery = filters.tag.trim().toLowerCase();
      return [...item.emotionTags, ...item.placeTags, ...item.customTags]
        .some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .filter((item) => {
      if (!filters.place.trim()) {
        return true;
      }

      const normalizedQuery = filters.place.trim().toLowerCase();
      return item.place.toLowerCase().includes(normalizedQuery)
        || item.placeTags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .filter((item) => !filters.dateFrom || item.date >= filters.dateFrom)
    .filter((item) => !filters.dateTo || item.date <= filters.dateTo)
    .filter((item) => (filters.accessType ? item.accessType === filters.accessType : true));
}
