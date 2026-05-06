import { useEffect, useRef, useState } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";
import { DeleteAccountButton } from "../../delete-account";
import { db } from "../../../shared/api/firebase/firebase";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { prepareImageForFirestore } from "../../../shared/lib/images";
import { reserveUsername, updateUsernameMetadata } from "../../../entities/user";
import {
  getProfileVisibility,
  getSharedInvitePolicy,
  type ProfileVisibility,
  type SharedInvitePolicy,
} from "../../../entities/user";
import {
  PROFILE_DESCRIPTION_MAX,
  PROFILE_PHOTO_FIRESTORE_MAX_SIZE,
  hasValidationErrors,
  normalizeUsername,
  validateConfirmPassword,
  validatePassword,
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
  avatarDataUrl?: string;
  descriptionVisibility?: unknown;
  avatarVisibility?: unknown;
  sharedInvitePolicy?: unknown;
  createdAt?: unknown;
};

type PendingAvatar = {
  name: string;
  dataUrl: string;
};

type ProfileField =
  | "username"
  | "description"
  | "photo"
  | "currentPassword"
  | "newPassword"
  | "confirmNewPassword";

type SaveSection = "profile" | "privacy" | "password" | "";

const PROFILE_VISIBILITY_OPTIONS: Array<{ value: ProfileVisibility; label: string }> = [
  { value: "public", label: "Всем" },
  { value: "friends", label: "Только друзьям" },
  { value: "private", label: "Только мне" },
];

const SHARED_INVITE_OPTIONS: Array<{ value: SharedInvitePolicy; label: string }> = [
  { value: "friends", label: "Друзья" },
  { value: "none", label: "Никто" },
];

