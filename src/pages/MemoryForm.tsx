import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../api/firebase";
import { useAuth } from "../contexts/AuthContext";

export default function MemoryForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [date, setDate] = useState(""); // YYYY-MM-DD

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You are not authenticated");
      return;
    }

    const t = title.trim();
    const x = text.trim();

    if (t.length < 1) return setError("Title is required");
    if (x.length < 1) return setError("Text is required");
    if (!date) return setError("Date is required");

    setLoading(true);
    try {
      await addDoc(collection(db, "memories"), {
        ownerId: user.uid,
        title: t,
        text: x,
        date,
        createdAt: serverTimestamp(),
      });

      navigate("/memories");
    } catch (err: any) {
      setError(err?.message ?? "Failed to create memory");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="authCard">
        <h1 className="title">New memory</h1>

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
              disabled={loading}
            >
              Cancel
            </button>

            <button className="btnPrimary" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
