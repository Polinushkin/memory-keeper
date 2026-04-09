import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { db } from "../../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { getDataUrlSize, prepareImageForFirestore, type StoredImage } from "../../../shared/lib/images";
import {
  EMOTIONS,
  MEMORY_PHOTO_FIRESTORE_MAX_SIZE,
  MEMORY_PHOTO_FIRESTORE_TOTAL_MAX_SIZE,
  MEMORY_PHOTO_MAX_FILES,
  MEMORY_PHOTO_MAX_SIZE,
  MEMORY_PLACE_MAX,
  MEMORY_TEXT_MAX,
  MEMORY_TITLE_MAX,
  hasValidationErrors,
  validateMemoryDate,
  validateMemoryEmotion,
  validateMemoryPhotos,
  validateMemoryPlace,
  validateMemoryText,
  validateMemoryTitle,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type MemoryField = "title" | "text" | "date" | "place" | "emotion" | "photos";
type MemoryRecord = { ownerId?: string; title?: string; text?: string; date?: string; place?: string; emotion?: string; photos?: StoredImage[] };

export default function EditMemoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [emotion, setEmotion] = useState("");
  const [photos, setPhotos] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<MemoryField>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function loadMemory() {
      if (!id) {
        setError("Идентификатор воспоминания не найден");
        setLoading(false);
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "memories", id));
        if (!snapshot.exists()) {
          setError("Воспоминание не найдено");
          setLoading(false);
          return;
        }
        const data = snapshot.data() as MemoryRecord;
        if (!user || data.ownerId !== user.uid) {
          setError("Нет доступа к этому воспоминанию");
          setLoading(false);
          return;
        }
        setTitle(String(data.title ?? ""));
        setText(String(data.text ?? ""));
        setDate(String(data.date ?? ""));
        setPlace(String(data.place ?? ""));
        setEmotion(String(data.emotion ?? ""));
        setPhotos(Array.isArray(data.photos) ? data.photos.filter((photo): photo is StoredImage => typeof photo?.name === "string" && typeof photo?.dataUrl === "string") : []);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (files.length === 0) return;
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
        const prepared = await prepareImageForFirestore(file, { maxWidth: 1600, maxHeight: 1600, maxBytes: MEMORY_PHOTO_FIRESTORE_MAX_SIZE });
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!id) {
      setError("Идентификатор воспоминания не найден");
      return;
    }
    const nextErrors: ValidationErrors<MemoryField> = {
      title: validateMemoryTitle(title),
      text: validateMemoryText(text),
      date: validateMemoryDate(date),
      place: validateMemoryPlace(place),
      emotion: validateMemoryEmotion(emotion),
      photos: fieldErrors.photos || "",
    };
    setFieldErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "memories", id), {
        title: title.trim(),
        text: text.trim(),
        date,
        place: place.trim(),
        emotion,
        photos,
        photoNames: photos.map((photo) => photo.name),
      });
      navigate("/memories");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Не удалось обновить воспоминание"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Загрузка...</p>;

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
          <input className={`input ${fieldErrors.place ? "inputError" : ""}`} placeholder="Место" value={place} onChange={(e) => setPlace(e.target.value)} maxLength={MEMORY_PLACE_MAX} />
          <div className="hint">Необязательное поле, {place.length}/{MEMORY_PLACE_MAX}</div>
          {fieldErrors.place && <div className="error">{fieldErrors.place}</div>}
        </div>
        <div className="field">
          <select className={`input ${fieldErrors.emotion ? "inputError" : ""}`} value={emotion} onChange={(e) => setEmotion(e.target.value)}>
            <option value="">Выберите эмоцию</option>
            {EMOTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          {fieldErrors.emotion && <div className="error">{fieldErrors.emotion}</div>}
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
                <div className="imagePreviewCard" key={`${photo.name}-${index}`}>
                  <button type="button" className="imagePreviewDelete" onClick={() => removePhoto(index)}>Удалить</button>
                  <img className="imagePreview" src={photo.dataUrl} alt={photo.name} />
                  <div className="imagePreviewMeta">{photo.name}</div>
                </div>
              ))}
            </div>
          )}
          {fieldErrors.photos && <div className="error">{fieldErrors.photos}</div>}
        </div>
        {error && <div className="error">{error}</div>}
        <div className="rowButtons">
          <button type="button" className="btnSecondary" onClick={() => navigate("/memories")} disabled={saving}>Отмена</button>
          <button className="btnPrimary" disabled={saving}>{saving ? "Сохраняем..." : "Сохранить"}</button>
        </div>
      </form>
    </>
  );
}
