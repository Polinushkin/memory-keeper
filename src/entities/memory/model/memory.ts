export type MemoryAccessType = "private" | "shared" | "public";

export type MemoryAccessOption = {
  value: MemoryAccessType;
  label: string;
  description: string;
};

export type MemoryCategoryRecord = {
  categories?: unknown;
};

export type MemoryDocument = {
  title?: unknown;
  text?: unknown;
  date?: unknown;
  createdAt?: unknown;
  place?: unknown;
  emotion?: unknown;
  emotionTags?: unknown;
  placeTags?: unknown;
  customTags?: unknown;
  category?: unknown;
  accessType?: unknown;
  photos?: unknown;
};

export type NormalizedMemory = {
  id: string;
  title: string;
  text: string;
  date: string;
  createdAt: Date | null;
  place: string;
  emotionTags: string[];
  placeTags: string[];
  customTags: string[];
  category: string;
  accessType: MemoryAccessType;
  photos: Array<{ name?: string; dataUrl?: string }>;
};

export const MEMORY_ACCESS_TYPES: MemoryAccessOption[] = [
  {
    value: "private",
    label: "Приватное",
    description: "Доступно только вам",
  },
  {
    value: "shared",
    label: "По ссылке / совместное",
    description: "Подготовлено для совместного доступа",
  },
  {
    value: "public",
    label: "Публичное",
    description: "Подходит для открытого доступа",
  },
];

export function normalizeList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

export function normalizeCategories(record: MemoryCategoryRecord | null | undefined) {
  const unique = new Map<string, string>();

  normalizeList(record?.categories).forEach((category) => {
    const key = normalizeCategoryKey(category);
    if (!key || unique.has(key)) {
      return;
    }

    unique.set(key, category);
  });

  return Array.from(unique.values()).sort((left, right) => left.localeCompare(right, "ru"));
}

export function normalizeCategoryName(value: string) {
  return value.trim();
}

export function normalizeCategoryKey(value: string) {
  return normalizeCategoryName(value).toLocaleLowerCase("ru-RU");
}

export function findSimilarCategory(categories: string[], value: string) {
  const targetKey = normalizeCategoryKey(value);
  if (!targetKey) {
    return "";
  }

  return categories.find((category) => normalizeCategoryKey(category) === targetKey) ?? "";
}

export function parseTagInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export function getAccessType(value: unknown): MemoryAccessType {
  return value === "shared" || value === "public" ? value : "private";
}

export function getEmotionTags(memory: MemoryDocument) {
  const tags = normalizeList(memory.emotionTags);
  if (tags.length > 0) {
    return tags;
  }

  return typeof memory.emotion === "string" && memory.emotion.trim()
    ? [memory.emotion.trim()]
    : [];
}

export function getPlaceTags(memory: MemoryDocument) {
  const tags = normalizeList(memory.placeTags);
  if (tags.length > 0) {
    return tags;
  }

  return typeof memory.place === "string" && memory.place.trim()
    ? [memory.place.trim()]
    : [];
}

export function getCustomTags(memory: MemoryDocument) {
  return normalizeList(memory.customTags);
}

export function getCategory(memory: MemoryDocument) {
  return typeof memory.category === "string" ? memory.category.trim() : "";
}

export function getDateValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }

  return value instanceof Date ? value : null;
}

export function getAllTags(memory: Pick<NormalizedMemory, "emotionTags" | "placeTags" | "customTags">) {
  return [...memory.emotionTags, ...memory.placeTags, ...memory.customTags];
}

export function normalizeMemory(id: string, memory: MemoryDocument): NormalizedMemory {
  return {
    id,
    title: typeof memory.title === "string" ? memory.title : "",
    text: typeof memory.text === "string" ? memory.text : "",
    date: typeof memory.date === "string" ? memory.date : "",
    createdAt: getDateValue(memory.createdAt),
    place: typeof memory.place === "string" ? memory.place : "",
    emotionTags: getEmotionTags(memory),
    placeTags: getPlaceTags(memory),
    customTags: getCustomTags(memory),
    category: getCategory(memory),
    accessType: getAccessType(memory.accessType),
    photos: Array.isArray(memory.photos)
      ? memory.photos.filter(
          (photo): photo is { name?: string; dataUrl?: string } =>
            typeof photo === "object" && photo !== null
        )
      : [],
  };
}
