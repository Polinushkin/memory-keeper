import { createBrowserRouter } from "react-router-dom";
import Layout from "./Layout";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Memories from "../pages/Memories";
import Profile from "../pages/Profile";
import ProtectedRoute from "../components/ProtectedRoute";
import MemoryForm from "../pages/MemoryForm";


export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ProtectedRoute><Memories /></ProtectedRoute> },
      { path: "login", element: <Login /> },
      { path: "register", element: <Register /> },
      { path: "profile", element: <ProtectedRoute><Profile /></ProtectedRoute> },
      { path: "memories/new", element: <ProtectedRoute><MemoryForm /></ProtectedRoute> },
    ],
  },
]);
