export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export const PROFILE_DESCRIPTION_MAX = 200;
export const MEMORY_TITLE_MAX = 100;
export const MEMORY_TEXT_MAX = 10000;
export const MEMORY_PLACE_MAX = 100;
export const PROFILE_PHOTO_MAX_SIZE = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png"];
export const MEMORY_PHOTO_MAX_FILES = 3;
export const MEMORY_PHOTO_MAX_SIZE = 10 * 1024 * 1024;
export const MEMORY_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PROFILE_PHOTO_FIRESTORE_MAX_SIZE = 220 * 1024;
export const MEMORY_PHOTO_FIRESTORE_MAX_SIZE = 180 * 1024;
export const MEMORY_PHOTO_FIRESTORE_TOTAL_MAX_SIZE = 700 * 1024;
export const EMOTIONS = [
  "Радость",
  "Грусть",
  "Ностальгия",
  "Вдохновение",
  "Спокойствие",
  "Восторг",
] as const;

export type ValidationErrors<T extends string> = Partial<Record<T, string>>;

export function validateUsername(username: string) {
  const value = username.trim();

  if (!value) {
    return "Введите имя пользователя";
  }

  if (!USERNAME_PATTERN.test(value)) {
    return "От 3 до 20 символов: латиница, цифры и знак подчёркивания";
  }

  return "";
}

export function validatePassword(password: string) {
  if (!password) {
    return "Введите пароль";
  }

  if (password.length < 8) {
    return "Пароль должен содержать не менее 8 символов";
  }

  if (!/[A-Z]/.test(password)) {
    return "Добавьте хотя бы одну заглавную букву";
  }

  if (!/[a-z]/.test(password)) {
    return "Добавьте хотя бы одну строчную букву";
  }

  if (!/\d/.test(password)) {
    return "Добавьте хотя бы одну цифру";
  }

  if (!/[^\w\s]/.test(password)) {
    return "Добавьте хотя бы один специальный символ";
  }

  return "";
}

export function validateConfirmPassword(password: string, confirmPassword: string) {
  if (!confirmPassword) {
    return "Подтвердите пароль";
  }

  if (password !== confirmPassword) {
    return "Пароли не совпадают";
  }

  return "";
}

export function validateProfileDescription(description: string) {
  if (description.length > PROFILE_DESCRIPTION_MAX) {
    return `Описание должно быть не длиннее ${PROFILE_DESCRIPTION_MAX} символов`;
  }

  return "";
}

export function validateProfilePhoto(file: File | null) {
  if (!file) {
    return "";
  }

  if (!PROFILE_PHOTO_TYPES.includes(file.type)) {
    return "Допустимы только JPG и PNG";
  }

  if (file.size > PROFILE_PHOTO_MAX_SIZE) {
    return "Фото профиля должно быть не больше 5 МБ";
  }

  return "";
}

export function validateMemoryPhotos(files: File[]) {
  if (files.length > MEMORY_PHOTO_MAX_FILES) {
    return `Можно выбрать не более ${MEMORY_PHOTO_MAX_FILES} файлов`;
  }

  const invalidTypeFile = files.find((file) => !MEMORY_PHOTO_TYPES.includes(file.type));
  if (invalidTypeFile) {
    return "Для фото воспоминания допустимы только JPG, PNG и WebP";
  }

  const oversizedFile = files.find((file) => file.size > MEMORY_PHOTO_MAX_SIZE);
  if (oversizedFile) {
    return "Каждый файл должен быть не больше 10 МБ";
  }

  return "";
}

export function validateMemoryTitle(title: string) {
  const value = title.trim();

  if (!value) {
    return "Введите заголовок";
  }

  if (value.length > MEMORY_TITLE_MAX) {
    return `Заголовок должен быть не длиннее ${MEMORY_TITLE_MAX} символов`;
  }

  return "";
}

export function validateMemoryText(text: string) {
  const value = text.trim();

  if (value.length > MEMORY_TEXT_MAX) {
    return `Текст должен быть не длиннее ${MEMORY_TEXT_MAX} символов`;
  }

  return "";
}

export function validateMemoryDate(date: string) {
  if (!date) {
    return "Укажите дату";
  }

  return "";
}

export function validateMemoryPlace(place: string) {
  if (place.trim().length > MEMORY_PLACE_MAX) {
    return `Место должно быть не длиннее ${MEMORY_PLACE_MAX} символов`;
  }

  return "";
}

export function validateMemoryEmotion(emotion: string) {
  if (!emotion) {
    return "Выберите эмоцию";
  }

  return "";
}

export function hasValidationErrors<T extends string>(errors: ValidationErrors<T>) {
  return Object.values(errors).some(Boolean);
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}
