import { useEffect, useMemo, useState } from "react";
import {
  cancelFriendRequest,
  getFriendProfiles,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  type FriendProfile,
  type NormalizedFriendRequest,
} from "../../entities/friend";
import { getUserProfileById, searchUsersByUsername, type UserSearchResult } from "../../entities/user";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

type SearchStateMap = Record<string, "none" | "incoming" | "outgoing" | "friends">;
type CurrentProfile = {
  id: string;
  username: string;
};

export default function FriendsManager() {
  const { user } = useAuth();
  const [currentProfile, setCurrentProfile] = useState<CurrentProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchStates, setSearchStates] = useState<SearchStateMap>({});
  const [incomingRequests, setIncomingRequests] = useState<NormalizedFriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<NormalizedFriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadDashboard(user.uid);
  }, [user]);

  async function loadDashboard(userId: string) {
    setLoading(true);
    setError(null);

    try {
      const [profile, incoming, outgoing, nextFriends] = await Promise.all([
        getUserProfileById(userId),
        getIncomingFriendRequests(userId),
        getOutgoingFriendRequests(userId),
        getFriendProfiles(userId),
      ]);

      setCurrentProfile(
        profile
          ? { id: profile.id, username: profile.username }
          : {
              id: userId,
              username: getFallbackUsername(user?.email, userId),
            }
      );
      setIncomingRequests(incoming.filter((item) => item.status === "pending"));
      setOutgoingRequests(outgoing.filter((item) => item.status === "pending"));
      setFriends(nextFriends);
    } catch (loadError: unknown) {
      setError(getFriendsErrorMessage(loadError, "Не удалось загрузить данные о друзьях"));
    } finally {
      setLoading(false);
    }
  }

  function refreshSearchStates(results: UserSearchResult[]) {
    if (results.length === 0) {
      setSearchStates({});
      return;
    }

    const incomingByUserId = new Set(incomingRequests.map((item) => item.fromUserId));
    const outgoingByUserId = new Set(outgoingRequests.map((item) => item.toUserId));
    const friendsByUserId = new Set(friends.map((item) => item.id));

    const entries = results.map((item) => {
      if (friendsByUserId.has(item.id)) {
        return [item.id, "friends"] as const;
      }

      if (incomingByUserId.has(item.id)) {
        return [item.id, "incoming"] as const;
      }

      if (outgoingByUserId.has(item.id)) {
        return [item.id, "outgoing"] as const;
      }

      return [item.id, "none"] as const;
    });

    setSearchStates(Object.fromEntries(entries));
  }

  async function handleSearch() {
    const normalizedQuery = searchQuery.trim();
    if (!user || !normalizedQuery) {
      setSearchResults([]);
      setSearchStates({});
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const results = await searchUsersByUsername(normalizedQuery, user.uid);
      setSearchResults(results);
      refreshSearchStates(results);
    } catch (searchError: unknown) {
      setSearchResults([]);
      setSearchStates({});
      setError(getFriendsErrorMessage(searchError, "Не удалось выполнить поиск пользователей"));
    } finally {
      setSearching(false);
    }
  }

  async function reloadAfterAction() {
    if (!user) {
      return;
    }

    await loadDashboard(user.uid);
    if (searchResults.length > 0) {
      refreshSearchStates(searchResults);
    }
  }

  async function handleSendRequest(target: UserSearchResult) {
    if (!user) {
      setError("Не удалось определить текущего пользователя");
      return;
    }

    setBusyKey(`send-${target.id}`);
    setError(null);

    try {
      await sendFriendRequest({
        fromUserId: user.uid,
        toUserId: target.id,
        fromUsername: currentProfile?.username || getFallbackUsername(user.email, user.uid),
        toUsername: target.username,
      });
      await reloadAfterAction();
    } catch (actionError: unknown) {
      if (actionError instanceof Error && actionError.message === "FRIEND_REQUEST_ALREADY_EXISTS") {
        await reloadAfterAction();
      }
      setError(getFriendsErrorMessage(actionError, "Не удалось отправить заявку в друзья"));
    } finally {
      setBusyKey("");
    }
  }

  async function handleCancelRequest(requestId: string) {
    if (!user) {
      return;
    }

    setBusyKey(`cancel-${requestId}`);
    setError(null);

    try {
      await cancelFriendRequest(requestId, user.uid);
      await reloadAfterAction();
    } catch (actionError: unknown) {
      setError(getFriendsErrorMessage(actionError, "Не удалось отозвать заявку"));
    } finally {
      setBusyKey("");
    }
  }

  async function handleRespond(requestId: string, action: "accept" | "decline") {
    if (!user) {
      return;
    }

    setBusyKey(`${action}-${requestId}`);
    setError(null);

    try {
      await respondToFriendRequest({
        requestId,
        currentUserId: user.uid,
        action,
      });
      await reloadAfterAction();
    } catch (actionError: unknown) {
      setError(
        getFriendsErrorMessage(
          actionError,
          action === "accept" ? "Не удалось принять заявку" : "Не удалось отклонить заявку"
        )
      );
    } finally {
      setBusyKey("");
    }
  }

  async function handleRemoveFriend(friendId: string) {
    if (!user) {
      return;
    }

    const confirmed = window.confirm("Удалить пользователя из списка друзей?");
    if (!confirmed) {
      return;
    }

    setBusyKey(`remove-${friendId}`);
    setError(null);

    try {
      await removeFriend(user.uid, friendId);
      await reloadAfterAction();
    } catch (actionError: unknown) {
      setError(getFriendsErrorMessage(actionError, "Не удалось удалить друга"));
    } finally {
      setBusyKey("");
    }
  }

  const friendsById = useMemo(() => new Set(friends.map((item) => item.id)), [friends]);

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div className="friendsLayout">
      <section className="card sectionCard">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">Поиск пользователей</div>
            <div className="sectionText">
              Ищите пользователей по username, отправляйте заявки в друзья и отслеживайте текущий статус связи.
            </div>
          </div>
        </div>

        <div className="searchPanelRow">
          <div className="field searchPanelField">
            <input
              className="input"
              placeholder="Например, anna"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSearch();
                }
              }}
            />
          </div>
          <button className="btnPrimary" type="button" onClick={() => void handleSearch()} disabled={searching}>
            {searching ? "Ищем..." : "Искать"}
          </button>
          <button
            className="btnSecondary"
            type="button"
            onClick={() => {
              setSearchQuery("");
              setSearchResults([]);
              setSearchStates({});
            }}
          >
            Сбросить
          </button>
        </div>

        {searchResults.length > 0 ? (
          <div className="searchResultsList">
            {searchResults.map((item) => {
              const state = friendsById.has(item.id) ? "friends" : (searchStates[item.id] ?? "none");

              return (
                <div className="searchResultItem" key={item.id}>
                  <div className="searchUserIdentity">
                    {item.avatarDataUrl ? (
                      <img className="searchUserAvatar" src={item.avatarDataUrl} alt={item.username} />
                    ) : (
                      <div className="searchUserAvatarPlaceholder">{item.username.slice(0, 1).toUpperCase()}</div>
                    )}
                    <div className="searchResultBody">
                      <div className="searchResultTitle">@{item.username}</div>
                      <div className="searchResultPreview">{getSearchPreviewText(item.description)}</div>
                    </div>
                  </div>

                  <div className="friendActionGroup">
                    {state === "none" && (
                      <button
                        className="btnSmall"
                        type="button"
                        onClick={() => void handleSendRequest(item)}
                        disabled={busyKey === `send-${item.id}`}
                      >
                        {busyKey === `send-${item.id}` ? "..." : "Добавить в друзья"}
                      </button>
                    )}
                    {state === "outgoing" && <span className="friendStateBadge">Заявка отправлена</span>}
                    {state === "incoming" && <span className="friendStateBadge friendStateBadgeAccent">Есть входящая заявка</span>}
                    {state === "friends" && <span className="friendStateBadge friendStateBadgeSuccess">Уже в друзьях</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : searchQuery.trim() && !searching ? (
          <div className="emptyState">По этому запросу пользователи не найдены.</div>
        ) : null}
      </section>

      {error && (
        <section className="card sectionCard">
          <div className="error">{error}</div>
        </section>
      )}

      <div className="friendsGrid">
        <section className="card sectionCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Входящие заявки</div>
              <div className="sectionText">Здесь отображаются пользователи, которые хотят добавить вас в друзья.</div>
            </div>
          </div>

          {incomingRequests.length > 0 ? (
            <div className="friendList">
              {incomingRequests.map((request) => (
                <div className="friendCard" key={request.id}>
                  <div className="friendCardBody">
                    <div className="friendCardTitle">@{request.fromUsername}</div>
                    <div className="friendCardMeta">Отправлено: {formatDateTime(request.createdAt)}</div>
                  </div>
                  <div className="friendActionGroup">
                    <button
                      className="btnSmall"
                      type="button"
                      onClick={() => void handleRespond(request.id, "accept")}
                      disabled={busyKey === `accept-${request.id}`}
                    >
                      {busyKey === `accept-${request.id}` ? "..." : "Принять"}
                    </button>
                    <button
                      className="btnSmallDanger"
                      type="button"
                      onClick={() => void handleRespond(request.id, "decline")}
                      disabled={busyKey === `decline-${request.id}`}
                    >
                      {busyKey === `decline-${request.id}` ? "..." : "Отклонить"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState">Новых заявок в друзья пока нет.</div>
          )}
        </section>

        <section className="card sectionCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Исходящие заявки</div>
              <div className="sectionText">Список пользователей, которым вы уже отправили запрос.</div>
            </div>
          </div>

          {outgoingRequests.length > 0 ? (
            <div className="friendList">
              {outgoingRequests.map((request) => (
                <div className="friendCard" key={request.id}>
                  <div className="friendCardBody">
                    <div className="friendCardTitle">@{request.toUsername}</div>
                    <div className="friendCardMeta">Отправлено: {formatDateTime(request.createdAt)}</div>
                  </div>
                  <div className="friendActionGroup">
                    <button
                      className="btnSmallDanger"
                      type="button"
                      onClick={() => void handleCancelRequest(request.id)}
                      disabled={busyKey === `cancel-${request.id}`}
                    >
                      {busyKey === `cancel-${request.id}` ? "..." : "Отозвать"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="emptyState">У вас нет активных исходящих заявок.</div>
          )}
        </section>
      </div>

      <section className="card sectionCard">
        <div className="sectionHeader">
          <div>
            <div className="sectionTitle">Мои друзья</div>
            <div className="sectionText">Этот список будет использоваться дальше при настройке совместного доступа к воспоминаниям.</div>
          </div>
        </div>

        {friends.length > 0 ? (
          <div className="friendList">
            {friends.map((friend) => (
              <div className="friendCard" key={friend.id}>
                <div className="searchUserIdentity">
                  {friend.avatarDataUrl ? (
                    <img className="searchUserAvatar" src={friend.avatarDataUrl} alt={friend.username} />
                  ) : (
                    <div className="searchUserAvatarPlaceholder">{friend.username.slice(0, 1).toUpperCase()}</div>
                  )}
                  <div className="friendCardBody">
                    <div className="friendCardTitle">@{friend.username}</div>
                    <div className="searchResultPreview">{getSearchPreviewText(friend.description, "Друг добавлен")}</div>
                  </div>
                </div>
                <div className="friendActionGroup">
                  <button
                    className="btnSmallDanger"
                    type="button"
                    onClick={() => void handleRemoveFriend(friend.id)}
                    disabled={busyKey === `remove-${friend.id}`}
                  >
                    {busyKey === `remove-${friend.id}` ? "..." : "Удалить"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState">Список друзей пока пуст. Найдите пользователя и отправьте первую заявку.</div>
        )}
      </section>
    </div>
  );
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

function getFriendsErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) {
    switch (error.message) {
      case "permission-denied":
      case "firestore/permission-denied":
        return "Для раздела друзей еще не настроены правила доступа Firestore";
      case "FRIEND_REQUEST_SELF":
        return "Нельзя отправить заявку самому себе";
      case "FRIEND_ALREADY_EXISTS":
        return "Этот пользователь уже находится у вас в друзьях";
      case "FRIEND_REQUEST_ALREADY_EXISTS":
        return "Между этими пользователями уже есть активная заявка";
      case "FRIEND_REQUEST_NOT_FOUND":
        return "Заявка не найдена";
      case "FRIEND_REQUEST_NOT_PENDING":
        return "Эта заявка уже не активна";
      case "FRIENDSHIP_NOT_FOUND":
        return "Связь дружбы уже была удалена";
      default:
        break;
    }
  }

  return getErrorMessage(error, fallback);
}

function getFallbackUsername(email: string | null | undefined, userId: string) {
  const emailPrefix = String(email ?? "").split("@")[0]?.trim();
  if (emailPrefix) {
    return emailPrefix;
  }

  return `user_${userId.slice(0, 6)}`;
}

function getSearchPreviewText(value: string, fallback = "Пользователь найден") {
  const normalized = value.trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= 60) {
    return normalized;
  }

  return `${normalized.slice(0, 57)}...`;
}
