import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../api/firebase";
import { useAuth } from "../contexts/AuthContext";

type UserProfile = {
  username?: string;
  email?: string;
  createdAt?: any;
};

export default function Profile() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await setDoc(ref, {
            username: "",
            email: user.email ?? "",
            createdAt: serverTimestamp(),
          });
          setUsername("");
          setEmail(user.email ?? "");
        } else {
          const data = snap.data() as UserProfile;
          setUsername((data.username ?? "") as string);
          setEmail((data.email ?? user.email ?? "") as string);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user]);

  async function onSave() {
    if (!user) return;

    const u = username.trim();
    if (u.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    setSaving(true);
    setError(null);
    setMsg(null);

    try {
      await updateDoc(doc(db, "users", user.uid), { username: u });
      setMsg("Saved");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save");
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

  return (
    <div className="page">
      <div className="authCard">
        <h1 className="title">Profile</h1>

        <div className="form">
          <label className="label">Email</label>
          <input className="input" value={email} disabled />

          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
          />

          {error && <div className="error">{error}</div>}
          {msg && <div className="success">{msg}</div>}

          <button className="btnPrimary" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
