import { useState } from "react";
import type { FormEvent } from "react";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../../shared/api/firebase/firebase";
import { getAuthErrorMessage, getErrorMessage } from "../../../shared/lib/firebase-errors";
import { reserveUsername } from "../../../shared/lib/usernames";
import {
  hasValidationErrors,
  normalizeUsername,
  validateConfirmPassword,
  validatePassword,
  validateUsername,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type SignUpField = "username" | "email" | "password" | "confirmPassword";

export default function SignUpForm() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<SignUpField>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    const nextErrors: ValidationErrors<SignUpField> = {
      username: validateUsername(username),
      email: email.trim() ? "" : "Введите email",
      password: validatePassword(password),
      confirmPassword: validateConfirmPassword(password, confirmPassword),
    };

    setFieldErrors(nextErrors);
    setError(null);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    setLoading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      try {
        await reserveUsername({
          uid: credential.user.uid,
          username,
          email,
          avatarDataUrl: "",
          description: "",
        });
      } catch (reserveError) {
        await deleteUser(credential.user).catch(() => undefined);

        if (
          reserveError instanceof Error &&
          reserveError.message === "USERNAME_TAKEN"
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            username: "Это имя пользователя уже используется",
          }));
          setLoading(false);
          return;
        }

        throw reserveError;
      }

      await setDoc(doc(db, "users", credential.user.uid), {
        uid: credential.user.uid,
        username: username.trim(),
        usernameLower: normalizeUsername(username),
        email: email.trim(),
        description: "",
        avatarFileName: "",
        avatarDataUrl: "",
        createdAt: serverTimestamp(),
      });

      navigate("/memories");
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          getAuthErrorMessage(err, "Не удалось зарегистрироваться")
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="title">Регистрация</h1>

      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <input
            className={`input ${fieldErrors.username ? "inputError" : ""}`}
            placeholder="Имя пользователя"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <div className="hint">От 3 до 20 символов: латиница, цифры и `_`</div>
          {fieldErrors.username && <div className="error">{fieldErrors.username}</div>}
        </div>

        <div className="field">
          <input
            className={`input ${fieldErrors.email ? "inputError" : ""}`}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {fieldErrors.email && <div className="error">{fieldErrors.email}</div>}
        </div>

        <div className="field">
          <div className="pwRow">
            <input
              className={`input ${fieldErrors.password ? "inputError" : ""}`}
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="linkBtn"
              onClick={() => setShowPw((v) => !v)}
            >
              {showPw ? "Скрыть" : "Показать"}
            </button>
          </div>
          <div className="hint">
            Не менее 8 символов, заглавная, строчная, цифра и спецсимвол
          </div>
          {fieldErrors.password && <div className="error">{fieldErrors.password}</div>}
        </div>

        <div className="field">
          <input
            className={`input ${fieldErrors.confirmPassword ? "inputError" : ""}`}
            placeholder="Подтвердите пароль"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
          />
          {fieldErrors.confirmPassword && (
            <div className="error">{fieldErrors.confirmPassword}</div>
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <Link className="smallLink" to="/login">
          Уже есть аккаунт? Войти
        </Link>

        <button className="btnPrimary" disabled={loading}>
          {loading ? "Создаём аккаунт..." : "Зарегистрироваться"}
        </button>
      </form>
    </>
  );
}
