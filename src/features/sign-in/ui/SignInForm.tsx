import { useState } from "react";
import type { FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../../../shared/api/firebase/firebase";
import { getAuthErrorMessage, getErrorMessage } from "../../../shared/lib/firebase-errors";
import { getEmailByUsername } from "../../../shared/lib/usernames";
import { normalizeUsername, type ValidationErrors } from "../../../shared/lib/validation";

type SignInField = "login" | "password";

export default function SignInForm() {
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<SignInField>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const nextErrors: ValidationErrors<SignInField> = {
      login: login.trim() ? "" : "Введите имя пользователя или email",
      password: password ? "" : "Введите пароль",
    };

    setFieldErrors(nextErrors);

    if (Object.values(nextErrors).some(Boolean)) {
      return;
    }

    setLoading(true);

    try {
      const loginValue = login.trim();
      let emailForAuth = loginValue;

      if (!loginValue.includes("@")) {
        try {
          emailForAuth = await getEmailByUsername(normalizeUsername(loginValue));

          if (!emailForAuth) {
            setError("Пользователь не найден");
            setLoading(false);
            return;
          }
        } catch (lookupError) {
          setError(
            getErrorMessage(
              lookupError,
              "Не удалось выполнить вход по имени пользователя. Попробуйте email"
            )
          );
          setLoading(false);
          return;
        }
      }

      await signInWithEmailAndPassword(auth, emailForAuth, password);
      navigate("/memories");
    } catch (err: unknown) {
      setError(getAuthErrorMessage(err, "Не удалось войти"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="title">Вход</h1>

      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <input
            className={`input ${fieldErrors.login ? "inputError" : ""}`}
            placeholder="Имя пользователя или email"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
          />
          {fieldErrors.login && <div className="error">{fieldErrors.login}</div>}
        </div>

        <div className="field">
          <div className="pwRow">
            <input
              className={`input ${fieldErrors.password ? "inputError" : ""}`}
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="linkBtn"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? "Скрыть" : "Показать"}
            </button>
          </div>
          {fieldErrors.password && <div className="error">{fieldErrors.password}</div>}
        </div>

        {error && <div className="error">{error}</div>}

        <Link className="smallLink" to="/register">
          Нет аккаунта? Зарегистрироваться
        </Link>

        <button className="btnPrimary" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
    </>
  );
}
