import { useEffect, useMemo, useState } from "react";
import { getFriendProfiles, type FriendProfile } from "../../../entities/friend";
import type { MemoryAccessType, MemoryShareRole, NormalizedMemoryShare } from "../../../entities/memory";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { toggleMemoryShare, updateMemoryShareRole } from "../model/access";

const MEMORY_SHARE_ROLES: Array<{ value: MemoryShareRole; label: string; description: string }> = [
  {
    value: "view",
    label: "Просмотр",
    description: "Можно только смотреть воспоминание",
  },
  {
    value: "comment",
    label: "Комментарий",
    description: "Можно смотреть и оставлять комментарии",
  },
  {
    value: "edit",
    label: "Редактирование",
    description: "Можно смотреть, комментировать и редактировать воспоминание",
  },
];

type ManageMemoryAccessProps = {
  userId: string;
  accessType: MemoryAccessType;
  sharedWith: NormalizedMemoryShare[];
  error?: string;
  disabled?: boolean;
  onChange: (nextSharedWith: NormalizedMemoryShare[]) => void;
};

export default function ManageMemoryAccess({
  userId,
  accessType,
  sharedWith,
  error,
  disabled = false,
  onChange,
}: ManageMemoryAccessProps) {
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (disabled) {
      setFriends([]);
      setFriendsError(null);
      setLoading(false);
      return;
    }

    if (accessType !== "shared" && sharedWith.length === 0) {
      setFriends([]);
      setFriendsError(null);
      setLoading(false);
      return;
    }

    let active = true;

    async function loadFriends() {
      setLoading(true);
      setFriendsError(null);

      try {
        const nextFriends = await getFriendProfiles(userId);
        if (!active) {
          return;
        }

        setFriends(nextFriends);
      } catch (loadError: unknown) {
        if (!active) {
          return;
        }

        setFriends([]);
        setFriendsError(getErrorMessage(loadError, "Не удалось загрузить список друзей"));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFriends();

    return () => {
      active = false;
    };
  }, [accessType, disabled, sharedWith.length, userId]);

  const sharesByUserId = useMemo(() => (
    new Map(sharedWith.map((item) => [item.userId, item]))
  ), [sharedWith]);

  const visibleFriends = useMemo(() => {
    const normalizedQuery = search.trim().toLocaleLowerCase("ru-RU");
    if (!normalizedQuery) {
      return friends;
    }

    return friends.filter((friend) => friend.username.toLocaleLowerCase("ru-RU").includes(normalizedQuery));
  }, [friends, search]);

  const hasPresetShares = sharedWith.length > 0;
  const isSharedMode = accessType === "shared";
  const canManage = isSharedMode && !disabled;

  function handleToggleShare(friend: FriendProfile) {
    onChange(toggleMemoryShare(sharedWith, friend, sharesByUserId.get(friend.id)?.role ?? "view"));
  }

  function handleRoleChange(friend: FriendProfile, role: MemoryShareRole) {
    if (!sharesByUserId.has(friend.id)) {
      onChange(toggleMemoryShare(sharedWith, friend, role));
      return;
    }

    onChange(updateMemoryShareRole(sharedWith, friend, role));
  }

  if (disabled) {
    return (
      <section className="memoryAccessSection">
        <div className="label">Совместный доступ</div>
        <div className="memoryAccessIntro">
          <div className="memoryAccessTitle">Кому открыт доступ</div>
          <div className="memoryAccessText">Здесь можно только посмотреть, кому выдан доступ и какой у каждого уровень прав.</div>
        </div>

        <div className="memoryAccessGrantedList">
          {sharedWith.length > 0 ? sharedWith.map((share) => (
            <div className="memoryAccessGrantedItem" key={share.userId}>
              <div className="memoryAccessGrantedBody">
                <div className="memoryAccessGrantedTitle">@{share.username}</div>
                <div className="memoryAccessGrantedMeta">
                  {MEMORY_SHARE_ROLES.find((item) => item.value === share.role)?.label ?? "Просмотр"}
                </div>
              </div>
            </div>
          )) : (
            <div className="emptyState">Сейчас доступ никому не выдан.</div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="memoryAccessSection">
      <div className="label">Совместный доступ</div>
      <div className="memoryAccessIntro">
        <div className="memoryAccessTitle">Кому открыть воспоминание</div>
        <div className="memoryAccessText">
          Доступ можно выдать только друзьям. Выберите людей, назначьте им роль и при необходимости отзовите доступ.
        </div>
      </div>

      {!isSharedMode && (
        <div className="memoryAccessNotice">
          {hasPresetShares
            ? "Список друзей сохранён в форме и снова появится, если вернуть режим shared. Пока запись будет сохранена без shared-доступа."
            : "Shared-доступ включится после выбора режима «совместное»."}
        </div>
      )}

      <div className="memoryAccessRoles">
        {MEMORY_SHARE_ROLES.map((role) => (
          <div className="memoryAccessRoleHint" key={role.value}>
            <div className="memoryAccessRoleTitle">{role.label}</div>
            <div className="memoryAccessRoleText">{role.description}</div>
          </div>
        ))}
      </div>

      <div className="memoryAccessGrantedList">
        <div className="memoryAccessSubtitle">Уже открыт доступ</div>
        {sharedWith.length > 0 ? sharedWith.map((share) => (
          <div className="memoryAccessGrantedItem" key={share.userId}>
            <div className="memoryAccessGrantedBody">
              <div className="memoryAccessGrantedTitle">@{share.username}</div>
              <div className="memoryAccessGrantedMeta">
                {MEMORY_SHARE_ROLES.find((item) => item.value === share.role)?.label ?? "Просмотр"}
              </div>
            </div>
            <button
              type="button"
              className="btnSmallDanger"
              onClick={() => onChange(sharedWith.filter((item) => item.userId !== share.userId))}
            >
              Отозвать
            </button>
          </div>
        )) : (
          <div className="emptyState">Пока никто не добавлен.</div>
        )}
      </div>

      <div className="field">
        <input
          className="input"
          placeholder="Найти друга по username"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {friendsError && <div className="error">{friendsError}</div>}
      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="card emptyState">Загрузка друзей...</div>
      ) : friends.length === 0 ? (
        <div className="card emptyState">Сначала добавьте друзей, чтобы открыть им доступ к воспоминанию.</div>
      ) : visibleFriends.length === 0 ? (
        <div className="card emptyState">Друзья по этому запросу не найдены.</div>
      ) : (
        <div className="memoryAccessFriendsList">
          {visibleFriends.map((friend) => {
            const share = sharesByUserId.get(friend.id);

            return (
              <div className="memoryAccessFriendCard" key={friend.id}>
                <div className="memoryAccessFriendBody">
                  <div className="memoryAccessFriendTitle">@{friend.username}</div>
                  <div className="memoryAccessFriendMeta">{friend.description || "Друг доступен для shared-доступа"}</div>
                </div>

                <div className="memoryAccessFriendControls">
                  <select
                    className="input memoryAccessRoleSelect"
                    value={share?.role ?? "view"}
                    onChange={(event) => handleRoleChange(friend, event.target.value as MemoryShareRole)}
                    disabled={!canManage}
                  >
                    {MEMORY_SHARE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>{role.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={share ? "btnSmallDanger" : "btnSmall"}
                    onClick={() => handleToggleShare(friend)}
                    disabled={!canManage}
                  >
                    {share ? "Убрать" : "Открыть"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
