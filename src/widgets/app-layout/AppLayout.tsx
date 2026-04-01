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
                My memories
              </NavLink>

              <NavLink className="navBtn" to="/profile">
                Profile
              </NavLink>

              <button className="navBtn" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink className="navBtn" to="/login">
                Login
              </NavLink>

              <NavLink className="navBtn" to="/register">
                Register
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