import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../api/firebase";
import { useAuth } from "../contexts/AuthContext";

type MemoryData = {
  title: string;
  text: string;
  date: string; // YYYY-MM-DD
  ownerId: string;
};

export default function MemoryEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) {
        setError("No memory id");
        setLoading(false);
        return;
      }
      try {
        const ref = doc(db, "memories", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setError("Memory not found");
          setLoading(false);
          return;
        }

        const data = snap.data() as MemoryData;

        if (!user || data.ownerId !== user.uid) {
          setError("Access denied");
          setLoading(false);
          return;
        }

        setTitle(data.title ?? "");
        setText(data.text ?? "");
        setDate(data.date ?? "");
      } catch (e: any) {
        setError(e?.message ?? "Failed to load memory");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!id) return;
    if (!user) return setError("You are not authenticated");

    const t = title.trim();
    const x = text.trim();
    if (!t) return setError("Title is required");
    if (!x) return setError("Text is required");
    if (!date) return setError("Date is required");

    setSaving(true);
    try {
      await updateDoc(doc(db, "memories", id), {
        title: t,
        text: x,
        date,
      });
      navigate("/memories");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <div className="card">
          <h2>Edit memory</h2>
          <div className="error" style={{ marginTop: 12 }}>{error}</div>
          <button className="btnSecondary" style={{ marginTop: 12 }} onClick={() => navigate("/memories")}>
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="authCard">
        <h1 className="title">Edit memory</h1>

        <form onSubmit={onSubmit} className="form">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Short text..." rows={5} />
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          {error && <div className="error">{error}</div>}

          <div className="rowButtons">
            <button type="button" className="btnSecondary" onClick={() => navigate("/memories")} disabled={saving}>
              Cancel
            </button>
            <button className="btnPrimary" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
