import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getUserProfileById } from "../../entities/user";
import { MemoriesList } from "../../widgets/memories-list";

export default function UserPublicMemoriesPage() {
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
      <h1 className="titleCenter">Публичные воспоминания</h1>
      <MemoriesList scope="publicProfile" ownerId={userId} ownerUsernameOverride={ownerUsername} />
    </div>
  );
}
