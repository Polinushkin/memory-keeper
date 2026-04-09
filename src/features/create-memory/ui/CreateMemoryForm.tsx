import { useState } from "react";
import type { FormEvent } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../../shared/api/firebase/firebase";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import {
  EMOTIONS,
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

export default function CreateMemoryForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [emotion, setEmotion] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<MemoryField>>(
    {}
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("Вы не авторизованы");
      return;
    }

    const nextErrors: ValidationErrors<MemoryField> = {
      title: validateMemoryTitle(title),
      text: validateMemoryText(text),
      date: validateMemoryDate(date),
      place: validateMemoryPlace(place),
      emotion: validateMemoryEmotion(emotion),
      photos: validateMemoryPhotos(photos),
    };

    setFieldErrors(nextErrors);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, "memories"), {
        ownerId: user.uid,
        title: title.trim(),
        text: text.trim(),
        date,
        place: place.trim(),
        emotion,
        photoNames: photos.map((file) => file.name),
        createdAt: serverTimestamp(),
      });

      navigate("/memories");
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Не удалось сохранить воспоминание"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="title">Создание воспоминания</h1>

      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <input
            className={`input ${fieldErrors.title ? "inputError" : ""}`}
            placeholder="Заголовок"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MEMORY_TITLE_MAX}
          />
          <div className="hint">
            {title.length}/{MEMORY_TITLE_MAX}
          </div>
          {fieldErrors.title && <div className="error">{fieldErrors.title}</div>}
        </div>

        <div className="field">
          <textarea
            className={`textarea ${fieldErrors.text ? "inputError" : ""}`}
            placeholder="Текст воспоминания"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            maxLength={MEMORY_TEXT_MAX}
          />
          <div className="hint">
            Необязательное поле, {text.length}/{MEMORY_TEXT_MAX}
          </div>
          {fieldErrors.text && <div className="error">{fieldErrors.text}</div>}
        </div>

        <div className="field">
          <input
            className={`input ${fieldErrors.date ? "inputError" : ""}`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {fieldErrors.date && <div className="error">{fieldErrors.date}</div>}
        </div>

        <div className="field">
          <input
            className={`input ${fieldErrors.place ? "inputError" : ""}`}
            placeholder="Место"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            maxLength={MEMORY_PLACE_MAX}
          />
          <div className="hint">
            Необязательное поле, {place.length}/{MEMORY_PLACE_MAX}
          </div>
          {fieldErrors.place && <div className="error">{fieldErrors.place}</div>}
        </div>

        <div className="field">
          <select
            className={`input ${fieldErrors.emotion ? "inputError" : ""}`}
            value={emotion}
            onChange={(e) => setEmotion(e.target.value)}
          >
            <option value="">Выберите эмоцию</option>
            {EMOTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          {fieldErrors.emotion && <div className="error">{fieldErrors.emotion}</div>}
        </div>

        <div className="field">
          <input
            className={`input ${fieldErrors.photos ? "inputError" : ""}`}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
          <div className="hint">
            До {MEMORY_PHOTO_MAX_FILES} файлов, JPG/PNG/WebP, до{" "}
            {Math.round(MEMORY_PHOTO_MAX_SIZE / (1024 * 1024))} МБ каждый
          </div>
          {photos.length > 0 && (
            <div className="hint">Выбрано файлов: {photos.length}</div>
          )}
          {photos.length > 0 && (
            <div className="fileList">
              {photos.map((file) => (
                <div className="fileItem" key={`${file.name}-${file.size}`}>
                  {file.name}
                </div>
              ))}
            </div>
          )}
          {fieldErrors.photos && <div className="error">{fieldErrors.photos}</div>}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="rowButtons">
          <button
            type="button"
            className="btnSecondary"
            onClick={() => navigate("/memories")}
            disabled={loading}
          >
            Отмена
          </button>

          <button className="btnPrimary" disabled={loading}>
            {loading ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </form>
    </>
  );
}
