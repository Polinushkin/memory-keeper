import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { areUsersFriends } from "../../entities/friend";
import { getUserProfileById, type UserSearchResult } from "../../entities/user";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

type UserPublicProfileViewProps = {
  userId: string;
};

type ReturnState = {
  returnTo?: string;
  profileOriginReturnTo?: string;
};

export default function UserPublicProfileView({ userId }: UserPublicProfileViewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserSearchResult | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const [nextProfile, friendship] = await Promise.all([
          getUserProfileById(userId, user?.uid),
          user?.uid ? areUsersFriends(user.uid, userId) : Promise.resolve(false),
        ]);

        if (!active) {
          return;
        }

        if (!nextProfile) {
          setError("Профиль пользователя не найден");
          setProfile(null);
          return;
        }

        setProfile(nextProfile);
        setIsFriend(friendship);
      } catch (loadError: unknown) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(loadError, "Не удалось загрузить профиль пользователя"));
        setProfile(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [user?.uid, userId]);

  function handleBack() {
    const returnTo = (location.state as ReturnState | null)?.returnTo;
    if (returnTo) {
      navigate(returnTo);
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/friends");
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  if (error || !profile) {
    return (
      <div className="card">
        <div className="error">{error || "Профиль пользователя не найден"}</div>
      </div>
    );
  }

  const isOwner = user?.uid === userId;
  const descriptionHidden =
    !profile.description &&
    !isOwner &&
    (profile.descriptionVisibility === "private" ||
      (profile.descriptionVisibility === "friends" && !isFriend));

  return (
    <section className="card sectionCard publicProfileCard">
      <div className="publicProfileActions publicProfileActionsTop">
        <button type="button" className="btnSecondary" onClick={handleBack}>
          Назад
        </button>
      </div>

      <div className="publicProfileHeader">
        {profile.avatarDataUrl ? (
          <img className="publicProfileAvatar" src={profile.avatarDataUrl} alt={profile.username} />
        ) : (
          <div className="publicProfileAvatarPlaceholder">{profile.username.slice(0, 1).toUpperCase()}</div>
        )}

        <div className="publicProfileBody">
          <div className="sectionTitle">@{profile.username}</div>
          {profile.description ? <div className="sectionText">{profile.description}</div> : null}
          {descriptionHidden ? <div className="sectionText">Описание пользователя скрыто</div> : null}
        </div>
      </div>

      <div className="publicProfileActions">
        <button
          type="button"
          className="btnSecondary"
          onClick={() =>
            navigate(`/users/${userId}/memories`, {
              state: {
                returnTo: `${location.pathname}${location.search}`,
                profileOriginReturnTo: (location.state as ReturnState | null)?.returnTo ?? "",
              },
            })
          }
        >
          Публичные воспоминания
        </button>
      </div>
    </section>
  );
}
