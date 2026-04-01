import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../shared/api/firebase/firebase";
import { useAuth } from "../../app/providers/auth-provider/useAuth";

type MemoryItem = {
  id: string;
  title: string;
  text: string;
  date: string;
};

export default function MemoriesList() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "memories"),
      where("ownerId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const next: MemoryItem[] = snap.docs.map((d) => ({
          id: d.id,
          title: (d.data().title ?? "") as string,
          text: (d.data().text ?? "") as string,
          date: (d.data().date ?? "") as string,
        }));
        setItems(next);
        setLoading(false);
      },
      (e) => {
        setError(e?.message ?? "Failed to load memories");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  async function onDelete(id: string) {
    const ok = window.confirm("Delete this memory?");
    if (!ok) return;

    setBusyId(id);
    setError(null);

    try {
      await deleteDoc(doc(db, "memories", id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  if (error) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <div className="error">{error}</div>
      </div>
    );
  }

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center" }}>
        No memories yet. Create your first one ✨
      </div>
    );
  }

  return (
    <div className="grid">
      {items.map((m) => (
        <div className="memoryCard" key={m.id}>
          <div className="memoryTitle">{m.title}</div>
          <div className="memoryText">{m.text}</div>
          <div className="memoryDate">{formatDate(m.date)}</div>

          <div className="cardActions">
            <button
              className="btnSmall"
              onClick={() => navigate(`/memories/${m.id}/edit`)}
              disabled={busyId === m.id}
            >
              Edit
            </button>

            <button
              className="btnSmallDanger"
              onClick={() => onDelete(m.id)}
              disabled={busyId === m.id}
            >
              {busyId === m.id ? "..." : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}