export {
  createFriendRequestNotification,
  createMemoryOfDayNotification,
  createSharedMemoryNotification,
  markNotificationAsRead,
  markNotificationAsUnread,
  subscribeToNotifications,
} from "./api/notifications";
export {
  getNotificationType,
  normalizeNotification,
} from "./model/notification";
export type {
  NormalizedNotification,
  NotificationDocument,
  NotificationType,
} from "./model/notification";
