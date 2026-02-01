import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../api/firebase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate("/memories");
    } catch (err: any) {
      setError(err?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="authCard">
        <h1 className="title">Login</h1>

        <form onSubmit={onSubmit} className="form">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <div className="pwRow">
            <input
              className="input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
            />
            <button type="button" className="linkBtn" onClick={() => setShowPw((v) => !v)}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          <Link className="smallLink" to="/register">No account? Register</Link>

          <button className="btnPrimary" disabled={loading}>
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

//firebase status debug
/*import { auth, db } from "../api/firebase";

export default function Login() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Firebase status</h1>
      <ul>
        <li>Auth initialized: {String(!!auth)}</li>
        <li>Firestore initialized: {String(!!db)}</li>
      </ul>

      <p style={{ marginTop: 16, color: "gray" }}>
        Если оба значения <b>true</b>, Firebase SDK подключён корректно.
      </p>
    </div>
  );
}*/
