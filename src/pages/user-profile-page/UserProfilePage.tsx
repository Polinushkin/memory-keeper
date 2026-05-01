import { useParams } from "react-router-dom";
import { UserPublicProfileView } from "../../widgets/user-public-profile-view";

export default function UserProfilePage() {
  const { userId } = useParams();

  if (!userId) {
    return (
      <div className="page">
        <div className="card">
          <div className="error">Профиль пользователя не найден</div>
        </div>
      </div>
    );
  }

  return (
    <div className="pageWide">
      <h1 className="titleCenter">Профиль пользователя</h1>
      <UserPublicProfileView userId={userId} />
    </div>
  );
}