export default function UpdateProfileForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [initialUsername, setInitialUsername] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionVisibility, setDescriptionVisibility] = useState<ProfileVisibility>("public");
  const [avatarVisibility, setAvatarVisibility] = useState<ProfileVisibility>("public");
  const [sharedInvitePolicy, setSharedInvitePolicy] = useState<SharedInvitePolicy>("friends");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPasswords, setShowNewPasswords] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [avatarFileName, setAvatarFileName] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [pendingAvatar, setPendingAvatar] = useState<PendingAvatar | null>(null);
  const [savingSection, setSavingSection] = useState<SaveSection>("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors<ProfileField>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) {
        return;
      }

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
            avatarDataUrl: "",
            descriptionVisibility: "public",
            avatarVisibility: "public",
            sharedInvitePolicy: "friends",
            createdAt: serverTimestamp(),
          });

          setUsername("");
          setInitialUsername("");
          setEmail(user.email ?? "");
          setDescription("");
          setAvatarFileName("");
          setAvatarDataUrl("");
          setDescriptionVisibility("public");
          setAvatarVisibility("public");
          setSharedInvitePolicy("friends");
        } else {
          const data = snap.data() as UserProfile;
          const nextUsername = String(data.username ?? "");
          setUsername(nextUsername);
          setInitialUsername(nextUsername);
          setEmail(String(data.email ?? user.email ?? ""));
          setDescription(String(data.description ?? ""));
          setAvatarFileName(String(data.avatarFileName ?? ""));
          setAvatarDataUrl(String(data.avatarDataUrl ?? ""));
          setDescriptionVisibility(getProfileVisibility(data.descriptionVisibility));
          setAvatarVisibility(getProfileVisibility(data.avatarVisibility));
          setSharedInvitePolicy(getSharedInvitePolicy(data.sharedInvitePolicy));
        }
      } catch (loadError: unknown) {
        setError(getErrorMessage(loadError, "Не удалось загрузить профиль"));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [user]);

  async function handleAvatarChange(file: File | null) {
    setPhotoFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

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
      const prepared = await prepareImageForFirestore(file, {
        maxWidth: 640,
        maxHeight: 640,
        maxBytes: PROFILE_PHOTO_FIRESTORE_MAX_SIZE,
      });

      setPendingAvatar({ name: prepared.name, dataUrl: prepared.dataUrl });
      setFieldErrors((prev) => ({ ...prev, photo: "" }));
    } catch (processError: unknown) {
      const message =
        processError instanceof Error && processError.message === "IMAGE_TOO_LARGE"
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

  function clearMessages() {
    setError(null);
    setMsg(null);
  }

  async function saveProfileInfo() {
    if (!user) {
      return;
    }

    const nextErrors: ValidationErrors<ProfileField> = {
      username: validateUsername(username),
      description: validateProfileDescription(description),
      photo: validateProfilePhoto(photoFile) || fieldErrors.photo || "",
      currentPassword: fieldErrors.currentPassword || "",
      newPassword: fieldErrors.newPassword || "",
      confirmNewPassword: fieldErrors.confirmNewPassword || "",
    };

    setFieldErrors(nextErrors);
    clearMessages();

    if (hasValidationErrors({
      username: nextErrors.username,
      description: nextErrors.description,
      photo: nextErrors.photo,
    })) {
      return;
    }

    setSavingSection("profile");

    try {
      const trimmedUsername = username.trim();
      const normalizedUsername = normalizeUsername(trimmedUsername);
      const nextAvatarDataUrl = pendingAvatar?.dataUrl ?? avatarDataUrl;
      const nextAvatarFileName = pendingAvatar?.name ?? avatarFileName;
      const trimmedDescription = description.trim();

      if (normalizedUsername !== normalizeUsername(initialUsername)) {
        await reserveUsername({
          uid: user.uid,
          username: trimmedUsername,
          email,
          currentUsername: initialUsername,
          avatarDataUrl: nextAvatarDataUrl,
          description: trimmedDescription,
        });
      }

      await updateDoc(doc(db, "users", user.uid), {
        username: trimmedUsername,
        usernameLower: normalizedUsername,
        description: trimmedDescription,
        avatarFileName: nextAvatarFileName,
        avatarDataUrl: nextAvatarDataUrl,
      });

      await updateUsernameMetadata(trimmedUsername, {
        avatarDataUrl: nextAvatarDataUrl,
        description: trimmedDescription,
      });

      if (pendingAvatar) {
        setAvatarFileName(pendingAvatar.name);
        setAvatarDataUrl(pendingAvatar.dataUrl);
        setPhotoFile(null);
        setPendingAvatar(null);
      }

      setInitialUsername(trimmedUsername);
      setMsg("Профиль сохранён");
    } catch (saveError: unknown) {
      if (saveError instanceof Error && saveError.message === "USERNAME_TAKEN") {
        setFieldErrors((prev) => ({ ...prev, username: "Это имя пользователя уже используется" }));
      } else {
        setError(getErrorMessage(saveError, "Не удалось сохранить профиль"));
      }
    } finally {
      setSavingSection("");
    }
  }

  async function savePrivacySettings() {
    if (!user) {
      return;
    }

    clearMessages();
    setSavingSection("privacy");

    try {
      await updateDoc(doc(db, "users", user.uid), {
        descriptionVisibility,
        avatarVisibility,
        sharedInvitePolicy,
      });

      setMsg("Настройки конфиденциальности сохранены");
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Не удалось сохранить настройки конфиденциальности"));
    } finally {
      setSavingSection("");
    }
  }

  function validatePasswordSection() {
    return {
      currentPassword: currentPassword ? "" : "Введите текущий пароль",
      newPassword: validatePassword(newPassword),
      confirmNewPassword: validateConfirmPassword(newPassword, confirmNewPassword),
    } satisfies ValidationErrors<ProfileField>;
  }

  async function savePassword() {
    if (!user) {
      return;
    }

    const passwordErrors = validatePasswordSection();
    setFieldErrors((prev) => ({
      ...prev,
      currentPassword: passwordErrors.currentPassword,
      newPassword: passwordErrors.newPassword,
      confirmNewPassword: passwordErrors.confirmNewPassword,
    }));
    clearMessages();

    if (hasValidationErrors(passwordErrors)) {
      return;
    }

    setSavingSection("password");

    try {
      if (!user.email) {
        throw new Error("Для смены пароля не найден email аккаунта");
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setFieldErrors((prev) => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      }));
      setMsg("Пароль успешно изменён");
    } catch (saveError: unknown) {
      const code =
        typeof saveError === "object" && saveError && "code" in saveError
          ? String(saveError.code)
          : "";

      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setFieldErrors((prev) => ({ ...prev, currentPassword: "Неверный текущий пароль" }));
      } else {
        setError(getErrorMessage(saveError, "Не удалось изменить пароль"));
      }
    } finally {
      setSavingSection("");
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
            onChange={(event) => setUsername(event.target.value)}
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
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Расскажите немного о себе"
            rows={4}
            maxLength={PROFILE_DESCRIPTION_MAX}
          />
          <div className="hint">{description.length}/{PROFILE_DESCRIPTION_MAX}</div>
          {fieldErrors.description && <div className="error">{fieldErrors.description}</div>}
        </div>

        <label className="label">Фото профиля</label>
        <div className="field">
          {(pendingAvatar?.dataUrl || avatarDataUrl) && (
            <div className="avatarPreviewBlock">
              <img className="avatarPreview" src={pendingAvatar?.dataUrl ?? avatarDataUrl} alt="Аватар профиля" />
              <button type="button" className="btnSmallDanger" onClick={removeAvatar}>
                Удалить фото
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            className="hiddenFileInput"
            type="file"
            accept=".jpg,.jpeg,.png"
            onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
          />
          <div className={`filePicker ${fieldErrors.photo ? "filePickerError" : ""}`}>
            <button type="button" className="filePickerButton" onClick={() => fileInputRef.current?.click()}>
              {pendingAvatar || avatarDataUrl ? "Заменить фото" : "Выбрать фото"}
            </button>
            <span className="filePickerText">{pendingAvatar?.name || avatarFileName || "JPG или PNG"}</span>
          </div>
          <div className="hint">JPG или PNG, до 5 МБ. Перед сохранением аватар автоматически сжимается для Firestore.</div>
          {fieldErrors.photo && <div className="error">{fieldErrors.photo}</div>}
        </div>

        <div className="panelActions">
          <button className="btnPrimary" type="button" onClick={() => void saveProfileInfo()} disabled={savingSection === "profile"}>
            {savingSection === "profile" ? "Сохраняем..." : "Сохранить профиль"}
          </button>
        </div>

        <section className="card sectionCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Настройки конфиденциальности</div>
              <div className="sectionText">По умолчанию профиль остаётся максимально открытым.</div>
            </div>
          </div>

          <div className="filtersGrid profilePrivacyGrid">
            <div className="field profilePrivacyField">
              <label className="label profilePrivacyLabel">Кому видно моё описание профиля</label>
              <select
                className="input"
                value={descriptionVisibility}
                onChange={(event) => setDescriptionVisibility(event.target.value as ProfileVisibility)}
              >
                {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="field profilePrivacyField">
              <label className="label profilePrivacyLabel">Кому видна моя аватарка</label>
              <select
                className="input"
                value={avatarVisibility}
                onChange={(event) => setAvatarVisibility(event.target.value as ProfileVisibility)}
              >
                {PROFILE_VISIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="field profilePrivacyField">
              <label className="label profilePrivacyLabel">Кто может давать мне доступ к совместным воспоминаниям</label>
              <select
                className="input"
                value={sharedInvitePolicy}
                onChange={(event) => setSharedInvitePolicy(event.target.value as SharedInvitePolicy)}
              >
                {SHARED_INVITE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="panelActions">
            <button className="btnPrimary" type="button" onClick={() => void savePrivacySettings()} disabled={savingSection === "privacy"}>
              {savingSection === "privacy" ? "Сохраняем..." : "Сохранить настройки приватности"}
            </button>
          </div>
        </section>

        <section className="card sectionCard">
          <div className="sectionHeader">
            <div>
              <div className="sectionTitle">Смена пароля</div>
              <div className="sectionText">Чтобы изменить пароль, подтвердите текущий и дважды введите новый.</div>
            </div>
          </div>

          <div className="field">
            <label className="label">Текущий пароль</label>
            <div className="pwRow">
              <input
                className={`input ${fieldErrors.currentPassword ? "inputError" : ""}`}
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
              <button type="button" className="linkBtn" onClick={() => setShowCurrentPassword((value) => !value)}>
                {showCurrentPassword ? "Скрыть" : "Показать"}
              </button>
            </div>
            {fieldErrors.currentPassword && <div className="error">{fieldErrors.currentPassword}</div>}
          </div>

          <div className="field">
            <label className="label">Новый пароль</label>
            <div className="pwRow">
              <input
                className={`input ${fieldErrors.newPassword ? "inputError" : ""}`}
                type={showNewPasswords ? "text" : "password"}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
              <button type="button" className="linkBtn" onClick={() => setShowNewPasswords((value) => !value)}>
                {showNewPasswords ? "Скрыть" : "Показать"}
              </button>
            </div>
            <div className="hint">Не менее 8 символов, заглавная, строчная, цифра и спецсимвол.</div>
            {fieldErrors.newPassword && <div className="error">{fieldErrors.newPassword}</div>}
          </div>

          <div className="field">
            <label className="label">Повторите новый пароль</label>
            <input
              className={`input ${fieldErrors.confirmNewPassword ? "inputError" : ""}`}
              type={showNewPasswords ? "text" : "password"}
              value={confirmNewPassword}
              onChange={(event) => setConfirmNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            {fieldErrors.confirmNewPassword && <div className="error">{fieldErrors.confirmNewPassword}</div>}
          </div>

          <div className="panelActions">
            <button className="btnPrimary" type="button" onClick={() => void savePassword()} disabled={savingSection === "password"}>
              {savingSection === "password" ? "Сохраняем..." : "Сохранить новый пароль"}
            </button>
          </div>
        </section>

        {error && <div className="error">{error}</div>}
        {msg && <div className="success">{msg}</div>}

        {user && (
          <DeleteAccountButton
            userId={user.uid}
            username={initialUsername}
            authUser={user}
          />
        )}
      </div>
    </>
  );
}
