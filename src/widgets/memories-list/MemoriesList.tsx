import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
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
import { MEMORY_CATEGORY_MAX, validateMemoryCategory } from "../../shared/lib/validation";

type SortMode =
  | "created-desc"
  | "created-asc"
  | "event-desc"
  | "event-asc"
  | "title-asc"
  | "title-desc";

export default function MemoriesList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<NormalizedMemory[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [showCategoriesPanel, setShowCategoriesPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [placeFilter, setPlaceFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [accessTypeFilter, setAccessTypeFilter] = useState("");
  const [appliedCategory, setAppliedCategory] = useState("");
  const [appliedTagFilter, setAppliedTagFilter] = useState("");
  const [appliedPlaceFilter, setAppliedPlaceFilter] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [appliedAccessTypeFilter, setAppliedAccessTypeFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("created-desc");

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    void getUserCategories(user.uid)
      .then(setCategories)
      .catch(() => setCategories([]));

    const q = query(
      collection(db, "memories"),
      where("ownerId", "==", user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((item) => normalizeMemory(item.id, item.data()));
        setItems(next);
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? "Не удалось загрузить воспоминания");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  async function onDelete(id: string) {
    const ok = window.confirm("Удалить это воспоминание?");
    if (!ok) return;

    setBusyId(id);
    setError(null);

    try {
      await deleteDoc(doc(db, "memories", id));
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Не удалось удалить воспоминание"));
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
    } catch (e: unknown) {
      setCategoryError(parseCategoryError(e, "Не удалось создать категорию"));
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
    } catch (e: unknown) {
      setCategoryError(parseCategoryError(e, "Не удалось переименовать категорию"));
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
    } catch (e: unknown) {
      setCategoryError(getErrorMessage(e, "Не удалось удалить категорию"));
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
    .filter((item) => {
      if (!appliedDateFrom) {
        return true;
      }

      return item.date >= appliedDateFrom;
    })
    .filter((item) => {
      if (!appliedDateTo) {
        return true;
      }

      return item.date <= appliedDateTo;
    })
    .filter((item) => appliedAccessTypeFilter ? item.accessType === appliedAccessTypeFilter : true)
    .sort((left, right) => sortItems(left, right, sortMode));

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
              <select className="input" value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
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
              onClick={() => setSortMode("created-desc")}
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
              }}
            >
              Сбросить фильтры
            </button>
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
                    className="btnSmall"
                    onClick={() => navigate(`/memories/${item.id}/edit`)}
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

function formatDate(d: string) {
  if (!d) return "не указано";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
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
