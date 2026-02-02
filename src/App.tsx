import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Memories from "./pages/Memories";
import MemoryForm from "./pages/MemoryForm";
import Profile from "./pages/Profile";
import MemoryEdit from "./pages/MemoryEdit";


function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="card">
        <h2>{title}</h2>
        <p>Будет сделано позже</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/memories" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/memories"
          element={
            <ProtectedRoute>
              <Memories />
            </ProtectedRoute>
          }
        />

        <Route
          path="/memories/new"
          element={
            <ProtectedRoute>
              <MemoryForm />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/memories/:id/edit"
          element={
            <ProtectedRoute>
              <MemoryEdit />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
