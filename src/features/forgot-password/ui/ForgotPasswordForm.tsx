import { useState } from "react";
import type { FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { Link } from "react-router-dom";
import { getEmailByUsername } from "../../../entities/user";
import { auth } from "../../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import {
  hasValidationErrors,
  normalizeUsername,
  validateUsername,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type ForgotPasswordField = "username";

export default function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<ForgotPasswordField>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    const nextErrors: ValidationErrors<ForgotPasswordField> = {
      username: validateUsername(username),
    };

    setFieldErrors(nextErrors);
    setError(null);
    setSuccess(null);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    setLoading(true);

    try {
      const email = await getEmailByUsername(normalizeUsername(username));

      if (!email) {
        setError("Пользователь с таким именем не найден");
        return;
      }

      await sendPasswordResetEmail(auth, email);
      setSuccess("Инструкция по восстановлению пароля отправлена.");
      setUsername("");
    } catch (submitError: unknown) {
      setError(
        getErrorMessage(
          submitError,
          "Не удалось отправить инструкцию по восстановлению пароля"
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="title">Восстановление пароля</h1>

      <form onSubmit={onSubmit} className="form">
        <div className="field">
          <input
            className={`input ${fieldErrors.username ? "inputError" : ""}`}
            placeholder="Имя пользователя"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
          <div className="hint">Введите username, и мы отправим инструкцию по восстановлению.</div>
          {fieldErrors.username && <div className="error">{fieldErrors.username}</div>}
        </div>

        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <Link className="smallLink" to="/login">
          Вернуться ко входу
        </Link>

        <button className="btnPrimary" disabled={loading}>
          {loading ? "Отправляем..." : "Восстановить пароль"}
        </button>
      </form>
    </>
  );
}
