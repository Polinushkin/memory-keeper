import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfileById, type UserSearchResult } from "../../entities/user";
import { getErrorMessage } from "../../shared/lib/firebase-errors";

type UserPublicProfileViewProps = {
  userId: string;
};

export default function UserPublicProfileView({ userId }: UserPublicProfileViewProps) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserSearchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError(null);

      try {
        const nextProfile = await getUserProfileById(userId);
        if (!active) {
          return;
        }

        if (!nextProfile) {
          setError("Профиль пользователя не найден");
          setProfile(null);
          return;
        }

        setProfile(nextProfile);
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
  }, [userId]);

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

  return (
    <section className="card sectionCard publicProfileCard">
      <div className="publicProfileHeader">
        {profile.avatarDataUrl ? (
          <img className="publicProfileAvatar" src={profile.avatarDataUrl} alt={profile.username} />
        ) : (
          <div className="publicProfileAvatarPlaceholder">{profile.username.slice(0, 1).toUpperCase()}</div>
        )}

        <div className="publicProfileBody">
          <div className="sectionTitle">@{profile.username}</div>
          {profile.description && <div className="sectionText">{profile.description}</div>}
        </div>
      </div>

      <div className="publicProfileActions">
        <button
          type="button"
          className="btnSecondary"
          onClick={() => navigate(`/users/${userId}/memories`)}
        >
          Публичные воспоминания
        </button>
      </div>
    </section>
  );
}
