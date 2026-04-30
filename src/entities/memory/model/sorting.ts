import type { NormalizedMemory } from "./memory";

export type MemorySortMode =
  | "created-desc"
  | "created-asc"
  | "event-desc"
  | "event-asc"
  | "title-asc"
  | "title-desc";

export const DEFAULT_MEMORY_SORT_MODE: MemorySortMode = "created-desc";

export function sortMemories(items: NormalizedMemory[], sortMode: MemorySortMode) {
  return [...items].sort((left, right) => compareMemories(left, right, sortMode));
}

function compareMemories(left: NormalizedMemory, right: NormalizedMemory, sortMode: MemorySortMode) {
  switch (sortMode) {
    case "created-asc":
      return compareDates(left.createdAt, right.createdAt);
    case "event-desc":
      return compareStrings(right.date, left.date);
    case "event-asc":
      return compareStrings(left.date, right.date);
    case "title-asc":
      return compareStrings(left.title, right.title);
    case "title-desc":
      return compareStrings(right.title, left.title);
    case "created-desc":
    default:
      return compareDates(right.createdAt, left.createdAt);
  }
}

function compareDates(left: Date | null, right: Date | null) {
  const leftValue = left?.getTime() ?? 0;
  const rightValue = right?.getTime() ?? 0;
  return leftValue - rightValue;
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, "ru");
}
