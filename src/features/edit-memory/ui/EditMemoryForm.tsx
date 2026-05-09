import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { ManageMemoryAccess } from "../../../features/manage-memory-access";
import { getAccessibleMemoryById } from "../../../entities/memory";
import { appendUserCategory, getUserCategories } from "../../../entities/memory/api/categories";
import { getUserProfileById } from "../../../entities/user";
import { createSharedMemoryNotification } from "../../../entities/notification";
import {
  buildMemoryAccessPayload,
  canUserEditMemory,
  MEMORY_ACCESS_TYPES,
  findSimilarCategory,
  getAccessType,
  getCategories,
  getCustomTags,
  getEmotionTags,
  getPlaceTags,
  getSharedWith,
  normalizeCategories,
  parseTagInput,
  validateSharedMemoryAccess,
  type NormalizedMemoryShare,
} from "../../../entities/memory/model/memory";
import { db } from "../../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { getDataUrlSize, prepareImageForFirestore, type StoredImage } from "../../../shared/lib/images";
import {
  EMOTIONS,
  MEMORY_CATEGORY_MAX,
  MEMORY_PHOTO_FIRESTORE_MAX_SIZE,
  MEMORY_PHOTO_FIRESTORE_TOTAL_MAX_SIZE,
  MEMORY_PHOTO_MAX_FILES,
  MEMORY_PHOTO_MAX_SIZE,
  MEMORY_PLACE_MAX,
  MEMORY_PLACE_TAG_MAX,
  MEMORY_TAG_MAX,
  MEMORY_TEXT_MAX,
  MEMORY_TITLE_MAX,
  hasValidationErrors,
  validateMemoryCategory,
  validateMemoryDate,
  validateMemoryPhotos,
  validateMemoryPlace,
  validateMemoryTagList,
  validateMemoryText,
  validateMemoryTitle,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type MemoryField =
  | "title"
  | "text"
  | "date"
  | "time"
  | "place"
  | "category"
  | "emotionTags"
  | "placeTags"
  | "customTags"
  | "photos"
  | "sharedWith";

export default function EditMemoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [place, setPlace] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [emotionTags, setEmotionTags] = useState<string[]>([]);
  const [placeTagsInput, setPlaceTagsInput] = useState("");
  const [customTagsInput, setCustomTagsInput] = useState("");
  const [accessType, setAccessType] = useState<"private" | "shared" | "public">("private");
  const [sharedWith, setSharedWith] = useState<NormalizedMemoryShare[]>([]);
  const [memoryOwnerId, setMemoryOwnerId] = useState("");
  const [memoryOwnerUsername, setMemoryOwnerUsername] = useState("");
  const [originalAccessType, setOriginalAccessType] = useState<"private" | "shared" | "public">("private");
  const [originalSharedWith, setOriginalSharedWith] = useState<NormalizedMemoryShare[]>([]);
  const [photos, setPhotos] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<MemoryField>>({});
  const [draggedPhotoIndex, setDraggedPhotoIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isOwner = user?.uid === memoryOwnerId;

  useEffect(() => {
    async function loadMemory() {
      if (!id) {
        setError("Идентификатор воспоминания не найден");
        setLoading(false);
        return;
      }

      if (!user) {
        setError("Вы не авторизованы");
        setLoading(false);
        return;
      }

      try {
        const [memory, userCategories] = await Promise.all([
          getAccessibleMemoryById(id, user.uid),
          getUserCategories(user.uid),
        ]);

        setCategories(userCategories);

        if (!memory) {
          setError("Воспоминание не найдено");
          setLoading(false);
          return;
        }

        if (!canUserEditMemory(memory, user.uid)) {
          setError("Нет доступа к этому воспоминанию");
          setLoading(false);
          return;
        }

        setTitle(memory.title);
        setText(memory.text);
        setDate(memory.date);
        setTime(memory.time);
        setPlace(memory.place);
        setMemoryOwnerId(memory.ownerId);
        setMemoryOwnerUsername(memory.ownerUsername);
        setSelectedCategories(getCategories(memory));
        setEmotionTags(getEmotionTags(memory));
        setPlaceTagsInput(getPlaceTags(memory).join(", "));
        setCustomTagsInput(getCustomTags(memory).join(", "));
        setAccessType(getAccessType(memory.accessType));
        setOriginalAccessType(getAccessType(memory.accessType));
        setSharedWith(getSharedWith(memory));
        setOriginalSharedWith(getSharedWith(memory));
        setPhotos(memory.photos.filter((photo): photo is StoredImage => typeof photo?.name === "string" && typeof photo?.dataUrl === "string"));
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Не удалось загрузить воспоминание"));
      } finally {
        setLoading(false);
      }
    }

    void loadMemory();
  }, [id, user]);

  async function handlePhotosSelect(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (files.length === 0) {
      return;
    }
    if (photos.length + files.length > MEMORY_PHOTO_MAX_FILES) {
      setFieldErrors((prev) => ({ ...prev, photos: `Можно сохранить не более ${MEMORY_PHOTO_MAX_FILES} фотографий` }));
      return;
    }

    const validationError = validateMemoryPhotos(files);
    if (validationError) {
      setFieldErrors((prev) => ({ ...prev, photos: validationError }));
      return;
    }

    try {
      const preparedPhotos: StoredImage[] = [];
      for (const file of files) {
        const prepared = await prepareImageForFirestore(file, {
          maxWidth: 1600,
          maxHeight: 1600,
          maxBytes: MEMORY_PHOTO_FIRESTORE_MAX_SIZE,
        });
        preparedPhotos.push({ name: prepared.name, dataUrl: prepared.dataUrl });
      }

      const nextPhotos = [...photos, ...preparedPhotos];
      const totalBytes = nextPhotos.reduce((sum, photo) => sum + getDataUrlSize(photo.dataUrl), 0);
      if (totalBytes > MEMORY_PHOTO_FIRESTORE_TOTAL_MAX_SIZE) {
        setFieldErrors((prev) => ({ ...prev, photos: "Суммарный размер фотографий слишком большой для Firestore. Оставьте до 3 небольших изображений." }));
        return;
      }

      setPhotos(nextPhotos);
      setFieldErrors((prev) => ({ ...prev, photos: "" }));
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === "IMAGE_TOO_LARGE"
        ? "Одну из фотографий не удалось достаточно сжать. Выберите изображение поменьше."
        : "Не удалось обработать фотографию. Попробуйте другой файл.";
      setFieldErrors((prev) => ({ ...prev, photos: message }));
    }
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, photoIndex) => photoIndex !== index));
    setFieldErrors((prev) => ({ ...prev, photos: "" }));
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) {
      return;
    }

    setPhotos((prev) => {
      const next = [...prev];
      const [movedPhoto] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedPhoto);
      return next;
    });
  }

  function toggleEmotionTag(tag: string) {
    setEmotionTags((prev) => (
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    ));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!id || !user) {
      setError("Не удалось определить запись для сохранения");
      return;
    }

    const newCategoryName = newCategory.trim();
    const resolvedCategories = normalizeCategories({
      categories: newCategoryName ? [...selectedCategories, newCategoryName] : selectedCategories,
    });
    const resolvedCategory = resolvedCategories[0] ?? "";
    const placeTags = parseTagInput(placeTagsInput);
    const customTags = parseTagInput(customTagsInput);
    const similarCategory = newCategoryName ? findSimilarCategory(categories, newCategoryName) : "";

    const nextErrors: ValidationErrors<MemoryField> = {
      title: validateMemoryTitle(title),
      text: validateMemoryText(text),
      date: validateMemoryDate(date),
      place: validateMemoryPlace(place),
      category: similarCategory
        ? `Похожая категория уже есть: ${similarCategory}`
        : validateMemoryCategory(newCategoryName || resolvedCategory),
      emotionTags: emotionTags.length > 0 ? "" : "Выберите хотя бы один тег эмоции",
      placeTags: validateMemoryTagList(placeTags, "Теги мест", MEMORY_PLACE_TAG_MAX),
      customTags: validateMemoryTagList(customTags, "Пользовательские теги"),
      photos: fieldErrors.photos || "",
      sharedWith: validateSharedMemoryAccess(accessType, sharedWith),
    };

    setFieldErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      return;
    }

    setSaving(true);

    try {
      if (newCategoryName) {
        const nextCategories = await appendUserCategory(user.uid, newCategoryName);
        setCategories(nextCategories);
      }

      let nextOwnerUsername = memoryOwnerUsername;
      let ownerAvatarDataUrl = "";

      if (isOwner) {
        const ownerProfile = await getUserProfileById(user.uid);
        nextOwnerUsername = ownerProfile?.username ?? memoryOwnerUsername;
        ownerAvatarDataUrl = ownerProfile?.avatarDataUrl ?? "";
      }

      if (isOwner) {
        const accessPayload = buildMemoryAccessPayload(accessType, sharedWith);
        const newlySharedUsers = accessType === "shared"
          ? accessPayload.sharedWith.filter(
              (item) => !originalSharedWith.some((currentItem) => currentItem.userId === item.userId)
            )
          : [];

        await updateDoc(doc(db, "memories", id), {
          ownerUsername: nextOwnerUsername,
          title: title.trim(),
          text: text.trim(),
          date,
          time,
          place: place.trim(),
          category: resolvedCategory.trim(),
          categories: resolvedCategories,
          emotion: emotionTags[0] ?? "",
          emotionTags,
          placeTags,
          customTags,
          ...accessPayload,
          photos,
          photoNames: photos.map((photo) => photo.name),
        });

        if (newlySharedUsers.length > 0) {
          const preview = buildNotificationPreview(text, place, [...emotionTags, ...placeTags, ...customTags]);

          await Promise.all(
            newlySharedUsers.map((item) => createSharedMemoryNotification({
              userId: item.userId,
              actorUserId: user.uid,
              actorUsername: nextOwnerUsername,
              actorAvatarDataUrl: ownerAvatarDataUrl,
              memoryId: id,
              memoryTitle: title.trim(),
              memoryDate: date,
              memoryPreview: preview,
            }))
          );
        }
      } else {
        await updateDoc(doc(db, "memories", id), {
          title: title.trim(),
          text: text.trim(),
          date,
          time,
          place: place.trim(),
          category: resolvedCategory.trim(),
          categories: resolvedCategories,
          emotion: emotionTags[0] ?? "",
          emotionTags,
          placeTags,
          customTags,
          photos,
          photoNames: photos.map((photo) => photo.name),
        });
      }

      navigate(returnTo || (isOwner ? "/memories" : "/shared-memories"));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith("CATEGORY_EXISTS:")) {
        setFieldErrors((prev) => ({
          ...prev,
          category: `Похожая категория уже есть: ${err.message.replace("CATEGORY_EXISTS:", "")}`,
        }));
      } else {
        setError(getErrorMessage(err, "Не удалось обновить воспоминание"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Загрузка...</p>;
  }

  const placeTagsPreview = parseTagInput(placeTagsInput);
  const customTagsPreview = parseTagInput(customTagsInput);
  const categoryOptions = Array.from(new Set([...categories, ...selectedCategories].filter(Boolean))).sort((left, right) => left.localeCompare(right, "ru"));
  const returnTo = searchParams.get("returnTo");

  return (
    <>
      <h1 className="title">Редактирование воспоминания</h1>
      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <input className={`input ${fieldErrors.title ? "inputError" : ""}`} placeholder="Заголовок" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={MEMORY_TITLE_MAX} />
          <div className="hint">{title.length}/{MEMORY_TITLE_MAX}</div>
          {fieldErrors.title && <div className="error">{fieldErrors.title}</div>}
        </div>

        <div className="field">
          <textarea className={`textarea ${fieldErrors.text ? "inputError" : ""}`} placeholder="Текст воспоминания" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={MEMORY_TEXT_MAX} />
          <div className="hint">Необязательное поле, {text.length}/{MEMORY_TEXT_MAX}</div>
          {fieldErrors.text && <div className="error">{fieldErrors.text}</div>}
        </div>

        <div className="field">
          <input className={`input ${fieldErrors.date ? "inputError" : ""}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {fieldErrors.date && <div className="error">{fieldErrors.date}</div>}
        </div>

        <div className="field">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <div className="hint">Необязательное поле времени события</div>
        </div>

        <div className="field">
          <input className={`input ${fieldErrors.place ? "inputError" : ""}`} placeholder="Основное место события" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={MEMORY_PLACE_MAX} />
          <div className="hint">Необязательное поле, {place.length}/{MEMORY_PLACE_MAX}</div>
          {fieldErrors.place && <div className="error">{fieldErrors.place}</div>}
        </div>

        <div className="field">
          {categoryOptions.length > 0 && (
            <div className={`memoryCategoryChecklist ${fieldErrors.category ? "inputError" : ""}`}>
              {categoryOptions.map((category) => (
                <label className="memoryCategoryOption" key={category}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={(event) => {
                      setSelectedCategories((prev) => (
                        event.target.checked
                          ? normalizeCategories({ categories: [...prev, category] })
                          : prev.filter((item) => item !== category)
                      ));
                    }}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </div>
          )}
          <input className={`input ${fieldErrors.category ? "inputError" : ""}`} placeholder="Или создайте новую категорию" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} maxLength={MEMORY_CATEGORY_MAX} />
          <div className="hint">Можно выбрать несколько категорий или создать новую</div>
          {fieldErrors.category && <div className="error">{fieldErrors.category}</div>}
        </div>

        <div className="field">
          <div className="label">Теги эмоций</div>
          <div className="chipGroup">
            {EMOTIONS.map((item) => (
              <button
                key={item}
                type="button"
                className={`chipButton ${emotionTags.includes(item) ? "chipButtonActive" : ""}`}
                data-emotion={item}
                onClick={() => toggleEmotionTag(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="hint">Можно выбрать несколько эмоций</div>
          {fieldErrors.emotionTags && <div className="error">{fieldErrors.emotionTags}</div>}
        </div>

        <div className="field">
          <input className={`input ${fieldErrors.placeTags ? "inputError" : ""}`} placeholder="Теги мест через запятую: парк, Москва, море" value={placeTagsInput} onChange={(e) => setPlaceTagsInput(e.target.value)} />
          <div className="hint">До 10 тегов, каждый до {MEMORY_PLACE_TAG_MAX} символов</div>
          {placeTagsPreview.length > 0 && <div className="tagPreview">{placeTagsPreview.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          {fieldErrors.placeTags && <div className="error">{fieldErrors.placeTags}</div>}
        </div>

        <div className="field">
          <input className={`input ${fieldErrors.customTags ? "inputError" : ""}`} placeholder="Пользовательские теги через запятую: семья, лето, подарок" value={customTagsInput} onChange={(e) => setCustomTagsInput(e.target.value)} />
          <div className="hint">До 10 тегов, каждый до {MEMORY_TAG_MAX} символов</div>
          {customTagsPreview.length > 0 && <div className="tagPreview">{customTagsPreview.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          {fieldErrors.customTags && <div className="error">{fieldErrors.customTags}</div>}
        </div>

        <div className="field">
          <div className="label">Тип доступа</div>
          <div className="accessTypeGrid">
            {MEMORY_ACCESS_TYPES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`accessTypeCard ${accessType === option.value ? "accessTypeCardActive" : ""}`}
                onClick={() => {
                  if (!isOwner) {
                    return;
                  }

                  setAccessType(option.value);
                }}
                disabled={!isOwner}
              >
                <span className="accessTypeTitle">{option.label}</span>
                <span className="accessTypeDescription">{option.description}</span>
              </button>
            ))}
          </div>
          {!isOwner && <div className="hint">Менять тип доступа может только владелец воспоминания.</div>}
        </div>

        <div className="field">
          {user && (
            <ManageMemoryAccess
              userId={user.uid}
              accessType={isOwner ? accessType : originalAccessType}
              sharedWith={isOwner ? sharedWith : originalSharedWith}
              error={fieldErrors.sharedWith}
              disabled={memoryOwnerId !== user.uid}
              onChange={(nextSharedWith) => {
                setSharedWith(nextSharedWith);
                setFieldErrors((prev) => ({ ...prev, sharedWith: "" }));
              }}
            />
          )}
        </div>

        <div className="field">
          <input ref={fileInputRef} className="hiddenFileInput" type="file" accept=".jpg,.jpeg,.png,.webp" multiple onChange={(e) => void handlePhotosSelect(e)} />
          <div className={`filePicker ${fieldErrors.photos ? "filePickerError" : ""}`}>
            <button type="button" className="filePickerButton" onClick={() => fileInputRef.current?.click()}>Добавить фото</button>
            <span className="filePickerText">{photos.length > 0 ? `Сохранено: ${photos.length}` : "До 3 фотографий"}</span>
          </div>
          <div className="hint">До {MEMORY_PHOTO_MAX_FILES} файлов, JPG/PNG/WebP, до {Math.round(MEMORY_PHOTO_MAX_SIZE / (1024 * 1024))} МБ каждый. Изображения автоматически сжимаются перед сохранением в Firestore.</div>
          {photos.length > 0 && <div className="hint">Сохранено фотографий: {photos.length}</div>}
          {photos.length > 0 && (
            <div className="imagePreviewGrid">
              {photos.map((photo, index) => (
                <div
                  className={`imagePreviewCard ${draggedPhotoIndex === index ? "imagePreviewCardDragging" : ""}`}
                  key={`${photo.name}-${index}`}
                  draggable
                  onDragStart={() => setDraggedPhotoIndex(index)}
                  onDragEnd={() => setDraggedPhotoIndex(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedPhotoIndex === null) {
                      return;
                    }

                    movePhoto(draggedPhotoIndex, index);
                    setDraggedPhotoIndex(null);
                  }}
                >
                  <button type="button" className="imagePreviewDelete" onClick={() => removePhoto(index)}>Удалить</button>
                  <img className="imagePreview" src={photo.dataUrl} alt={photo.name} />
                  <div className="imagePreviewOrder">#{index + 1}</div>
                  <div className="imagePreviewMeta">{photo.name}</div>
                </div>
              ))}
            </div>
          )}
          {fieldErrors.photos && <div className="error">{fieldErrors.photos}</div>}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="rowButtons">
          <button type="button" className="btnSecondary" onClick={() => navigate(returnTo || "/memories")} disabled={saving}>Отмена</button>
          <button className="btnPrimary" disabled={saving}>{saving ? "Сохраняем..." : "Сохранить"}</button>
        </div>
      </form>
    </>
  );
}

function buildNotificationPreview(text: string, place: string, tags: string[]) {
  const normalizedText = text.trim();
  if (normalizedText) {
    return normalizedText.slice(0, 120);
  }

  const firstTag = tags.find(Boolean);
  if (firstTag) {
    return `Тег: ${firstTag}`;
  }

  if (place.trim()) {
    return `Место: ${place.trim()}`;
  }

  return "Совместное воспоминание стало доступно";
}
