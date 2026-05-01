import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeleteMemoryButton } from "../../features/delete-memory";
import {
  canUserCommentMemory,
  canUserEditMemory,
  createMemoryComment,
  getAccessibleMemoryById,
  MEMORY_ACCESS_TYPES,
  subscribeToMemoryComments,
  type NormalizedMemory,
  type NormalizedMemoryComment,
} from "../../entities/memory";
import { getUserProfileById } from "../../entities/user";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

const MEMORY_COMMENT_MAX = 500;

type MemoryDetailsViewProps = {
  memoryId: string;
  returnUrl: string;
};

export default function MemoryDetailsView({
  memoryId,
  returnUrl,
}: MemoryDetailsViewProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [memory, setMemory] = useState<NormalizedMemory | null>(null);
  const [comments, setComments] = useState<NormalizedMemoryComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    async function loadMemory() {
      if (!user) {
        setError("Не удалось открыть воспоминание");
        setLoading(false);
        return;
      }

      try {
        const nextMemory = await getAccessibleMemoryById(memoryId, user.uid);
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

  useEffect(() => {
    if (!user || !memory) {
      setComments([]);
      setCommentsLoading(false);
      return;
    }

    setCommentsLoading(true);
    setCommentsError(null);

    const unsubscribe = subscribeToMemoryComments(
      memory.id,
      (nextComments) => {
        setComments(nextComments);
        setCommentsLoading(false);
      },
      (loadError) => {
        setComments([]);
        setCommentsError(getErrorMessage(loadError, "Не удалось загрузить комментарии"));
        setCommentsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [memory, user]);

  const canEdit = useMemo(() => (
    user && memory ? canUserEditMemory(memory, user.uid) : false
  ), [memory, user]);

  const canComment = useMemo(() => (
    user && memory ? canUserCommentMemory(memory, user.uid) : false
  ), [memory, user]);

  const isOwner = Boolean(user && memory && memory.ownerId === user.uid);

  async function handleCommentSubmit() {
    if (!user || !memory) {
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentsError("Введите текст комментария");
      return;
    }

    if (trimmed.length > MEMORY_COMMENT_MAX) {
      setCommentsError(`Комментарий должен быть не длиннее ${MEMORY_COMMENT_MAX} символов`);
      return;
    }

    setCommentSaving(true);
    setCommentsError(null);

    try {
      const profile = await getUserProfileById(user.uid);
      await createMemoryComment({
        memoryId: memory.id,
        authorId: user.uid,
        authorUsername: profile?.username ?? "",
        authorAvatarDataUrl: profile?.avatarDataUrl ?? "",
        text: trimmed,
      });
      setCommentText("");
    } catch (saveError: unknown) {
      setCommentsError(getErrorMessage(saveError, "Не удалось сохранить комментарий"));
    } finally {
      setCommentSaving(false);
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

  const activePhoto = memory.photos[photoIndex];

  return (
    <div className="page">
      <div className="card formCardWide memoryDetailsPageCard">
        <div className="memoryDetailsHeader">
          <button type="button" className="btnSecondary" onClick={() => navigate(returnUrl)}>
            Назад
          </button>
          <div className="memoryDetailsActions">
            {canEdit && (
              <button
                type="button"
                className="btnPrimary"
                onClick={() => navigate(`/memories/${memory.id}/edit?returnTo=${encodeURIComponent(returnUrl)}`)}
              >
                Редактировать
              </button>
            )}
            {isOwner && (
              <DeleteMemoryButton
                memoryId={memory.id}
                onDeleted={() => navigate(returnUrl)}
                onError={setError}
              />
            )}
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

        <div className="memoryDetailsBlock memoryDetailsMetaBlock">
          <div className="memoryInlineMeta">
            Автор:{" "}
            {memory.ownerId ? (
              <button
                type="button"
                className="inlineLinkButton"
                onClick={() => navigate(user && memory.ownerId === user.uid ? "/profile" : `/users/${memory.ownerId}`)}
              >
                {memory.ownerUsername ? `@${memory.ownerUsername}` : "профиль автора"}
              </button>
            ) : (
              "не указан"
            )}
          </div>
          <div className="memoryInlineMeta">Уровень доступа: {getAccessTypeLabel(memory.accessType)}</div>
        </div>

        {isOwner && memory.sharedWith.length > 0 && (
          <div className="memoryDetailsBlock memoryDetailsMetaBlock">
            <div className="memoryAccessSubtitle">Кому открыт доступ</div>
            <div className="tagPreview">
              {memory.sharedWith.map((share) => (
                <span key={share.userId}>
                  @{share.username} · {getShareRoleLabel(share.role)}
                </span>
              ))}
            </div>
          </div>
        )}

        {memory.emotionTags.length > 0 && <DetailTagRow label="Эмоции" tags={memory.emotionTags} tone="emotion" />}
        {memory.placeTags.length > 0 && <DetailTagRow label="Места" tags={memory.placeTags} />}
        {memory.customTags.length > 0 && <DetailTagRow label="Теги" tags={memory.customTags} />}

        <div className="memoryDetailsBlock memoryDetailsFooterBlock">
          {memory.place && <div className="memoryInlineMeta">Место: {memory.place}</div>}
          <div className="memoryInlineMeta">Дата события: {formatDate(memory.date)}</div>
          <div className="memoryInlineMeta">Дата создания: {formatCreatedAt(memory.createdAt)}</div>
        </div>

        <div className="memoryDetailsBlock memoryDetailsCommentsBlock">
          <div className="memoryAccessSubtitle">Комментарии</div>

          {canComment ? (
            <div className="memoryCommentComposer">
              <textarea
                className="textarea"
                placeholder="Напишите комментарий"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                maxLength={MEMORY_COMMENT_MAX}
                rows={3}
              />
              <div className="memoryCommentComposerFooter">
                <div className="hint">{commentText.length}/{MEMORY_COMMENT_MAX}</div>
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={() => void handleCommentSubmit()}
                  disabled={commentSaving}
                >
                  {commentSaving ? "Сохраняем..." : "Отправить"}
                </button>
              </div>
            </div>
          ) : (
            <div className="emptyState">Оставлять комментарии могут владелец и пользователи с правом comment/edit.</div>
          )}

          {commentsError && <div className="error">{commentsError}</div>}

          {commentsLoading ? (
            <div className="emptyState">Загрузка комментариев...</div>
          ) : comments.length === 0 ? (
            <div className="emptyState">Пока комментариев нет.</div>
          ) : (
            <div className="memoryCommentsList">
              {comments.map((comment) => (
                <div className="memoryCommentCard" key={comment.id}>
                  {comment.authorAvatarDataUrl ? (
                    <img className="memoryCommentAvatar" src={comment.authorAvatarDataUrl} alt={comment.authorUsername || "Автор"} />
                  ) : (
                    <div className="memoryCommentAvatarPlaceholder">
                      {(comment.authorUsername || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="memoryCommentBody">
                    <div className="memoryCommentHeader">
                      <span className="memoryCommentAuthor">@{comment.authorUsername || "user"}</span>
                      <span className="memoryCommentDate">{formatCreatedAt(comment.createdAt)}</span>
                    </div>
                    <div className="memoryCommentText">{comment.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
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

function getShareRoleLabel(role: string) {
  if (role === "edit") {
    return "Редактирование";
  }

  if (role === "comment") {
    return "Комментарий";
  }

  return "Просмотр";
}
