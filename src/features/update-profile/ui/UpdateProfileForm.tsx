import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { reserveUsername } from "../../../shared/lib/usernames";
import {
  PROFILE_DESCRIPTION_MAX,
  hasValidationErrors,
  normalizeUsername,
  validateProfileDescription,
  validateProfilePhoto,
  validateUsername,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type UserProfile = {
  username?: string;
  email?: string;
  description?: string;
  avatarFileName?: string;
  createdAt?: unknown;
};

type ProfileField = "username" | "description" | "photo";

export default function UpdateProfileForm() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [avatarFileName, setAvatarFileName] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<ProfileField>>(
    {}
  );

  useEffect(() => {
    async function load() {
      if (!user) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            username: "",
            usernameLower: "",
            email: user.email ?? "",
            description: "",
            avatarFileName: "",
            createdAt: serverTimestamp(),
          });

          setUsername("");
          setInitialUsername("");
          setEmail(user.email ?? "");
          setDescription("");
          setAvatarFileName("");
        } else {
          const data = snap.data() as UserProfile;
          const nextUsername = String(data.username ?? "");
          setUsername(nextUsername);
          setInitialUsername(nextUsername);
          setEmail(String(data.email ?? user.email ?? ""));
          setDescription(String(data.description ?? ""));
          setAvatarFileName(String(data.avatarFileName ?? ""));
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Не удалось загрузить профиль"));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  async function onSave() {
    if (!user) return;

    const nextErrors: ValidationErrors<ProfileField> = {
      username: validateUsername(username),
      description: validateProfileDescription(description),
      photo: validateProfilePhoto(photoFile),
    };

    setFieldErrors(nextErrors);
    setError(null);
    setMsg(null);

    if (hasValidationErrors(nextErrors)) {
      return;
    }

    setSaving(true);

    try {
      if (normalizeUsername(username) !== normalizeUsername(initialUsername)) {
        await reserveUsername({
          uid: user.uid,
          username,
          email,
          currentUsername: initialUsername,
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        usernameLower: normalizeUsername(username),
        description: description.trim(),
        avatarFileName: photoFile?.name ?? avatarFileName,
      });

      if (photoFile) {
        setAvatarFileName(photoFile.name);
        setPhotoFile(null);
      }

      setInitialUsername(username.trim());
      setMsg("Изменения сохранены");
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "USERNAME_TAKEN") {
        setFieldErrors((prev) => ({
          ...prev,
          username: "Это имя пользователя уже используется",
        }));
      } else {
        setError(getErrorMessage(e, "Не удалось сохранить изменения"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="card">Загрузка...</div>;
  }

  return (
    <>
      <h1 className="title">Профиль</h1>

      <div className="form">
        <label className="label">Email</label>
        <input className="input" value={email} disabled />

        <label className="label">Имя пользователя</label>
        <div className="field">
          <input
            className={`input ${fieldErrors.username ? "inputError" : ""}`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ваше имя пользователя"
          />
          <div className="hint">От 3 до 20 символов: латиница, цифры и `_`</div>
          {fieldErrors.username && <div className="error">{fieldErrors.username}</div>}
        </div>

        <label className="label">Краткое описание</label>
        <div className="field">
          <textarea
            className={`textarea ${fieldErrors.description ? "inputError" : ""}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Расскажите немного о себе"
            rows={4}
            maxLength={PROFILE_DESCRIPTION_MAX}
          />
          <div className="hint">
            {description.length}/{PROFILE_DESCRIPTION_MAX}
          </div>
          {fieldErrors.description && (
            <div className="error">{fieldErrors.description}</div>
          )}
        </div>

        <label className="label">Фото профиля</label>
        <div className="field">
          <input
            className={`input ${fieldErrors.photo ? "inputError" : ""}`}
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
          <div className="hint">JPG или PNG, до 5 МБ</div>
          {avatarFileName && !photoFile && (
            <div className="hint">Текущий файл: {avatarFileName}</div>
          )}
          {photoFile && <div className="hint">Выбран файл: {photoFile.name}</div>}
          {fieldErrors.photo && <div className="error">{fieldErrors.photo}</div>}
        </div>

        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}

        <button className="btnPrimary" onClick={onSave} disabled={saving}>
          {saving ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </>
  );
}
