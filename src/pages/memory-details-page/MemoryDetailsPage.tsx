import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { deleteDoc, doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { normalizeMemory, type MemoryDocument, type NormalizedMemory } from "../../entities/memory/model/memory";
import { db } from "../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

type MemoryRecord = MemoryDocument & { ownerId?: string };

export default function MemoryDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [memory, setMemory] = useState<NormalizedMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function loadMemory() {
      if (!id || !user) {
        setError("Не удалось открыть воспоминание");
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
        if (data.ownerId !== user.uid) {
          setError("Нет доступа к этому воспоминанию");
          setLoading(false);
          return;
        }

        setMemory(normalizeMemory(snapshot.id, data));
        setPhotoIndex(0);
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Не удалось загрузить воспоминание"));
      } finally {
        setLoading(false);
      }
    }

    void loadMemory();
  }, [id, user]);

  const returnQueryString = searchParams.toString();
  const returnUrl = returnQueryString ? `/memories?${returnQueryString}` : "/memories";
  const activePhoto = memory?.photos?.[photoIndex];

  async function handleDelete() {
    if (!memory) {
      return;
    }

    const confirmed = window.confirm("Удалить это воспоминание?");
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "memories", memory.id));
      navigate(returnUrl);
    } catch (deleteError: unknown) {
      setError(getErrorMessage(deleteError, "Не удалось удалить воспоминание"));
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  if (error || !memory) {
    return (
      <div className="page">
        <div className="card">
          <div className="error">{error || "Воспоминание не найдено"}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card formCardWide memoryDetailsPageCard">
        <div className="memoryDetailsHeader">
          <button type="button" className="btnSecondary" onClick={() => navigate(returnUrl)}>
            Назад
          </button>
          <div className="memoryDetailsActions">
            <button
              type="button"
              className="btnPrimary"
              onClick={() => navigate(`/memories/${memory.id}/edit?returnTo=${encodeURIComponent(`/memories/${memory.id}${returnQueryString ? `?${returnQueryString}` : ""}`)}`)}
            >
              Редактировать
            </button>
            <button
              type="button"
              className="btnSmallDanger"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "..." : "Удалить"}
            </button>
          </div>
        </div>

        {activePhoto?.dataUrl && (
          <div className="memoryDetailsHero">
            <img className="memoryDetailsHeroImage" src={activePhoto.dataUrl} alt={activePhoto.name || memory.title} />
            {memory.photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="memoryCarouselButton memoryCarouselButtonLeft"
                  onClick={() => setPhotoIndex((value) => (value === 0 ? memory.photos.length - 1 : value - 1))}
                  aria-label="Предыдущее фото"
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="memoryCarouselButton memoryCarouselButtonRight"
                  onClick={() => setPhotoIndex((value) => (value === memory.photos.length - 1 ? 0 : value + 1))}
                  aria-label="Следующее фото"
                >
                  ›
                </button>
                <div className="memoryCarouselCounter">
                  {photoIndex + 1} / {memory.photos.length}
                </div>
                <div className="memoryCarouselThumbs">
                  {memory.photos.map((photo, index) => (
                    <button
                      key={`${photo.name ?? "photo"}-${index}`}
                      type="button"
                      className={`memoryCarouselThumb ${index === photoIndex ? "memoryCarouselThumbActive" : ""}`}
                      onClick={() => setPhotoIndex(index)}
                      aria-label={`Открыть фото ${index + 1}`}
                    >
                      <img src={photo.dataUrl} alt={photo.name || `${memory.title} ${index + 1}`} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="memoryCardTop memoryDetailsTop">
          {memory.category && <span className="pillBadge">{memory.category}</span>}
          <span className="pillBadge pillBadgeMuted">{getAccessTypeLabel(memory.accessType)}</span>
        </div>

        <h1 className="title">{memory.title}</h1>
        {memory.text && <div className="memoryDetailsText">{memory.text}</div>}

        {memory.emotionTags.length > 0 && <DetailTagRow label="Эмоции" tags={memory.emotionTags} tone="emotion" />}
        {memory.placeTags.length > 0 && <DetailTagRow label="Места" tags={memory.placeTags} />}
        {memory.customTags.length > 0 && <DetailTagRow label="Теги" tags={memory.customTags} />}

        <div className="memoryDetailsBlock memoryDetailsFooterBlock">
          {memory.place && <div className="memoryInlineMeta">Место: {memory.place}</div>}
          <div className="memoryInlineMeta">Дата события: {formatDate(memory.date)}</div>
          <div className="memoryInlineMeta">Дата создания: {formatCreatedAt(memory.createdAt)}</div>
        </div>
      </div>
    </div>
  );
}

function DetailTagRow({ label, tags, tone }: { label: string; tags: string[]; tone?: "emotion" | "default" }) {
  return (
    <div className="tagRow memoryDetailsTagRow">
      <span className="tagRowLabel">{label}:</span>
      <div className="tagPreview">
        {tags.map((tag) => (
          <span key={`${label}-${tag}`} className={tone === "emotion" ? "emotionPill" : ""} data-emotion={tone === "emotion" ? tag : undefined}>
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
  return value === "public" ? "Публичное" : value === "shared" ? "По ссылке / совместное" : "Приватное";
}
