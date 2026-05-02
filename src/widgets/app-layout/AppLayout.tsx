import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../app/providers/auth-provider/useAuth";
import { subscribeToNotifications } from "../../entities/notification";
import { SignOutButton } from "../../features/sign-out";

export default function AppLayout() {
  const { user } = useAuth();
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotificationsCount(0);
      return;
    }

    return subscribeToNotifications(
      user.uid,
      (items) => setUnreadNotificationsCount(items.filter((item) => !item.isRead).length),
      () => setUnreadNotificationsCount(0)
    );
  }, [user]);

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

              <NavLink className="navBtn" to="/shared-memories">
                Доступные воспоминания
              </NavLink>

              <NavLink className="navBtn" to="/friends">
                Друзья
              </NavLink>

              <NavLink className="navBtn navBtnWithBadge" to="/profile">
                <span>Профиль</span>
                {unreadNotificationsCount > 0 && (
                  <span className="navBadge">{unreadNotificationsCount}</span>
                )}
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
