import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../../shared/api/firebase/firebase";
import { useAuth } from "../../../app/providers/auth-provider/useAuth";

export default function EditMemoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMemory() {
      if (!id) {
        setError("Memory id not found");
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "memories", id);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
          setError("Memory not found");
          setLoading(false);
          return;
        }

        const data = snapshot.data();

        if (!user || data.ownerId !== user.uid) {
          setError("Access denied");
          setLoading(false);
          return;
        }

        setTitle(data.title ?? "");
        setText(data.text ?? "");
        setDate(data.date ?? "");
      } catch (err: any) {
        setError(err?.message ?? "Failed to load memory");
      } finally {
        setLoading(false);
      }
    }

    loadMemory();
  }, [id, user]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!id) {
      setError("Memory id not found");
      return;
    }

    const t = title.trim();
    const x = text.trim();

    if (t.length < 1) {
      setError("Title is required");
      return;
    }

    if (x.length < 1) {
      setError("Text is required");
      return;
    }

    if (!date) {
      setError("Date is required");
      return;
    }

    setSaving(true);

    try {
      await updateDoc(doc(db, "memories", id), {
        title: t,
        text: x,
        date,
      });

      navigate("/memories");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update memory");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p>Loading...</p>;
  }

  return (
    <>
      <h1 className="title">Edit memory</h1>

      <form onSubmit={onSubmit} className="form">
        <input
          className="input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <textarea
          className="textarea"
          placeholder="Short text..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
        />

        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />

        {error && <div className="error">{error}</div>}

        <div className="rowButtons">
          <button
            type="button"
            className="btnSecondary"
            onClick={() => navigate("/memories")}
            disabled={saving}
          >
            Cancel
          </button>

          <button className="btnPrimary" disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}