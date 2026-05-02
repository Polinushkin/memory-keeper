export type MemoryAccessType = "private" | "shared" | "public";
export type MemoryShareRole = "view" | "comment" | "edit";
export type NormalizedTimestampLike =
  | Date
  | {
      toDate?: () => Date;
    }
  | null
  | undefined;

export type MemoryAccessOption = {
  value: MemoryAccessType;
  label: string;
  description: string;
};

export type MemoryCategoryRecord = {
  categories?: unknown;
};

export type MemoryDocument = {
  ownerId?: unknown;
  ownerUsername?: unknown;
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
  sharedWith?: unknown;
  sharedUserIds?: unknown;
  sharedEditorIds?: unknown;
  sharedCommenterIds?: unknown;
  photos?: unknown;
};

export type MemoryShareDocument = {
  userId?: unknown;
  username?: unknown;
  role?: unknown;
  grantedAt?: unknown;
};

export type MemoryCommentDocument = {
  authorId?: unknown;
  authorUsername?: unknown;
  authorAvatarDataUrl?: unknown;
  text?: unknown;
  createdAt?: unknown;
};

export type NormalizedMemoryShare = {
  userId: string;
  username: string;
  role: MemoryShareRole;
  grantedAt: Date | null;
};

export type NormalizedMemoryComment = {
  id: string;
  authorId: string;
  authorUsername: string;
  authorAvatarDataUrl: string;
  text: string;
  createdAt: Date | null;
};

export type NormalizedMemory = {
  id: string;
  ownerId: string;
  ownerUsername: string;
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
  sharedWith: NormalizedMemoryShare[];
  sharedUserIds: string[];
  sharedEditorIds: string[];
  sharedCommenterIds: string[];
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

export function getMemoryShareRole(value: unknown): MemoryShareRole {
  return value === "comment" || value === "edit" ? value : "view";
}

export function normalizeSharedUsers(values: unknown) {
  return normalizeList(values);
}

export function normalizeMemoryShare(value: unknown): NormalizedMemoryShare | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const share = value as MemoryShareDocument;
  const userId = typeof share.userId === "string" ? share.userId.trim() : "";
  const username = typeof share.username === "string" ? share.username.trim() : "";

  if (!userId || !username) {
    return null;
  }

  return {
    userId,
    username,
    role: getMemoryShareRole(share.role),
    grantedAt: getDateValue(share.grantedAt),
  };
}

export function getSharedWith(memory: MemoryDocument) {
  if (!Array.isArray(memory.sharedWith)) {
    return [];
  }

  const unique = new Map<string, NormalizedMemoryShare>();

  memory.sharedWith.forEach((item) => {
    const normalized = normalizeMemoryShare(item);
    if (!normalized || unique.has(normalized.userId)) {
      return;
    }

    unique.set(normalized.userId, normalized);
  });

  return Array.from(unique.values()).sort((left, right) => left.username.localeCompare(right.username, "ru"));
}

export function getSharedUserIds(memory: MemoryDocument) {
  return normalizeSharedUsers(memory.sharedUserIds);
}

export function getSharedEditorIds(memory: MemoryDocument) {
  return normalizeSharedUsers(memory.sharedEditorIds);
}

export function getSharedCommenterIds(memory: MemoryDocument) {
  return normalizeSharedUsers(memory.sharedCommenterIds);
}

export function getMemoryShareForUser(
  memory: Pick<NormalizedMemory, "sharedWith">,
  userId: string
) {
  return memory.sharedWith.find((item) => item.userId === userId) ?? null;
}

export function normalizeMemoryShares(values: NormalizedMemoryShare[]) {
  const unique = new Map<string, NormalizedMemoryShare>();

  values.forEach((item) => {
    const userId = item.userId.trim();
    const username = item.username.trim();

    if (!userId || !username || unique.has(userId)) {
      return;
    }

    unique.set(userId, {
      userId,
      username,
      role: getMemoryShareRole(item.role),
      grantedAt: item.grantedAt instanceof Date ? item.grantedAt : null,
    });
  });

  return Array.from(unique.values()).sort((left, right) => left.username.localeCompare(right.username, "ru"));
}

