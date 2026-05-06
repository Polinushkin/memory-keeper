import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getUserProfileById } from "../../entities/user";
import { MemoriesList } from "../../widgets/memories-list";

type ReturnState = {
  returnTo?: string;
  profileOriginReturnTo?: string;
};

export default function UserPublicMemoriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { userId } = useParams();
  const [ownerUsername, setOwnerUsername] = useState("");

  useEffect(() => {
    let active = true;

    async function loadOwnerProfile() {
      if (!userId) {
        return;
      }

      try {
        const profile = await getUserProfileById(userId);
        if (!active) {
          return;
        }

        setOwnerUsername(profile?.username ?? "");
      } catch {
        if (active) {
          setOwnerUsername("");
        }
      }
    }

    void loadOwnerProfile();

    return () => {
      active = false;
    };
  }, [userId]);

  function handleBack() {
    const state = (location.state as ReturnState | null) ?? {};
    navigate(state.returnTo || `/users/${userId}`, {
      replace: true,
      state: state.profileOriginReturnTo ? { returnTo: state.profileOriginReturnTo } : undefined,
    });
  }

  if (!userId) {
    return (
      <div className="page">
        <div className="card">
          <div className="error">Публичные воспоминания пользователя не найдены</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageWide">
      <div className="publicProfileActions publicProfileActionsTop">
        <button type="button" className="btnSecondary" onClick={handleBack}>
          Назад
        </button>
      </div>
      <h1 className="titleCenter">Публичные воспоминания</h1>
      <MemoriesList scope="publicProfile" ownerId={userId} ownerUsernameOverride={ownerUsername} />
    </div>
  );
}
