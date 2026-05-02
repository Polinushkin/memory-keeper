import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import {
  getOwnedMemoriesForStatistics,
  buildMemoryStatistics,
  getMemoryOfDayCandidate,
  getWeekdayLabels,
  type AccessDistributionItem,
  type EmotionWeekdayRow,
  type MemoryStatistics,
  type NamedCount,
} from "../../entities/statistics";
import {
  createMemoryOfDayNotification,
  markNotificationAsRead,
  markNotificationAsUnread,
  subscribeToNotifications,
  type NormalizedNotification,
} from "../../entities/notification";
import {
  getUserReminderSettings,
  updateDailyRemindersEnabled,
  updateLastDailyReminderDate,
} from "../../entities/user";
import {
  getFriendRequestById,
  respondToFriendRequest,
  type FriendRequestStatus,
} from "../../entities/friend";
import UpdateProfileForm from "../../features/update-profile/ui/UpdateProfileForm";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

const DAILY_REMINDER_HOUR = 9;
const EMPTY_STATISTICS: MemoryStatistics = {
  monthCount: 0,
  yearCount: 0,
  totalCount: 0,
  byWeekday: [],
  byMonth: [],
  popularTags: [],
  popularPlaces: [],
  accessDistribution: [],
  emotionWeekdayMap: [],
  topCollaborators: [],
};

type FriendRequestStatusMap = Record<string, FriendRequestStatus>;

