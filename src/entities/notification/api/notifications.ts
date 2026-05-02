import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { normalizeNotification, type NormalizedNotification, type NotificationDocument } from "../model/notification";

const NOTIFICATIONS_COLLECTION = "notifications";

type BaseNotificationParams = {
  userId: string;
};

type FriendRequestNotificationParams = BaseNotificationParams & {
  actorUserId: string;
  actorUsername: string;
  actorAvatarDataUrl: string;
  friendRequestId: string;
};

type SharedMemoryNotificationParams = BaseNotificationParams & {
  actorUserId: string;
  actorUsername: string;
  actorAvatarDataUrl: string;
  memoryId: string;
  memoryTitle: string;
  memoryDate: string;
  memoryPreview: string;
};

type MemoryOfDayNotificationParams = BaseNotificationParams & {
  memoryId: string;
  memoryTitle: string;
  memoryDate: string;
  memoryPreview: string;
};

export function subscribeToNotifications(
  userId: string,
  onChange: (items: NormalizedNotification[]) => void,
  onError: (error: unknown) => void
) {
  return onSnapshot(
    query(collection(db, NOTIFICATIONS_COLLECTION), where("userId", "==", userId)),
    (snapshot) => {
      const notifications = snapshot.docs
        .map((item) => normalizeNotification(item.id, item.data() as NotificationDocument))
        .sort(sortNotificationsDesc);

      onChange(notifications);
    },
    onError
  );
}

export async function markNotificationAsRead(notificationId: string) {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    isRead: true,
  });
}

export async function markNotificationAsUnread(notificationId: string) {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    isRead: false,
  });
}

export async function createFriendRequestNotification(params: FriendRequestNotificationParams) {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId: params.userId,
    type: "friend_request",
    isRead: false,
    createdAt: serverTimestamp(),
    actorUserId: params.actorUserId,
    actorUsername: params.actorUsername,
    actorAvatarDataUrl: params.actorAvatarDataUrl,
    friendRequestId: params.friendRequestId,
    memoryId: "",
    memoryTitle: "",
    memoryDate: "",
    memoryPreview: "",
  });
}

export async function createSharedMemoryNotification(params: SharedMemoryNotificationParams) {
  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId: params.userId,
    type: "shared_memory",
    isRead: false,
    createdAt: serverTimestamp(),
    actorUserId: params.actorUserId,
    actorUsername: params.actorUsername,
    actorAvatarDataUrl: params.actorAvatarDataUrl,
    friendRequestId: "",
    memoryId: params.memoryId,
    memoryTitle: params.memoryTitle,
    memoryDate: params.memoryDate,
    memoryPreview: params.memoryPreview,
  });
}

export async function createMemoryOfDayNotification(params: MemoryOfDayNotificationParams) {
  const existing = await getDocs(
    query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where("userId", "==", params.userId),
      where("type", "==", "memory_of_day"),
      where("memoryId", "==", params.memoryId)
    )
  );

  if (existing.docs.some((item) => isSameDay(item.data() as NotificationDocument))) {
    return;
  }

  await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    userId: params.userId,
    type: "memory_of_day",
    isRead: false,
    createdAt: serverTimestamp(),
    actorUserId: "",
    actorUsername: "",
    actorAvatarDataUrl: "",
    friendRequestId: "",
    memoryId: params.memoryId,
    memoryTitle: params.memoryTitle,
    memoryDate: params.memoryDate,
    memoryPreview: params.memoryPreview,
  });
}

function isSameDay(value: NotificationDocument) {
  const createdAt = normalizeNotification("", value).createdAt;
  if (!createdAt) {
    return false;
  }

  const now = new Date();
  return (
    createdAt.getFullYear() === now.getFullYear()
    && createdAt.getMonth() === now.getMonth()
    && createdAt.getDate() === now.getDate()
  );
}

function sortNotificationsDesc(left: NormalizedNotification, right: NormalizedNotification) {
  return (right.createdAt?.getTime() ?? 0) - (left.createdAt?.getTime() ?? 0);
}
