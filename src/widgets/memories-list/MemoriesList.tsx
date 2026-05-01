import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  applyMemoryFilters,
  canUserEditMemory,
  DEFAULT_MEMORY_SORT_MODE,
  deleteMemoryById,
  getMemoryPreview,
  getUserCategories,
  MEMORY_ACCESS_TYPES,
  normalizeMemory,
  searchMemoriesByQuery,
  sortMemories,
  type MemoryFilters,
  type MemorySortMode,
  type NormalizedMemory,
} from "../../entities/memory";
import { searchUsersByUsername, type UserSearchResult } from "../../entities/user";
import { ManageMemoryCategories } from "../../features/manage-memory-categories";
import { MemoryFiltersPanel } from "../../features/memory-filters";
import { MemorySortingPanel } from "../../features/memory-sorting";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { db } from "../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

const EMPTY_FILTERS: MemoryFilters = {
  category: "",
  tag: "",
  place: "",
  dateFrom: "",
  dateTo: "",
  accessType: "",
};

type MemoriesListScope = "owned" | "shared" | "publicProfile";

type MemoriesListProps = {
  scope?: MemoriesListScope;
  ownerId?: string;
  ownerUsernameOverride?: string;
  emptyText?: string;
};

export default function MemoriesList({
  scope = "owned",
  ownerId,
  ownerUsernameOverride = "",
  emptyText,
}: MemoriesListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialSort = (searchParams.get("sort") as MemorySortMode | null) ?? DEFAULT_MEMORY_SORT_MODE;
  const initialFilters: MemoryFilters = {
    category: searchParams.get("category") ?? "",
    tag: searchParams.get("tag") ?? "",
    place: searchParams.get("place") ?? "",
    dateFrom: searchParams.get("dateFrom") ?? "",
    dateTo: searchParams.get("dateTo") ?? "",
    accessType: (searchParams.get("access") ?? "") as MemoryFilters["accessType"],
  };

  const [items, setItems] = useState<NormalizedMemory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(Boolean(initialSearch));
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(initialSearch);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);

  const [draftFilters, setDraftFilters] = useState<MemoryFilters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<MemoryFilters>(initialFilters);
  const [sortMode, setSortMode] = useState<MemorySortMode>(initialSort);

  const showCategoryManager = scope === "owned";
  const showUserSearch = scope === "owned";

  useEffect(() => {
    if (!user) {
      return;
    }

    if (scope === "publicProfile" && !ownerId) {
      setItems([]);
      setLoading(false);
      setError("Профиль пользователя не найден");
      return;
    }

    setLoading(true);
    setError(null);

    if (showCategoryManager) {
      void getUserCategories(user.uid)
        .then(setCategories)
        .catch(() => setCategories([]));
    } else {
      setCategories([]);
    }

    const baseCollection = collection(db, "memories");
    const memoriesQuery = scope === "shared"
      ? query(baseCollection, where("sharedUserIds", "array-contains", user.uid))
      : scope === "publicProfile"
        ? query(baseCollection, where("ownerId", "==", ownerId), where("accessType", "==", "public"))
        : query(baseCollection, where("ownerId", "==", user.uid));

    const unsubscribe = onSnapshot(
      memoriesQuery,
      (snapshot) => {
        const nextItems = snapshot.docs
          .map((item) => normalizeMemory(item.id, item.data()))
          .filter((item) => (
            scope !== "shared" || (item.ownerId !== user.uid && item.accessType === "shared")
          ));

        setItems(nextItems);
        setLoading(false);
      },
      () => {
        setItems([]);
        setError(getScopeError(scope));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerId, scope, showCategoryManager, user]);

  useEffect(() => {
    if (!showUserSearch || !user || !appliedSearchQuery.trim()) {
      setUserResults([]);
      return;
    }

    const currentUserId = user.uid;

    async function loadUsers() {
      setSearchingUsers(true);
      try {
        setUserResults(await searchUsersByUsername(appliedSearchQuery, currentUserId));
      } catch {
        setUserResults([]);
      } finally {
        setSearchingUsers(false);
      }
    }

    void loadUsers();
  }, [appliedSearchQuery, showUserSearch, user]);

  const categoryOptions = useMemo(() => (
    Array.from(new Set([...categories, ...items.map((item) => item.category).filter(Boolean)]))
      .sort((left, right) => left.localeCompare(right, "ru"))
  ), [categories, items]);

  const filteredItems = useMemo(() => (
    sortMemories(applyMemoryFilters(items, appliedFilters), sortMode)
  ), [appliedFilters, items, sortMode]);

  const memorySearchResults = useMemo(() => (
    searchMemoriesByQuery(items, appliedSearchQuery)
  ), [appliedSearchQuery, items]);

  function syncParams(next: {
    search?: string;
    category?: string;
    tag?: string;
    place?: string;
    dateFrom?: string;
    dateTo?: string;
    access?: string;
    sort?: string;
  }) {
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.category) params.set("category", next.category);
    if (next.tag) params.set("tag", next.tag);
    if (next.place) params.set("place", next.place);
    if (next.dateFrom) params.set("dateFrom", next.dateFrom);
    if (next.dateTo) params.set("dateTo", next.dateTo);
    if (next.access) params.set("access", next.access);
    if (next.sort && next.sort !== DEFAULT_MEMORY_SORT_MODE) params.set("sort", next.sort);
    setSearchParams(params);
  }

  function syncCurrentState(next: {
    search?: string;
    filters?: MemoryFilters;
    sort?: MemorySortMode;
  }) {
    const search = next.search ?? appliedSearchQuery;
    const filters = next.filters ?? appliedFilters;
    const sort = next.sort ?? sortMode;

    syncParams({
      search,
      category: filters.category,
      tag: filters.tag,
      place: filters.place,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      access: filters.accessType,
      sort,
    });
  }

  async function onDelete(id: string) {
    const confirmed = window.confirm("Удалить это воспоминание?");
    if (!confirmed) return;

    setBusyId(id);
    setError(null);

    try {
      await deleteMemoryById(id);
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Не удалось удалить воспоминание"));
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="emptyState">{error}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  const listReturnTo = `${location.pathname}${location.search}`;
  const resolvedEmptyText = emptyText ?? getEmptyText(scope);

  return (
    <div className="memoriesLayout">
      <div className="toolbarRow">
        {showCategoryManager && (
          <button
            type="button"
            className={`panelToggle ${showCategoriesPanel ? "panelToggleActive" : ""}`}
            onClick={() => setShowCategoriesPanel((value) => !value)}
          >
            Категории
          </button>
        )}
        <button
          type="button"
          className={`panelToggle ${showSearchPanel ? "panelToggleActive" : ""}`}
          onClick={() => setShowSearchPanel((value) => !value)}
        >
          Поиск
        </button>
        <button
          type="button"
          className={`panelToggle ${showSortPanel ? "panelToggleActive" : ""}`}
          onClick={() => setShowSortPanel((value) => !value)}
        >
          Сортировка
        </button>
        <button
          type="button"
          className={`panelToggle ${showFiltersPanel ? "panelToggleActive" : ""}`}
          onClick={() => setShowFiltersPanel((value) => !value)}
        >
          Фильтры
        </button>
      </div>

      {showCategoryManager && showCategoriesPanel && user && (
        <ManageMemoryCategories
          userId={user.uid}
          categories={categories}
          categoryOptions={categoryOptions}
          onCategoriesChange={setCategories}
          onCategoryRenamed={(previousCategory, nextCategory) => {
            const renameInFilters = (filters: MemoryFilters) => (
              filters.category === previousCategory
                ? { ...filters, category: nextCategory }
                : filters
            );

            setDraftFilters((prev) => renameInFilters(prev));
            setAppliedFilters((prev) => renameInFilters(prev));
          }}
          onCategoryDeleted={(category) => {
            const clearInFilters = (filters: MemoryFilters) => (
              filters.category === category
                ? { ...filters, category: "" }
                : filters
            );

            setDraftFilters((prev) => clearInFilters(prev));
            setAppliedFilters((prev) => clearInFilters(prev));
          }}
        />
      )}

      {showSearchPanel && (
        <section className="card sectionCard floatingPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Поиск</div>
              <div className="sectionText">
                {showUserSearch
                  ? "Поиск по воспоминаниям идет по заголовку, тексту и тегам, по пользователям - по username."
                  : "Поиск идет по заголовку, тексту и тегам внутри текущего списка воспоминаний."}
              </div>
            </div>
          </div>
          <div className="searchPanelRow">
            <div className="field searchPanelField">
              <input
                className="input"
                placeholder="Например, лето или Москва"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  const nextQuery = searchQuery.trim();
                  setAppliedSearchQuery(nextQuery);
                  syncCurrentState({ search: nextQuery });
                }}
              />
            </div>
            <button
              className="btnPrimary"
              type="button"
              onClick={() => {
                const nextQuery = searchQuery.trim();
                setAppliedSearchQuery(nextQuery);
                syncCurrentState({ search: nextQuery });
              }}
            >
              Искать
            </button>
            <button
              className="btnSecondary"
              type="button"
              onClick={() => {
                setSearchQuery("");
                setAppliedSearchQuery("");
                setUserResults([]);
                syncCurrentState({ search: "" });
              }}
            >
              Сбросить
            </button>
          </div>
        </section>
      )}

      {showSortPanel && (
        <MemorySortingPanel
          sortMode={sortMode}
          onChange={(nextSort) => {
            setSortMode(nextSort);
            syncCurrentState({ sort: nextSort });
          }}
          onReset={() => {
            setSortMode(DEFAULT_MEMORY_SORT_MODE);
            syncCurrentState({ sort: DEFAULT_MEMORY_SORT_MODE });
          }}
        />
      )}

      {showFiltersPanel && (
        <MemoryFiltersPanel
          categoryOptions={categoryOptions}
          draftFilters={draftFilters}
          onChange={setDraftFilters}
          onApply={() => {
            setAppliedFilters(draftFilters);
            syncCurrentState({ filters: draftFilters });
          }}
          onReset={() => {
            setDraftFilters(EMPTY_FILTERS);
            setAppliedFilters(EMPTY_FILTERS);
            syncCurrentState({ filters: EMPTY_FILTERS });
          }}
        />
      )}

      {appliedSearchQuery && (
        <section className="card sectionCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Результаты поиска</div>
              <div className="sectionText">Запрос: {appliedSearchQuery}</div>
            </div>
          </div>

          <div className="searchResultsSection">
            <div className="searchResultsTitle">Воспоминания</div>
            {memorySearchResults.length > 0 ? (
              <div className="searchResultsList">
                {memorySearchResults.map((item) => (
                  <div className="searchResultItem" key={`memory-${item.id}`}>
                    <div className="searchResultBody">
                      <div className="searchResultTitle">{renderHighlightedText(item.title, appliedSearchQuery)}</div>
                      <div className="searchResultPreview">{renderHighlightedText(getMemoryPreview(item), appliedSearchQuery)}</div>
                      <div className="searchResultMeta">
                        <span>{item.category || "Без категории"}</span>
                        <span>{formatDate(item.date)}</span>
                        {item.ownerUsername && <span>@{item.ownerUsername}</span>}
                      </div>
                    </div>
                    <button
                      className="btnSmall"
                      type="button"
                      onClick={() => navigate(`/memories/${item.id}?returnTo=${encodeURIComponent(listReturnTo)}`)}
                    >
                      Открыть
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">Совпадений по воспоминаниям не найдено.</div>
            )}
          </div>

          {showUserSearch && (
            <div className="searchResultsSection">
              <div className="searchResultsTitle">Пользователи</div>
              {searchingUsers ? (
                <div className="emptyState">Ищем пользователей...</div>
              ) : userResults.length > 0 ? (
                <div className="searchResultsList">
                  {userResults.map((item) => (
                    <button
                      type="button"
                      className="searchResultItem searchResultButton"
                      key={`user-${item.id}`}
                      onClick={() => navigate(`/users/${item.id}`)}
                    >
                      <div className="searchUserIdentity">
                        {item.avatarDataUrl ? (
                          <img className="searchUserAvatar" src={item.avatarDataUrl} alt={item.username} />
                        ) : (
                          <div className="searchUserAvatarPlaceholder">{item.username.slice(0, 1).toUpperCase()}</div>
                        )}
                        <div className="searchResultBody">
                          <div className="searchResultTitle">@{renderHighlightedText(item.username, appliedSearchQuery)}</div>
                          <div className="searchResultPreview">{item.description || "Открыть профиль пользователя"}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="emptyState">Пользователи по username не найдены.</div>
              )}
            </div>
          )}
        </section>
      )}

      {filteredItems.length === 0 ? (
        <div className="card emptyState" style={{ textAlign: "center" }}>
          {items.length === 0
            ? resolvedEmptyText
            : "По выбранным фильтрам ничего не найдено. Попробуйте изменить условия поиска."}
        </div>
      ) : (
        <div className="grid">
          {filteredItems.map((item) => {
            const canEdit = user ? canUserEditMemory(item, user.uid) : false;
            const isOwner = Boolean(user && item.ownerId === user.uid);

            return (
              <div className="memoryCard" key={item.id}>
                {item.photos?.[0]?.dataUrl && (
                  <div className="memoryPhotoWrap">
                    <img
                      className="memoryPhoto"
                      src={item.photos[0].dataUrl}
                      alt={item.photos[0].name || item.title}
                    />
                    {item.photos.length > 1 && (
                      <div className="memoryPhotoCount">+{item.photos.length - 1}</div>
                    )}
                  </div>
                )}
                <div className="memoryCardTop">
                  {item.category && <span className="pillBadge">{item.category}</span>}
                  <span className="pillBadge pillBadgeMuted">{getAccessTypeLabel(item.accessType)}</span>
                </div>
              <div className="memoryMain">
                  <div className="memoryTitle">{item.title}</div>
                  {item.text && <div className="memoryText">{item.text}</div>}

                  <div className="memoryDetails">
                    {scope !== "owned" && (
                      <div className="memoryInlineMeta">
                        Автор:{" "}
                        {item.ownerId ? (
                          <button
                            type="button"
                            className="inlineLinkButton"
                            onClick={() => navigate(item.ownerId === user?.uid ? "/profile" : `/users/${item.ownerId}`)}
                          >
                            {item.ownerUsername
                              ? `@${item.ownerUsername}`
                              : ownerUsernameOverride
                                ? `@${ownerUsernameOverride}`
                                : "профиль"}
                          </button>
                        ) : (
                          "не указан"
                        )}
                      </div>
                    )}
                    {item.place ? <div className="memoryInlineMeta">Место: {item.place}</div> : <div className="memoryInlineMeta memoryInlineMetaEmpty" />}
                    {item.emotionTags.length > 0 ? <TagRow label="Эмоции" tags={item.emotionTags} tone="emotion" /> : <div className="tagRow tagRowEmpty" />}
                    {item.placeTags.length > 0 ? <TagRow label="Места" tags={item.placeTags} /> : <div className="tagRow tagRowEmpty" />}
                    {item.customTags.length > 0 ? <TagRow label="Теги" tags={item.customTags} /> : <div className="tagRow tagRowEmpty" />}
                  </div>
                </div>

                <div className="memoryFooter">
                  <div className="memoryDateGroup">
                    <div className="memoryDate">Событие: {formatDate(item.date)}</div>
                    <div className="memoryDate">Создано: {formatCreatedAt(item.createdAt)}</div>
                  </div>

                  <div className="cardActions">
                    <button
                      className="btnSmall btnIcon"
                      title="Просмотреть"
                      onClick={() => navigate(`/memories/${item.id}?returnTo=${encodeURIComponent(listReturnTo)}`)}
                    >
                      ↗
                    </button>
                    {canEdit && (
                      <button
                        className="btnSmall"
                        onClick={() => navigate(`/memories/${item.id}/edit?returnTo=${encodeURIComponent(listReturnTo)}`)}
                        disabled={busyId === item.id}
                      >
                        Редактировать
                      </button>
                    )}
                    {isOwner && (
                      <button
                        className="btnSmallDanger"
                        onClick={() => void onDelete(item.id)}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? "..." : "Удалить"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TagRow({ label, tags, tone }: { label: string; tags: string[]; tone?: "emotion" | "default" }) {
  return (
    <div className="tagRow">
      <span className="tagRowLabel">{label}:</span>
      <div className="tagPreview">
        {tags.map((tag) => (
          <span
            key={`${label}-${tag}`}
            className={tone === "emotion" ? "emotionPill" : ""}
            data-emotion={tone === "emotion" ? tag : undefined}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function formatDate(date: string) {
  if (!date) return "не указано";
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}.${month}.${year}`;
}

function formatCreatedAt(date: Date | null) {
  if (!date) {
    return "не указано";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAccessTypeLabel(value: string) {
  return MEMORY_ACCESS_TYPES.find((option) => option.value === value)?.label ?? "Приватное";
}

function renderHighlightedText(text: string, query: string) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(normalizedQuery)})`, "ig");
  return text.split(pattern).map((part, index) => (
    index % 2 === 1
      ? <mark className="searchHighlight" key={`${part}-${index}`}>{part}</mark>
      : <span key={`${part}-${index}`}>{part}</span>
  ));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getScopeError(scope: MemoriesListScope) {
  if (scope === "shared") {
    return "Пока не удалось загрузить доступные воспоминания. После обновления rules этот раздел должен открываться без технических ошибок.";
  }

  if (scope === "publicProfile") {
    return "Не удалось загрузить публичные воспоминания этого пользователя.";
  }

  return "Не удалось загрузить ваши воспоминания.";
}

function getEmptyText(scope: MemoriesListScope) {
  if (scope === "shared") {
    return "Пока никто не открыл вам shared-воспоминания.";
  }

  if (scope === "publicProfile") {
    return "У этого пользователя пока нет публичных воспоминаний.";
  }

  return "У вас пока нет воспоминаний. Создайте первое, чтобы начать вести архив.";
}
