import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";

export default function SignOutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <button className="navBtn" onClick={() => void handleLogout()}>
      Выйти
    </button>
  );
}
