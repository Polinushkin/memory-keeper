function getErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : "";
}

function getErrorText(error: unknown) {
  return typeof error === "object" && error && "message" in error
    ? String(error.message || "")
    : "";
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  const code = getErrorCode(error);

  switch (code) {
    case "auth/email-already-in-use":
      return "Этот email уже используется";
    case "auth/invalid-email":
      return "Введите корректный email";
    case "auth/weak-password":
      return "Слишком простой пароль";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверное имя пользователя, email или пароль";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуйте позже";
    default:
      break;
  }

  const message = getErrorText(error);
  if (message.startsWith("Firebase:")) {
    return fallback;
  }

  return message || fallback;
}

export function getErrorMessage(error: unknown, fallback: string) {
  const code = getErrorCode(error);

  switch (code) {
    case "permission-denied":
    case "firestore/permission-denied":
      return "Недостаточно прав для выполнения операции";
    case "unavailable":
    case "firestore/unavailable":
      return "Сервис временно недоступен. Попробуйте позже";
    case "auth/email-already-in-use":
      return "Этот email уже используется";
    case "auth/invalid-email":
      return "Введите корректный email";
    case "auth/weak-password":
      return "Слишком простой пароль";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Неверное имя пользователя, email или пароль";
    case "auth/too-many-requests":
      return "Слишком много попыток. Попробуйте позже";
    default:
      break;
  }

  const message = getErrorText(error);
  if (message.startsWith("Firebase:")) {
    return fallback;
  }

  return message || fallback;
}
