import { createBrowserRouter, Navigate } from "react-router-dom";
import AppLayout from "../../widgets/app-layout/AppLayout";
import ProtectedRoute from "./ProtectedRoute";

import LoginPage from "../../pages/login-page/LoginPage";
import RegisterPage from "../../pages/register-page/RegisterPage";
import MemoriesPage from "../../pages/memories-page/MemoriesPage";
import MemoryDetailsPage from "../../pages/memory-details-page/MemoryDetailsPage";
import ProfilePage from "../../pages/profile-page/ProfilePage";
import CreateMemoryPage from "../../pages/create-memory-page/CreateMemoryPage";
import EditMemoryPage from "../../pages/edit-memory-page/EditMemoryPage";
import FriendsPage from "../../pages/friends-page/FriendsPage";
import SharedMemoriesPage from "../../pages/shared-memories-page/SharedMemoriesPage";
import UserProfilePage from "../../pages/user-profile-page/UserProfilePage";
import UserPublicMemoriesPage from "../../pages/user-public-memories-page/UserPublicMemoriesPage";
import NotFoundPage from "../../pages/not-found-page/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      {
        path: "/",
        element: <Navigate to="/memories" replace />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/register",
        element: <RegisterPage />,
      },
      {
        path: "/memories",
        element: (
          <ProtectedRoute>
            <MemoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/memories/new",
        element: (
          <ProtectedRoute>
            <CreateMemoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/memories/:id",
        element: (
          <ProtectedRoute>
            <MemoryDetailsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/memories/:id/edit",
        element: (
          <ProtectedRoute>
            <EditMemoryPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/friends",
        element: (
          <ProtectedRoute>
            <FriendsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/shared-memories",
        element: (
          <ProtectedRoute>
            <SharedMemoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/profile",
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/users/:userId",
        element: (
          <ProtectedRoute>
            <UserProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/users/:userId/memories",
        element: (
          <ProtectedRoute>
            <UserPublicMemoriesPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
