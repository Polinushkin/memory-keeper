import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { SignOutButton } from "../../features/sign-out";

export default function AppLayout() {
  const { user } = useAuth();

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

              <SignOutButton />
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
