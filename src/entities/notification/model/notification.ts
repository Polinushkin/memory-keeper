export type NotificationType = "friend_request" | "shared_memory" | "memory_of_day";

export type NotificationDocument = {
  userId?: unknown;
  type?: unknown;
  isRead?: unknown;
  createdAt?: unknown;
  actorUserId?: unknown;
  actorUsername?: unknown;
  actorAvatarDataUrl?: unknown;
  friendRequestId?: unknown;
  memoryId?: unknown;
  memoryTitle?: unknown;
  memoryDate?: unknown;
  memoryPreview?: unknown;
};

export type NormalizedNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date | null;
  actorUserId: string;
  actorUsername: string;
  actorAvatarDataUrl: string;
  friendRequestId: string;
  memoryId: string;
  memoryTitle: string;
  memoryDate: string;
  memoryPreview: string;
};

export function getNotificationType(value: unknown): NotificationType {
  return value === "shared_memory" || value === "memory_of_day" ? value : "friend_request";
}

export function normalizeNotification(id: string, value: NotificationDocument): NormalizedNotification {
  return {
    id,
    userId: typeof value.userId === "string" ? value.userId : "",
    type: getNotificationType(value.type),
    isRead: value.isRead === true,
    createdAt: getDateValue(value.createdAt),
    actorUserId: typeof value.actorUserId === "string" ? value.actorUserId : "",
    actorUsername: typeof value.actorUsername === "string" ? value.actorUsername : "",
    actorAvatarDataUrl: typeof value.actorAvatarDataUrl === "string" ? value.actorAvatarDataUrl : "",
    friendRequestId: typeof value.friendRequestId === "string" ? value.friendRequestId : "",
    memoryId: typeof value.memoryId === "string" ? value.memoryId : "",
    memoryTitle: typeof value.memoryTitle === "string" ? value.memoryTitle : "",
    memoryDate: typeof value.memoryDate === "string" ? value.memoryDate : "",
    memoryPreview: typeof value.memoryPreview === "string" ? value.memoryPreview : "",
  };
}

function getDateValue(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate() as Date;
  }

  return value instanceof Date ? value : null;
}
