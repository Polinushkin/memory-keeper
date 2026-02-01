import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, serverTimestamp, setDoc, where, doc } from "firebase/firestore";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../api/firebase";

function validateUsername(username: string) {
  const u = username.trim();
  if (u.length < 3 || u.length > 20) return "Username: 3–20 characters";
  if (!/^[a-zA-Z_]+$/.test(u)) return "Username: only Latin letters and underscore (_)";
  return null;
}

function validatePassword(pw: string) {
  if (pw.length < 8) return "Password: минимум 8 символов";
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = /[^A-Za-z0-9]/.test(pw);
  if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
    return "Password: нужны upper/lower/digit/special";
  }
  return null;
}

export default function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [fieldError, setFieldError] = useState<{ username?: string; email?: string; password?: string }>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function isUsernameTaken(u: string) {
    const q = query(collection(db, "users"), where("username", "==", u));
    const snap = await getDocs(q);
    return !snap.empty;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);

    const uErr = validateUsername(username);
    const pErr = validatePassword(password);

    const nextErrors: typeof fieldError = {};
    if (uErr) nextErrors.username = uErr;
    if (!email.trim()) nextErrors.email = "Email обязателен";
    if (pErr) nextErrors.password = pErr;

    setFieldError(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      const u = username.trim();

      /*const taken = await isUsernameTaken(u);
      if (taken) {
        setFieldError({ username: "Этот username уже занят" });
        return;
      }*/

      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      await setDoc(doc(db, "users", cred.user.uid), {
        username: u,
        email: email.trim(),
        createdAt: serverTimestamp(),
      });

      navigate("/memories");
    } catch (err: any) {
      console.log("REGISTER ERROR:", err);
      console.log("code:", err?.code);
      console.log("message:", err?.message);
      setGlobalError(`${err?.code ?? ""} ${err?.message ?? "Registration failed"}`);
    } finally {
      setLoading(false);
    }

  }

  return (
    <div className="page">
      <div className="authCard">
        <h1 className="title">Register</h1>

        <form onSubmit={onSubmit} className="form">
          <input
            className={fieldError.username ? "input inputError" : "input"}
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {fieldError.username && <div className="error">{fieldError.username}</div>}

          <input
            className={fieldError.email ? "input inputError" : "input"}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          {fieldError.email && <div className="error">{fieldError.email}</div>}

          <div className="pwRow">
            <input
              className={fieldError.password ? "input inputError" : "input"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              autoComplete="new-password"
            />
            <button type="button" className="linkBtn" onClick={() => setShowPw((v) => !v)}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>

          <div className="hint">Password must be 8+ chars, upper/lower/digit/special</div>
          {fieldError.password && <div className="error">{fieldError.password}</div>}

          <Link className="smallLink" to="/login">Already have an account? Login</Link>

          {globalError && <div className="error">{globalError}</div>}

          <button className="btnPrimary" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
