export type FriendRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export type FriendRequestDocument = {
  fromUserId?: unknown;
  toUserId?: unknown;
  fromUsername?: unknown;
  toUsername?: unknown;
  status?: unknown;
  createdAt?: unknown;
  respondedAt?: unknown;
};

export type FriendshipDocument = {
  userIds?: unknown;
  createdAt?: unknown;
};

export type FriendProfile = {
  id: string;
  username: string;
  usernameLower: string;
  description: string;
  avatarDataUrl: string;
};

export type NormalizedFriendRequest = {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUsername: string;
  toUsername: string;
  status: FriendRequestStatus;
  createdAt: Date | null;
  respondedAt: Date | null;
};

export type NormalizedFriendship = {
  id: string;
  userIds: [string, string] | [];
  createdAt: Date | null;
};

export function getFriendRequestStatus(value: unknown): FriendRequestStatus {
  return value === "accepted" || value === "declined" || value === "cancelled" ? value : "pending";
}

export function normalizeUserIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).sort();
}

export function normalizeFriendRequest(id: string, request: FriendRequestDocument): NormalizedFriendRequest {
  return {
    id,
    fromUserId: typeof request.fromUserId === "string" ? request.fromUserId : "",
    toUserId: typeof request.toUserId === "string" ? request.toUserId : "",
    fromUsername: typeof request.fromUsername === "string" ? request.fromUsername : "",
    toUsername: typeof request.toUsername === "string" ? request.toUsername : "",
    status: getFriendRequestStatus(request.status),
    createdAt: getDateValue(request.createdAt),
    respondedAt: getDateValue(request.respondedAt),
  };
}

export function normalizeFriendship(id: string, friendship: FriendshipDocument): NormalizedFriendship {
  const userIds = normalizeUserIds(friendship.userIds);

  return {
    id,
    userIds: userIds.length === 2 ? [userIds[0], userIds[1]] : [],
    createdAt: getDateValue(friendship.createdAt),
  };
}

export function buildFriendshipId(leftUserId: string, rightUserId: string) {
  return [leftUserId.trim(), rightUserId.trim()].sort().join("__");
}

export function getFriendId(friendship: Pick<NormalizedFriendship, "userIds">, currentUserId: string) {
  return friendship.userIds.find((userId) => userId !== currentUserId) ?? "";
}

function getDateValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }

  return value instanceof Date ? value : null;
}
