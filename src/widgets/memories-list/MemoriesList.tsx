import { useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useNavigate, useSearchParams } from "react-router-dom";
import { deleteCategory, getUserCategories, renameCategory, saveUserCategories } from "../../entities/memory/api/categories";
import {
  findSimilarCategory,
  getAllTags,
  MEMORY_ACCESS_TYPES,
  normalizeCategoryName,
  normalizeMemory,
  type NormalizedMemory,
} from "../../entities/memory/model/memory";
import { db } from "../../shared/api/firebase/firebase";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../shared/lib/firebase-errors";
import { searchUsersByUsername, type UserSearchResult } from "../../shared/lib/users";
import { MEMORY_CATEGORY_MAX, validateMemoryCategory } from "../../shared/lib/validation";

type SortMode =
  | "created-desc"
  | "created-asc"
  | "event-desc"
  | "event-asc"
  | "title-asc"
  | "title-desc";

const DEFAULT_SORT_MODE: SortMode = "created-desc";

export default function MemoriesList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get("search") ?? "";
  const initialCategory = searchParams.get("category") ?? "";
  const initialTag = searchParams.get("tag") ?? "";
  const initialPlace = searchParams.get("place") ?? "";
  const initialDateFrom = searchParams.get("dateFrom") ?? "";
  const initialDateTo = searchParams.get("dateTo") ?? "";
  const initialAccessType = searchParams.get("access") ?? "";
  const initialSort = (searchParams.get("sort") as SortMode | null) ?? DEFAULT_SORT_MODE;

  const [items, setItems] = useState<NormalizedMemory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(Boolean(initialSearch));
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState(initialSearch);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [tagFilter, setTagFilter] = useState(initialTag);
  const [placeFilter, setPlaceFilter] = useState(initialPlace);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [accessTypeFilter, setAccessTypeFilter] = useState(initialAccessType);
  const [appliedCategory, setAppliedCategory] = useState(initialCategory);
  const [appliedTagFilter, setAppliedTagFilter] = useState(initialTag);
  const [appliedPlaceFilter, setAppliedPlaceFilter] = useState(initialPlace);
  const [appliedDateFrom, setAppliedDateFrom] = useState(initialDateFrom);
  const [appliedDateTo, setAppliedDateTo] = useState(initialDateTo);
  const [appliedAccessTypeFilter, setAppliedAccessTypeFilter] = useState(initialAccessType);
  const [sortMode, setSortMode] = useState<SortMode>(initialSort);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    void getUserCategories(user.uid)
      .then(setCategories)
      .catch(() => setCategories([]));

    const q = query(collection(db, "memories"), where("ownerId", "==", user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((item) => normalizeMemory(item.id, item.data()));
        setItems(next);
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError?.message ?? "Не удалось загрузить воспоминания");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || !appliedSearchQuery.trim()) {
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
  }, [appliedSearchQuery, user]);

  const currentListQueryString = useMemo(() => {
    const next = new URLSearchParams();
    if (appliedSearchQuery) next.set("search", appliedSearchQuery);
    if (appliedCategory) next.set("category", appliedCategory);
    if (appliedTagFilter) next.set("tag", appliedTagFilter);
    if (appliedPlaceFilter) next.set("place", appliedPlaceFilter);
    if (appliedDateFrom) next.set("dateFrom", appliedDateFrom);
    if (appliedDateTo) next.set("dateTo", appliedDateTo);
    if (appliedAccessTypeFilter) next.set("access", appliedAccessTypeFilter);
    if (sortMode !== DEFAULT_SORT_MODE) next.set("sort", sortMode);
    return next.toString();
  }, [
    appliedAccessTypeFilter,
    appliedCategory,
    appliedDateFrom,
    appliedDateTo,
    appliedPlaceFilter,
    appliedSearchQuery,
    appliedTagFilter,
    sortMode,
  ]);

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
    if (next.sort && next.sort !== DEFAULT_SORT_MODE) params.set("sort", next.sort);
    setSearchParams(params);
  }

  async function onDelete(id: string) {
    const ok = window.confirm("Удалить это воспоминание?");
    if (!ok) return;

    setBusyId(id);
    setError(null);

    try {
      await deleteDoc(doc(db, "memories", id));
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Не удалось удалить воспоминание"));
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreateCategory() {
    if (!user) {
      return;
    }

    const nextName = normalizeCategoryName(categoryName);
    const validationError = validateMemoryCategory(nextName);
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    if (!nextName) {
      setCategoryError("Введите название категории");
      return;
    }

    if (categories.includes(nextName)) {
      setCategoryError("Такая категория уже есть");
      return;
    }

    const similarCategory = findSimilarCategory(categories, nextName);
    if (similarCategory) {
      setCategoryError(`Похожая категория уже есть: ${similarCategory}`);
      return;
    }

    try {
      const nextCategories = [...categories, nextName].sort((left, right) => left.localeCompare(right, "ru"));
      await saveUserCategories(user.uid, nextCategories);
      setCategories(nextCategories);
      setCategoryName("");
      setCategoryError(null);
    } catch (createError: unknown) {
      setCategoryError(parseCategoryError(createError, "Не удалось создать категорию"));
    }
  }

  async function handleRenameCategory(category: string) {
    if (!user) {
      return;
    }

    const nextName = window.prompt("Новое название категории", category);
    if (nextName === null) {
      return;
    }

    const validationError = validateMemoryCategory(nextName);
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    if (!normalizeCategoryName(nextName)) {
      setCategoryError("Название категории не может быть пустым");
      return;
    }

    try {
      const nextCategories = await renameCategory(user.uid, category, nextName);
      setCategories(nextCategories);
      setCategoryError(null);
      if (selectedCategory === category) {
        setSelectedCategory(normalizeCategoryName(nextName));
      }
      if (appliedCategory === category) {
        setAppliedCategory(normalizeCategoryName(nextName));
      }
    } catch (renameError: unknown) {
      setCategoryError(parseCategoryError(renameError, "Не удалось переименовать категорию"));
    }
  }

  async function handleDeleteCategory(category: string) {
    if (!user) {
      return;
    }

    const ok = window.confirm(`Удалить категорию "${category}"? У воспоминаний она будет очищена.`);
    if (!ok) {
      return;
    }

    try {
      const nextCategories = await deleteCategory(user.uid, category);
      setCategories(nextCategories);
      setCategoryError(null);
      if (selectedCategory === category) {
        setSelectedCategory("");
      }
      if (appliedCategory === category) {
        setAppliedCategory("");
      }
    } catch (deleteError: unknown) {
      setCategoryError(getErrorMessage(deleteError, "Не удалось удалить категорию"));
    }
  }

  const categoryOptions = Array.from(
    new Set([...categories, ...items.map((item) => item.category).filter(Boolean)])
  ).sort((left, right) => left.localeCompare(right, "ru"));

  const filteredItems = items
    .filter((item) => appliedCategory ? item.category === appliedCategory : true)
    .filter((item) => {
      if (!appliedTagFilter.trim()) {
        return true;
      }

      const normalizedQuery = appliedTagFilter.trim().toLowerCase();
      return getAllTags(item).some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .filter((item) => {
      if (!appliedPlaceFilter.trim()) {
        return true;
      }

      const normalizedQuery = appliedPlaceFilter.trim().toLowerCase();
      return item.place.toLowerCase().includes(normalizedQuery)
        || item.placeTags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .filter((item) => !appliedDateFrom || item.date >= appliedDateFrom)
    .filter((item) => !appliedDateTo || item.date <= appliedDateTo)
    .filter((item) => appliedAccessTypeFilter ? item.accessType === appliedAccessTypeFilter : true)
    .sort((left, right) => sortItems(left, right, sortMode));

  const normalizedSearchQuery = appliedSearchQuery.trim().toLowerCase();
  const memorySearchResults = normalizedSearchQuery
    ? items.filter((item) => {
        const textForSearch = [
          item.title,
          item.text,
          ...item.emotionTags,
          ...item.placeTags,
          ...item.customTags,
        ].join(" ").toLowerCase();

        return textForSearch.includes(normalizedSearchQuery);
      })
    : [];

  if (error) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <div className="memoriesLayout">
      <div className="toolbarRow">
        <button
          type="button"
          className={`panelToggle ${showCategoriesPanel ? "panelToggleActive" : ""}`}
          onClick={() => setShowCategoriesPanel((value) => !value)}
        >
          Категории
        </button>
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

      {showCategoriesPanel && (
        <section className="card sectionCard floatingPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Категории</div>
              <div className="sectionText">Создавайте, переименовывайте и удаляйте категории для организации архива.</div>
            </div>
          </div>
          <div className="categoryCreateRow">
            <input
              className={`input ${categoryError ? "inputError" : ""}`}
              placeholder="Новая категория"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              maxLength={MEMORY_CATEGORY_MAX}
            />
            <button className="btnPrimary" type="button" onClick={() => void handleCreateCategory()}>
              Создать
            </button>
          </div>
          {categoryError && <div className="error">{categoryError}</div>}
          <div className="categoryManagerList">
            {categoryOptions.length > 0 ? categoryOptions.map((category) => (
              <div className="categoryManagerItem" key={category}>
                <span>{category}</span>
                <div className="categoryManagerActions">
                  <button className="btnSmall" type="button" onClick={() => void handleRenameCategory(category)}>Переименовать</button>
                  <button className="btnSmallDanger" type="button" onClick={() => void handleDeleteCategory(category)}>Удалить</button>
                </div>
              </div>
            )) : <div className="emptyState">Пока нет категорий. Можно создать первую выше.</div>}
          </div>
        </section>
      )}

      {showSearchPanel && (
        <section className="card sectionCard floatingPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Поиск</div>
              <div className="sectionText">Поиск по воспоминаниям выполняется по заголовку, тексту и тегам, поиск пользователей - по username.</div>
            </div>
          </div>
          <div className="searchPanelRow">
            <div className="field searchPanelField">
              <input
                className="input"
                placeholder="Например, лето или Москва"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") {
                    return;
                  }

                  event.preventDefault();
                  const nextQuery = searchQuery.trim();
                  setAppliedSearchQuery(nextQuery);
                  syncParams({
                    search: nextQuery,
                    category: appliedCategory,
                    tag: appliedTagFilter,
                    place: appliedPlaceFilter,
                    dateFrom: appliedDateFrom,
                    dateTo: appliedDateTo,
                    access: appliedAccessTypeFilter,
                    sort: sortMode,
                  });
                }}
              />
            </div>
            <button
              className="btnPrimary"
              type="button"
              onClick={() => {
                const nextQuery = searchQuery.trim();
                setAppliedSearchQuery(nextQuery);
                syncParams({
                  search: nextQuery,
                  category: appliedCategory,
                  tag: appliedTagFilter,
                  place: appliedPlaceFilter,
                  dateFrom: appliedDateFrom,
                  dateTo: appliedDateTo,
                  access: appliedAccessTypeFilter,
                  sort: sortMode,
                });
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
                syncParams({
                  search: "",
                  category: appliedCategory,
                  tag: appliedTagFilter,
                  place: appliedPlaceFilter,
                  dateFrom: appliedDateFrom,
                  dateTo: appliedDateTo,
                  access: appliedAccessTypeFilter,
                  sort: sortMode,
                });
              }}
            >
              Сбросить
            </button>
          </div>
        </section>
      )}

      {showSortPanel && (
        <section className="card sectionCard floatingPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Сортировка</div>
              <div className="sectionText">Выберите один из шести вариантов отображения списка.</div>
            </div>
          </div>
          <div className="sortPanelRow">
            <div className="field sortPanelField">
              <label className="label">Как сортировать</label>
              <select
                className="input"
                value={sortMode}
                onChange={(e) => {
                  const nextSort = e.target.value as SortMode;
                  setSortMode(nextSort);
                  syncParams({
                    search: appliedSearchQuery,
                    category: appliedCategory,
                    tag: appliedTagFilter,
                    place: appliedPlaceFilter,
                    dateFrom: appliedDateFrom,
                    dateTo: appliedDateTo,
                    access: appliedAccessTypeFilter,
                    sort: nextSort,
                  });
                }}
              >
                <option value="created-desc">По дате создания: новые сверху</option>
                <option value="created-asc">По дате создания: старые сверху</option>
                <option value="event-desc">По дате события: новые сверху</option>
                <option value="event-asc">По дате события: старые сверху</option>
                <option value="title-asc">По алфавиту: А-Я</option>
                <option value="title-desc">По алфавиту: Я-А</option>
              </select>
            </div>
            <button
              className="btnSecondary"
              type="button"
              onClick={() => {
                setSortMode(DEFAULT_SORT_MODE);
                syncParams({
                  search: appliedSearchQuery,
                  category: appliedCategory,
                  tag: appliedTagFilter,
                  place: appliedPlaceFilter,
                  dateFrom: appliedDateFrom,
                  dateTo: appliedDateTo,
                  access: appliedAccessTypeFilter,
                  sort: DEFAULT_SORT_MODE,
                });
              }}
            >
              Сбросить сортировку
            </button>
          </div>
        </section>
      )}

      {showFiltersPanel && (
        <section className="card sectionCard floatingPanel">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Фильтры</div>
              <div className="sectionText">Можно отобрать воспоминания по категории, тегам, месту, диапазону дат и типу доступа.</div>
            </div>
          </div>
          <div className="filtersGrid">
            <div className="field">
              <label className="label">Категория</label>
              <select className="input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="">Все категории</option>
                {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Тег</label>
              <input className="input" placeholder="Например, семья или море" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Место</label>
              <input className="input" placeholder="Например, Москва или парк" value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Тип доступа</label>
              <select className="input" value={accessTypeFilter} onChange={(e) => setAccessTypeFilter(e.target.value)}>
                <option value="">Все типы</option>
                {MEMORY_ACCESS_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Дата события: от</label>
              <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Дата события: до</label>
              <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="panelActions">
            <button
              className="btnPrimary"
              type="button"
              onClick={() => {
                setAppliedCategory(selectedCategory);
                setAppliedTagFilter(tagFilter);
                setAppliedPlaceFilter(placeFilter);
                setAppliedDateFrom(dateFrom);
                setAppliedDateTo(dateTo);
                setAppliedAccessTypeFilter(accessTypeFilter);
                syncParams({
                  search: appliedSearchQuery,
                  category: selectedCategory,
                  tag: tagFilter,
                  place: placeFilter,
                  dateFrom,
                  dateTo,
                  access: accessTypeFilter,
                  sort: sortMode,
                });
              }}
            >
              Применить
            </button>
            <button
              className="btnSecondary"
              type="button"
              onClick={() => {
                setSelectedCategory("");
                setTagFilter("");
                setPlaceFilter("");
                setDateFrom("");
                setDateTo("");
                setAccessTypeFilter("");
                setAppliedCategory("");
                setAppliedTagFilter("");
                setAppliedPlaceFilter("");
                setAppliedDateFrom("");
                setAppliedDateTo("");
                setAppliedAccessTypeFilter("");
                syncParams({
                  search: appliedSearchQuery,
                  category: "",
                  tag: "",
                  place: "",
                  dateFrom: "",
                  dateTo: "",
                  access: "",
                  sort: sortMode,
                });
              }}
            >
              Сбросить фильтры
            </button>
          </div>
        </section>
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
                      </div>
                    </div>
                    <button className="btnSmall" type="button" onClick={() => navigate(`/memories/${item.id}${currentListQueryString ? `?${currentListQueryString}` : ""}`)}>
                      Открыть
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">Совпадений по воспоминаниям не найдено.</div>
            )}
          </div>

          <div className="searchResultsSection">
            <div className="searchResultsTitle">Пользователи</div>
            {searchingUsers ? (
              <div className="emptyState">Ищем пользователей...</div>
            ) : userResults.length > 0 ? (
              <div className="searchResultsList">
                {userResults.map((item) => (
                  <div className="searchResultItem" key={`user-${item.id}`}>
                    <div className="searchUserIdentity">
                      {item.avatarDataUrl ? (
                        <img className="searchUserAvatar" src={item.avatarDataUrl} alt={item.username} />
                      ) : (
                        <div className="searchUserAvatarPlaceholder">{item.username.slice(0, 1).toUpperCase()}</div>
                      )}
                      <div className="searchResultBody">
                        <div className="searchResultTitle">@{renderHighlightedText(item.username, appliedSearchQuery)}</div>
                        <div className="searchResultPreview">{item.description || "Пользователь найден"}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState">Пользователи по username не найдены.</div>
            )}
          </div>
        </section>
      )}

      {filteredItems.length === 0 ? (
        <div className="card emptyState" style={{ textAlign: "center" }}>
          {items.length === 0
            ? "У вас пока нет воспоминаний. Создайте первое, чтобы начать вести архив."
            : "По выбранным фильтрам ничего не найдено. Попробуйте изменить условия поиска."}
        </div>
      ) : (
        <div className="grid">
          {filteredItems.map((item) => (
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
                    onClick={() => navigate(`/memories/${item.id}${currentListQueryString ? `?${currentListQueryString}` : ""}`)}
                  >
                    ↗
                  </button>
                  <button
                    className="btnSmall"
                    onClick={() => navigate(`/memories/${item.id}/edit${currentListQueryString ? `?returnTo=${encodeURIComponent(`/memories/${item.id}?${currentListQueryString}`)}` : ""}`)}
                    disabled={busyId === item.id}
                  >
                    Редактировать
                  </button>

                  <button
                    className="btnSmallDanger"
                    onClick={() => void onDelete(item.id)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id ? "..." : "Удалить"}
                  </button>
                </div>
              </div>
            </div>
          ))}
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

function sortItems(left: NormalizedMemory, right: NormalizedMemory, sortMode: SortMode) {
  switch (sortMode) {
    case "created-asc":
      return compareDates(left.createdAt, right.createdAt);
    case "event-desc":
      return compareStrings(right.date, left.date);
    case "event-asc":
      return compareStrings(left.date, right.date);
    case "title-asc":
      return compareStrings(left.title, right.title);
    case "title-desc":
      return compareStrings(right.title, left.title);
    case "created-desc":
    default:
      return compareDates(right.createdAt, left.createdAt);
  }
}

function compareDates(left: Date | null, right: Date | null) {
  const leftValue = left?.getTime() ?? 0;
  const rightValue = right?.getTime() ?? 0;
  return leftValue - rightValue;
}

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, "ru");
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

function parseCategoryError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.startsWith("CATEGORY_EXISTS:")) {
    return `Похожая категория уже есть: ${error.message.replace("CATEGORY_EXISTS:", "")}`;
  }

  return getErrorMessage(error, fallback);
}

function getMemoryPreview(item: NormalizedMemory) {
  const firstTag = getAllTags(item)[0];
  const parts = [item.text.trim(), firstTag ? `Тег: ${firstTag}` : "", item.place ? `Место: ${item.place}` : ""]
    .filter(Boolean)
    .join(" • ");

  return parts || "Краткое превью недоступно";
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
