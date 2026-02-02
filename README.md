# Memory Keeper

Memory Keeper - учебный веб-проект на React для хранения личных воспоминаний пользователя.  
Проект реализован в рамках курсовой работы и использует Firebase в качестве backend-части.

## Описание проекта

Приложение на текущем этапе позволяет пользователю:
- зарегистрироваться и войти в систему
- создавать, редактировать и удалять воспоминания
- просматривать список своих воспоминаний
- управлять профилем пользователя

Каждое воспоминание принадлежит конкретному пользователю и доступно только ему.

---

## Технологии

- **React + TypeScript**
- **Vite**
- **React Router**
- **Firebase**
  - Authentication (email/password)
  - Cloud Firestore
- CSS


---

## Авторизация и безопасность

- Используется Firebase Authentication
- Защищённые маршруты реализованы через `ProtectedRoute`
- Доступ к данным в Firestore ограничен правилами безопасности
- Пользователь имеет доступ только к своим данным

---

## Запуск проекта локально

1. Установить зависимости:
```bash
npm install
```
2. Создать файл .env.local и добавить переменные Firebase:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

3. Запустить проект:
```bash
npm run dev
```