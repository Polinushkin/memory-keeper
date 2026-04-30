import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeleteMemoryButton } from "../../features/delete-memory";
import { getOwnedMemoryById, MEMORY_ACCESS_TYPES, type NormalizedMemory } from "../../entities/memory";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

type MemoryDetailsViewProps = {
  memoryId: string;
  returnUrl: string;
  returnQueryString: string;
};

export default function MemoryDetailsView({
  memoryId,
  returnUrl,
  returnQueryString,
}: MemoryDetailsViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<NormalizedMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function loadMemory() {
      if (!user) {
        setError("Не удалось открыть воспоминание");
        setLoading(false);
        return;
      }

      try {
        const nextMemory = await getOwnedMemoryById(memoryId, user.uid);
        if (!nextMemory) {
          setError("Воспоминание не найдено");
          setLoading(false);
          return;
        }

        setMemory(nextMemory);
        setPhotoIndex(0);
      } catch (loadError: unknown) {
        if (loadError instanceof Error && loadError.message === "MEMORY_ACCESS_DENIED") {
          setError("Нет доступа к этому воспоминанию");
        } else {
          setError(getErrorMessage(loadError, "Не удалось загрузить воспоминание"));
        }
      } finally {
        setLoading(false);
      }
    }

    void loadMemory();
  }, [memoryId, user]);

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

  const activePhoto = memory.photos[photoIndex];

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
            <DeleteMemoryButton
              memoryId={memory.id}
              onDeleted={() => navigate(returnUrl)}
              onError={setError}
            />
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
