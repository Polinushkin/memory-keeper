import { useEffect, useRef, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { db } from "../../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { prepareImageForFirestore } from "../../../shared/lib/images";
import { reserveUsername, updateUsernameMetadata } from "../../../shared/lib/usernames";
import {
  PROFILE_DESCRIPTION_MAX,
  PROFILE_PHOTO_FIRESTORE_MAX_SIZE,
  hasValidationErrors,
  normalizeUsername,
  validateProfileDescription,
  validateProfilePhoto,
  validateUsername,
  type ValidationErrors,
} from "../../../shared/lib/validation";

type UserProfile = { username?: string; email?: string; description?: string; avatarFileName?: string; avatarDataUrl?: string; createdAt?: unknown };
type PendingAvatar = { name: string; dataUrl: string };
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
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<ProfileField>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          await setDoc(ref, { username: "", usernameLower: "", email: user.email ?? "", description: "", avatarFileName: "", avatarDataUrl: "", createdAt: serverTimestamp() });
          setUsername("");
          setInitialUsername("");
          setEmail(user.email ?? "");
          setDescription("");
          setAvatarFileName("");
          setAvatarDataUrl("");
        } else {
          const data = snap.data() as UserProfile;
          const nextUsername = String(data.username ?? "");
          setUsername(nextUsername);
          setInitialUsername(nextUsername);
          setEmail(String(data.email ?? user.email ?? ""));
          setDescription(String(data.description ?? ""));
          setAvatarFileName(String(data.avatarFileName ?? ""));
          setAvatarDataUrl(String(data.avatarDataUrl ?? ""));
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Не удалось загрузить профиль"));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [user]);

  async function handleAvatarChange(file: File | null) {
    setPhotoFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) {
      setPendingAvatar(null);
      setFieldErrors((prev) => ({ ...prev, photo: "" }));
      return;
    }
    const validationError = validateProfilePhoto(file);
    if (validationError) {
      setPendingAvatar(null);
      setFieldErrors((prev) => ({ ...prev, photo: validationError }));
      return;
    }
    try {
      const prepared = await prepareImageForFirestore(file, { maxWidth: 640, maxHeight: 640, maxBytes: PROFILE_PHOTO_FIRESTORE_MAX_SIZE });
      setPendingAvatar({ name: prepared.name, dataUrl: prepared.dataUrl });
      setFieldErrors((prev) => ({ ...prev, photo: "" }));
    } catch (err: unknown) {
      const message = err instanceof Error && err.message === "IMAGE_TOO_LARGE"
        ? "Аватар не удалось достаточно сжать. Выберите изображение поменьше."
        : "Не удалось обработать изображение профиля. Попробуйте другой файл.";
      setPendingAvatar(null);
      setFieldErrors((prev) => ({ ...prev, photo: message }));
    }
  }

  function removeAvatar() {
    setPhotoFile(null);
    setPendingAvatar(null);
    setAvatarFileName("");
    setAvatarDataUrl("");
    setFieldErrors((prev) => ({ ...prev, photo: "" }));
  }

  async function onSave() {
    if (!user) return;
    const nextErrors: ValidationErrors<ProfileField> = {
      username: validateUsername(username),
      description: validateProfileDescription(description),
      photo: validateProfilePhoto(photoFile) || fieldErrors.photo || "",
    };
    setFieldErrors(nextErrors);
    setError(null);
    setMsg(null);
    if (hasValidationErrors(nextErrors)) return;
    setSaving(true);
    try {
      if (normalizeUsername(username) !== normalizeUsername(initialUsername)) {
        await reserveUsername({
          uid: user.uid,
          username,
          email,
          currentUsername: initialUsername,
          avatarDataUrl: pendingAvatar?.dataUrl ?? avatarDataUrl,
          description,
        });
      }
      await updateDoc(doc(db, "users", user.uid), {
        username: username.trim(),
        usernameLower: normalizeUsername(username),
        description: description.trim(),
        avatarFileName: pendingAvatar?.name ?? avatarFileName,
        avatarDataUrl: pendingAvatar?.dataUrl ?? avatarDataUrl,
      });
      await updateUsernameMetadata(username.trim(), {
        avatarDataUrl: pendingAvatar?.dataUrl ?? avatarDataUrl,
        description: description.trim(),
      });
      if (pendingAvatar) {
        setAvatarFileName(pendingAvatar.name);
        setAvatarDataUrl(pendingAvatar.dataUrl);
        setPhotoFile(null);
        setPendingAvatar(null);
      }
      setInitialUsername(username.trim());
      setMsg("Изменения сохранены");
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "USERNAME_TAKEN") {
        setFieldErrors((prev) => ({ ...prev, username: "Это имя пользователя уже используется" }));
      } else {
        setError(getErrorMessage(e, "Не удалось сохранить изменения"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">Загрузка...</div>;

  return (
    <>
      <h1 className="title">Профиль</h1>
      <div className="form">
        <label className="label">Email</label>
        <input className="input" value={email} disabled />
        <label className="label">Имя пользователя</label>
        <div className="field">
          <input className={`input ${fieldErrors.username ? "inputError" : ""}`} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ваше имя пользователя" />
          <div className="hint">От 3 до 20 символов: латиница, цифры и `_`</div>
          {fieldErrors.username && <div className="error">{fieldErrors.username}</div>}
        </div>
        <label className="label">Краткое описание</label>
        <div className="field">
          <textarea className={`textarea ${fieldErrors.description ? "inputError" : ""}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Расскажите немного о себе" rows={4} maxLength={PROFILE_DESCRIPTION_MAX} />
          <div className="hint">{description.length}/{PROFILE_DESCRIPTION_MAX}</div>
          {fieldErrors.description && <div className="error">{fieldErrors.description}</div>}
        </div>
        <label className="label">Фото профиля</label>
        <div className="field">
          {(pendingAvatar?.dataUrl || avatarDataUrl) && (
            <div className="avatarPreviewBlock">
              <img className="avatarPreview" src={pendingAvatar?.dataUrl ?? avatarDataUrl} alt="Аватар профиля" />
              <button type="button" className="btnSmallDanger" onClick={removeAvatar}>Удалить фото</button>
            </div>
          )}
          <input ref={fileInputRef} className="hiddenFileInput" type="file" accept=".jpg,.jpeg,.png" onChange={(e) => void handleAvatarChange(e.target.files?.[0] ?? null)} />
          <div className={`filePicker ${fieldErrors.photo ? "filePickerError" : ""}`}>
            <button type="button" className="filePickerButton" onClick={() => fileInputRef.current?.click()}>{pendingAvatar || avatarDataUrl ? "Заменить фото" : "Выбрать фото"}</button>
            <span className="filePickerText">{pendingAvatar?.name || avatarFileName || "JPG или PNG"}</span>
          </div>
          <div className="hint">JPG или PNG, до 5 МБ. Перед сохранением аватар автоматически сжимается для Firestore.</div>
          {fieldErrors.photo && <div className="error">{fieldErrors.photo}</div>}
        </div>
        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}
        <button className="btnPrimary" onClick={onSave} disabled={saving}>{saving ? "Сохраняем..." : "Сохранить"}</button>
      </div>
    </>
  );
}