export function buildMemoryAccessPayload(
  accessType: MemoryAccessType,
  sharedWith: NormalizedMemoryShare[]
) {
  const normalizedSharedWith = accessType === "shared"
    ? normalizeMemoryShares(sharedWith)
    : [];

  return {
    accessType,
    sharedWith: normalizedSharedWith.map((item) => ({
      userId: item.userId,
      username: item.username,
      role: item.role,
      grantedAt: item.grantedAt,
    })),
    sharedUserIds: normalizedSharedWith.map((item) => item.userId),
    sharedEditorIds: normalizedSharedWith
      .filter((item) => item.role === "edit")
      .map((item) => item.userId),
    sharedCommenterIds: normalizedSharedWith
      .filter((item) => item.role === "comment" || item.role === "edit")
      .map((item) => item.userId),
  };
}

export function validateSharedMemoryAccess(
  accessType: MemoryAccessType,
  sharedWith: NormalizedMemoryShare[]
) {
  if (accessType !== "shared") {
    return "";
  }

  return normalizeMemoryShares(sharedWith).length > 0
    ? ""
    : "Выберите хотя бы одного друга для совместного доступа";
}

export function canUserViewMemory(
  memory: Pick<NormalizedMemory, "accessType" | "sharedUserIds"> & { ownerId?: string },
  userId: string
) {
  if (!userId) {
    return false;
  }

  if (memory.ownerId === userId) {
    return true;
  }

  if (memory.accessType === "public") {
    return true;
  }

  return memory.accessType === "shared" && memory.sharedUserIds.includes(userId);
}

export function canUserEditMemory(
  memory: Pick<NormalizedMemory, "sharedWith"> & { ownerId?: string },
  userId: string
) {
  if (!userId) {
    return false;
  }

  if (memory.ownerId === userId) {
    return true;
  }

  const share = getMemoryShareForUser(memory, userId);
  return share?.role === "edit";
}

export function canUserCommentMemory(
  memory: Pick<NormalizedMemory, "accessType" | "sharedWith"> & { ownerId?: string },
  userId: string
) {
  if (!userId) {
    return false;
  }

  if (memory.accessType !== "shared") {
    return false;
  }

  if (memory.ownerId === userId) {
    return true;
  }

  const share = getMemoryShareForUser(memory, userId);
  return share?.role === "comment" || share?.role === "edit";
}

export function normalizeMemoryComment(id: string, comment: MemoryCommentDocument): NormalizedMemoryComment {
  return {
    id,
    authorId: typeof comment.authorId === "string" ? comment.authorId : "",
    authorUsername: typeof comment.authorUsername === "string" ? comment.authorUsername : "",
    authorAvatarDataUrl: typeof comment.authorAvatarDataUrl === "string" ? comment.authorAvatarDataUrl : "",
    text: typeof comment.text === "string" ? comment.text : "",
    createdAt: getDateValue(comment.createdAt),
  };
}

export function getAllTags(memory: Pick<NormalizedMemory, "emotionTags" | "placeTags" | "customTags">) {
  return [...memory.emotionTags, ...memory.placeTags, ...memory.customTags];
}

export function normalizeMemory(id: string, memory: MemoryDocument): NormalizedMemory {
  return {
    id,
    ownerId: typeof memory.ownerId === "string" ? memory.ownerId : "",
    ownerUsername: typeof memory.ownerUsername === "string" ? memory.ownerUsername : "",
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
    sharedWith: getSharedWith(memory),
    sharedUserIds: getSharedUserIds(memory),
    sharedEditorIds: getSharedEditorIds(memory),
    sharedCommenterIds: getSharedCommenterIds(memory),
    photos: Array.isArray(memory.photos)
      ? memory.photos.filter(
          (photo): photo is { name?: string; dataUrl?: string } =>
            typeof photo === "object" && photo !== null
        )
      : [],
  };
}
