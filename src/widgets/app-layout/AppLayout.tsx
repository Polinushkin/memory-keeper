import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider/useAuth";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link className="brand" to={user ? "/memories" : "/login"}>
          Memory Keeper
        </Link>

        <div className="nav">
          {user ? (
            <>
              <NavLink className="navBtn" to="/memories">
                Мои воспоминания
              </NavLink>

              <NavLink className="navBtn" to="/profile">
                Профиль
              </NavLink>

              <button className="navBtn" onClick={handleLogout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <NavLink className="navBtn" to="/login">
                Вход
              </NavLink>

              <NavLink className="navBtn" to="/register">
                Регистрация
              </NavLink>
            </>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
