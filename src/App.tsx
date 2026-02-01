import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Memories from "./pages/Memories";

function Placeholder({ title }: { title: string }) {
  return (
    <div className="page">
      <div className="card">
        <h2>{title}</h2>
        <p>Заглушка. Сделаем на следующем этапе.</p>
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
              <Placeholder title="Create memory" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Placeholder title="Profile" />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Placeholder title="Not found" />} />
      </Route>
    </Routes>
  );
}