export default function ProfileDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NormalizedNotification[]>([]);
  const [sessionUnreadIds, setSessionUnreadIds] = useState<Set<string>>(new Set());
  const [friendRequestStatuses, setFriendRequestStatuses] = useState<FriendRequestStatusMap>({});
  const [statistics, setStatistics] = useState<MemoryStatistics>(EMPTY_STATISTICS);
  const [ownedMemories, setOwnedMemories] = useState<Awaited<ReturnType<typeof getOwnedMemoriesForStatistics>>>([]);
  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState(false);
  const [lastDailyReminderDate, setLastDailyReminderDate] = useState("");
  const [showOldNotifications, setShowOldNotifications] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToNotifications(
      user.uid,
      (items) => {
        setNotifications(items);
        setSessionUnreadIds((prev) => {
          const next = new Set(prev);
          items
            .filter((item) => !item.isRead)
            .forEach((item) => next.add(item.id));
          return next;
        });
      },
      (loadError) => setError(getErrorMessage(loadError, "Не удалось загрузить уведомления"))
    );

    void Promise.all([
      getOwnedMemoriesForStatistics(user.uid),
      getUserReminderSettings(user.uid),
    ])
      .then(([memories, settings]) => {
        setOwnedMemories(memories);
        setStatistics(buildMemoryStatistics(memories));
        setDailyRemindersEnabled(settings.dailyRemindersEnabled);
        setLastDailyReminderDate(settings.lastDailyReminderDate);
      })
      .catch((loadError: unknown) => {
        setError(getErrorMessage(loadError, "Не удалось загрузить данные профиля"));
      })
      .finally(() => {
        setLoading(false);
      });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const requestIds = Array.from(
      new Set(
        notifications
          .filter((item) => item.type === "friend_request" && item.friendRequestId)
          .map((item) => item.friendRequestId)
      )
    );

    if (requestIds.length === 0) {
      setFriendRequestStatuses({});
      return;
    }

    let isCancelled = false;

    void Promise.all(
      requestIds.map(async (requestId) => {
        const request = await getFriendRequestById(requestId);
        return [requestId, request?.status ?? "cancelled"] as const;
      })
    ).then((entries) => {
      if (!isCancelled) {
        setFriendRequestStatuses(Object.fromEntries(entries));
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [notifications]);

  useEffect(() => {
    if (!user || !dailyRemindersEnabled || loading) {
      return;
    }

    const todayKey = getDateKey(new Date());
    if (lastDailyReminderDate === todayKey || new Date().getHours() < DAILY_REMINDER_HOUR) {
      return;
    }

    const memoryOfDay = getMemoryOfDayCandidate(ownedMemories);
    if (!memoryOfDay) {
      return;
    }

    void createMemoryOfDayNotification({
      userId: user.uid,
      memoryId: memoryOfDay.id,
      memoryTitle: memoryOfDay.title,
      memoryDate: memoryOfDay.date,
      memoryPreview: getNotificationPreview(memoryOfDay.text, memoryOfDay.place),
    })
      .then(async () => {
        await updateLastDailyReminderDate(user.uid, todayKey);
        setLastDailyReminderDate(todayKey);
      })
      .catch(() => {
        // keep profile usable
      });
  }, [dailyRemindersEnabled, lastDailyReminderDate, loading, ownedMemories, user]);

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => sessionUnreadIds.has(item.id)),
    [notifications, sessionUnreadIds]
  );
  const oldNotifications = useMemo(
    () => notifications.filter((item) => !sessionUnreadIds.has(item.id)),
    [notifications, sessionUnreadIds]
  );
  const unreadMemoryOfDay = useMemo(
    () => unreadNotifications.find((item) => item.type === "memory_of_day") ?? null,
    [unreadNotifications]
  );
  const unreadListNotifications = useMemo(
    () => unreadNotifications.filter((item) => item.id !== unreadMemoryOfDay?.id),
    [unreadMemoryOfDay?.id, unreadNotifications]
  );

  async function handleToggleDailyReminders() {
    if (!user) {
      return;
    }

    const nextValue = !dailyRemindersEnabled;
    setBusyKey("daily-reminders");
    setError(null);

    try {
      await updateDailyRemindersEnabled(user.uid, nextValue);
      setDailyRemindersEnabled(nextValue);
    } catch (toggleError: unknown) {
      setError(getErrorMessage(toggleError, "Не удалось обновить ежедневные напоминания"));
    } finally {
      setBusyKey("");
    }
  }

  async function handleMarkAsRead(notificationId: string) {
    setBusyKey(`read-${notificationId}`);
    setError(null);

    try {
      await markNotificationAsRead(notificationId);
      setSessionUnreadIds((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, "Не удалось отметить уведомление как прочитанное"));
    } finally {
      setBusyKey("");
    }
  }

  async function handleMarkAsUnread(notificationId: string) {
    setBusyKey(`unread-${notificationId}`);
    setError(null);

    try {
      await markNotificationAsUnread(notificationId);
      setSessionUnreadIds((prev) => new Set(prev).add(notificationId));
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, "Не удалось пометить уведомление как непрочитанное"));
    } finally {
      setBusyKey("");
    }
  }

  async function handleOpenNotification(notification: NormalizedNotification) {
    if (!notification.memoryId) {
      return;
    }

    await handleMarkAsRead(notification.id);
    navigate(`/memories/${notification.memoryId}?returnTo=${encodeURIComponent("/profile")}`);
  }

  async function handleFriendRequestAction(notification: NormalizedNotification, action: "accept" | "decline") {
    if (!user || !notification.friendRequestId) {
      return;
    }

    setBusyKey(`${action}-${notification.id}`);
    setError(null);

    try {
      await respondToFriendRequest({
        requestId: notification.friendRequestId,
        currentUserId: user.uid,
        action,
      });
      await markNotificationAsRead(notification.id);

      setFriendRequestStatuses((prev) => ({
        ...prev,
        [notification.friendRequestId]: action === "accept" ? "accepted" : "declined",
      }));
    } catch (actionError: unknown) {
      setError(getErrorMessage(actionError, action === "accept" ? "Не удалось принять заявку" : "Не удалось отклонить заявку"));
    } finally {
      setBusyKey("");
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div className="profileDashboard">
      <section className="card sectionCard">
        <div className="sectionHeader">
          <div className="sectionTitle">Уведомления</div>
          <button
            className={`toggleButton ${dailyRemindersEnabled ? "toggleButtonActive" : ""}`}
            type="button"
            onClick={() => void handleToggleDailyReminders()}
            disabled={busyKey === "daily-reminders"}
          >
            {busyKey === "daily-reminders"
              ? "..."
              : dailyRemindersEnabled
                ? "Ежедневные напоминания включены"
                : "Ежедневные напоминания выключены"}
          </button>
        </div>

        {unreadMemoryOfDay && (
          <div className="memoryOfDayCard">
            <div className="memoryOfDayGlow" />
            <div className="memoryOfDayContent">
              <div className="memoryOfDayLabel">Воспоминание дня</div>
              <div className="memoryOfDayTitle">{unreadMemoryOfDay.memoryTitle || "Без названия"}</div>
              <div className="memoryOfDayMeta">{formatMemoryDate(unreadMemoryOfDay.memoryDate)}</div>
              <div className="searchResultPreview">{unreadMemoryOfDay.memoryPreview || "Превью недоступно"}</div>
            </div>
            <div className="notificationActionColumn">
              <button
                className="btnSmall notificationActionButton"
                type="button"
                onClick={() => void handleOpenNotification(unreadMemoryOfDay)}
              >
                Открыть
              </button>
              <button
                className="btnSecondary notificationActionButton"
                type="button"
                onClick={() => void handleMarkAsRead(unreadMemoryOfDay.id)}
                disabled={busyKey === `read-${unreadMemoryOfDay.id}`}
              >
                Прочитано
              </button>
            </div>
          </div>
        )}

        {unreadListNotifications.length > 0 ? (
          <div className="notificationsList">
            {unreadListNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                busyKey={busyKey}
                friendRequestStatus={notification.friendRequestId ? friendRequestStatuses[notification.friendRequestId] : undefined}
                onAccept={() => void handleFriendRequestAction(notification, "accept")}
                onDecline={() => void handleFriendRequestAction(notification, "decline")}
                onOpen={() => void handleOpenNotification(notification)}
                onRead={() => void handleMarkAsRead(notification.id)}
              />
            ))}
          </div>
        ) : !unreadMemoryOfDay ? (
          <div className="emptyState">У вас нет непрочитанных уведомлений.</div>
        ) : null}

        {oldNotifications.length > 0 && (
          <div className="oldNotificationsSection">
            <button
              className="btnSecondary oldNotificationsButton"
              type="button"
              onClick={() => setShowOldNotifications((value) => !value)}
            >
              {showOldNotifications
                ? "Скрыть старые уведомления"
                : `Прочитать старые уведомления (${oldNotifications.length})`}
            </button>

            {showOldNotifications && (
              <div className="notificationsList">
                {oldNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    busyKey={busyKey}
                    friendRequestStatus={notification.friendRequestId ? friendRequestStatuses[notification.friendRequestId] : undefined}
                    onAccept={() => void handleFriendRequestAction(notification, "accept")}
                    onDecline={() => void handleFriendRequestAction(notification, "decline")}
                    onOpen={() => void handleOpenNotification(notification)}
                    onRead={() => void handleMarkAsRead(notification.id)}
                    onUnread={() => void handleMarkAsUnread(notification.id)}
                    isOld
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="card sectionCard">
        <UpdateProfileForm />
      </section>

      <section className="card sectionCard">
        <div className="sectionHeader">
          <div className="sectionTitle">Статистика</div>
        </div>

        <div className="sectionText">Количество воспоминаний:</div>
        <div className="statsSummaryGrid">
          <StatCard label="За последний месяц" value={statistics.monthCount} />
          <StatCard label="За последний год" value={statistics.yearCount} />
          <StatCard label="За всё время" value={statistics.totalCount} />
        </div>

        <div className="statsChartsGrid">
          <SimpleBarChart title="По дням недели" items={statistics.byWeekday} />
          <SimpleBarChart title="По месяцам" items={statistics.byMonth} />
        </div>

        <div className="statsChartsGrid">
          <TopList title="Популярные теги" items={statistics.popularTags} emptyText="Тегов пока нет." />
          <TopList title="Популярные места" items={statistics.popularPlaces} emptyText="Места пока не указаны." />
        </div>

        <div className="statsChartsGrid">
          <PieChartCard title="Доля приватных / shared / публичных" items={statistics.accessDistribution} />
          <EmotionHeatmap title="Карта эмоций: какие эмоции чаще в какие дни недели" rows={statistics.emotionWeekdayMap} />
        </div>

        {statistics.topCollaborators.length > 0 && (
          <div className="statsChartsGrid">
            <TopList title="Самые частые соавторы в shared-memory" items={statistics.topCollaborators} emptyText="" />
          </div>
        )}
      </section>

      {error && (
        <section className="card sectionCard">
          <div className="error">{error}</div>
        </section>
      )}
    </div>
  );
}

type NotificationCardProps = {
  notification: NormalizedNotification;
  busyKey: string;
  friendRequestStatus?: FriendRequestStatus;
  onAccept: () => void;
  onDecline: () => void;
  onOpen: () => void;
  onRead: () => void;
  onUnread?: () => void;
  isOld?: boolean;
};

function NotificationCard({
  notification,
  busyKey,
  friendRequestStatus,
  onAccept,
  onDecline,
  onOpen,
  onRead,
  onUnread,
  isOld = false,
}: NotificationCardProps) {
  const status = friendRequestStatus ?? (notification.type === "friend_request" ? "pending" : undefined);
  const canOpenMemory = (notification.type === "shared_memory" || notification.type === "memory_of_day") && notification.memoryId;
  const showFriendActions = notification.type === "friend_request" && status === "pending";

  return (
    <article className={`notificationCard ${isOld || notification.isRead ? "notificationCardRead" : ""}`}>
      <div className="searchUserIdentity">
        {notification.actorAvatarDataUrl ? (
          <img className="searchUserAvatar" src={notification.actorAvatarDataUrl} alt={notification.actorUsername} />
        ) : (
          <div className="searchUserAvatarPlaceholder">
            {(notification.actorUsername || notification.memoryTitle || "M").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="searchResultBody">
          <div className="searchResultTitle">{getNotificationTitle(notification)}</div>
          <div className="searchResultPreview">{getNotificationDescription(notification, status)}</div>
          <div className="searchResultMeta">
            <span>{formatDateTime(notification.createdAt)}</span>
            {!notification.isRead && <span>Новое</span>}
          </div>
        </div>
      </div>

      <div className="notificationActionColumn">
        {showFriendActions ? (
          <>
            <button
              className="btnSmall notificationActionButton"
              type="button"
              onClick={onAccept}
              disabled={busyKey === `accept-${notification.id}`}
            >
              {busyKey === `accept-${notification.id}` ? "..." : "Принять"}
            </button>
            <button
              className="btnSmallDanger notificationActionButton"
              type="button"
              onClick={onDecline}
              disabled={busyKey === `decline-${notification.id}`}
            >
              {busyKey === `decline-${notification.id}` ? "..." : "Отклонить"}
            </button>
          </>
        ) : (
          <>
            {notification.type === "friend_request" && status && (
              <div className={`friendStateBadge ${getFriendRequestBadgeClass(status)}`}>
                {getFriendRequestStatusText(status)}
              </div>
            )}

            {canOpenMemory ? (
              <button className="btnSmall notificationActionButton" type="button" onClick={onOpen}>
                Открыть
              </button>
            ) : notification.type !== "friend_request" ? (
              <div className="notificationActionSpacer" />
            ) : null}

            {!isOld && !notification.isRead && (
              <button
                className="btnSecondary notificationActionButton"
                type="button"
                onClick={onRead}
                disabled={busyKey === `read-${notification.id}`}
              >
                Прочитано
              </button>
            )}

            {isOld && onUnread && (
              <button
                className="notificationUnreadButton"
                type="button"
                title="Пометить непрочитанным"
                aria-label="Пометить непрочитанным"
                onClick={onUnread}
                disabled={busyKey === `unread-${notification.id}`}
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="statCard">
      <div className="statCardValue">{value}</div>
      <div className="statCardLabel">{label}</div>
    </div>
  );
}

function SimpleBarChart({ title, items }: { title: string; items: NamedCount[] }) {
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="statsChartCard">
      <div className="searchResultsTitle">{title}</div>
      <div className="barChartList">
        {items.map((item) => (
          <div className="barChartRow" key={item.label}>
            <div className="barChartLabel">{item.label}</div>
            <div className="barChartTrack">
              <div className="barChartFill" style={{ width: `${(item.count / maxValue) * 100}%` }} />
            </div>
            <div className="barChartValue">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopList({ title, items, emptyText }: { title: string; items: NamedCount[]; emptyText: string }) {
  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="statsChartCard">
      <div className="searchResultsTitle">{title}</div>
      {items.length > 0 ? (
        <div className="barChartList">
          {items.map((item) => (
            <div className="barChartRow" key={item.label}>
              <div className="barChartLabel">{item.label}</div>
              <div className="barChartTrack">
                <div className="barChartFill barChartFillSecondary" style={{ width: `${(item.count / maxValue) * 100}%` }} />
              </div>
              <div className="barChartValue">{item.count}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState">{emptyText}</div>
      )}
    </div>
  );
}

function PieChartCard({ title, items }: { title: string; items: AccessDistributionItem[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const colors = ["#ff4d6d", "#f59e0b", "#0ea5a4"];

  let currentAngle = -90;
  const segments = items.map((item, index) => {
    const percentage = total > 0 ? item.count / total : 0;
    const angle = percentage * 360;
    const path = describeArc(60, 60, 44, currentAngle, currentAngle + angle);
    currentAngle += angle;

    return {
      ...item,
      color: colors[index],
      path,
      percentage: Math.round(percentage * 100),
    };
  });

  return (
    <div className="statsChartCard">
      <div className="searchResultsTitle">{title}</div>
      <div className="pieChartLayout">
        <svg className="pieChart" viewBox="0 0 120 120" aria-hidden="true">
          {segments.map((segment) => (
            segment.count > 0
              ? <path key={segment.type} d={segment.path} fill="none" stroke={segment.color} strokeWidth="18" strokeLinecap="round" />
              : null
          ))}
        </svg>
        <div className="pieLegend">
          {segments.map((segment) => (
            <div className="pieLegendItem" key={segment.type}>
              <span className="pieLegendDot" style={{ backgroundColor: segment.color }} />
              <span>{segment.label}</span>
              <span>{segment.count}</span>
              <span>{segment.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmotionHeatmap({ title, rows }: { title: string; rows: EmotionWeekdayRow[] }) {
  const weekdayLabels = getWeekdayLabels();
  const maxValue = Math.max(...rows.flatMap((row) => row.weekdays), 1);

  return (
    <div className="statsChartCard">
      <div className="searchResultsTitle">{title}</div>
      {rows.length > 0 ? (
        <div className="emotionHeatmap">
          <div className="emotionHeatmapHeader">
            <span />
            {weekdayLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          {rows.map((row) => (
            <div className="emotionHeatmapRow" key={row.emotion}>
              <span className="emotionHeatmapLabel">{row.emotion}</span>
              {row.weekdays.map((value, index) => (
                <div
                  className="emotionHeatmapCell"
                  key={`${row.emotion}-${index}`}
                  style={{ opacity: value > 0 ? 0.2 + value / maxValue : 0.08 }}
                  title={`${row.emotion}: ${weekdayLabels[index]} — ${value}`}
                >
                  {value > 0 ? value : ""}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState">Эмоций для карты пока недостаточно.</div>
      )}
    </div>
  );
}

function getNotificationTitle(notification: NormalizedNotification) {
  if (notification.type === "friend_request") {
    return "Заявка в друзья";
  }

  if (notification.type === "shared_memory") {
    return "Доступно shared-memory";
  }

  return "Воспоминание дня";
}

function getNotificationDescription(
  notification: NormalizedNotification,
  friendRequestStatus?: FriendRequestStatus
) {
  if (notification.type === "friend_request") {
    if (friendRequestStatus === "accepted") {
      return notification.actorUsername
        ? `Вы добавили @${notification.actorUsername} в друзья.`
        : "Пользователь добавлен в друзья.";
    }

    if (friendRequestStatus === "declined") {
      return "Заявка в друзья была отклонена.";
    }

    if (friendRequestStatus === "cancelled") {
      return "Отправитель отозвал заявку в друзья.";
    }

    return notification.actorUsername
      ? `@${notification.actorUsername} отправил(а) вам заявку в друзья.`
      : "Получена новая заявка в друзья.";
  }

  if (notification.type === "shared_memory") {
    return `${notification.memoryTitle || "Совместное воспоминание"} теперь доступно вам.`;
  }

  return `${notification.memoryTitle || "Воспоминание"}: ${notification.memoryPreview || "Откройте карточку, чтобы посмотреть детали."}`;
}

function getFriendRequestStatusText(status: FriendRequestStatus) {
  if (status === "accepted") {
    return "Уже в друзьях";
  }

  if (status === "declined") {
    return "Отклонено";
  }

  if (status === "cancelled") {
    return "Заявка отозвана";
  }

  return "Ожидает ответа";
}

function getFriendRequestBadgeClass(status: FriendRequestStatus) {
  if (status === "accepted") {
    return "friendStateBadgeSuccess";
  }

  if (status === "declined" || status === "cancelled") {
    return "friendStateBadgeMuted";
  }

  return "friendStateBadgeAccent";
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "только что";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatMemoryDate(value: string) {
  if (!value) {
    return "Дата не указана";
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}.${month}.${year}`;
}

function getDateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function getNotificationPreview(text: string, place: string) {
  const normalizedText = text.trim();
  if (normalizedText) {
    return normalizedText.slice(0, 120);
  }

  if (place.trim()) {
    return `Место: ${place.trim()}`;
  }

  return "Откройте воспоминание, чтобы увидеть подробности.";
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(" ");
}
