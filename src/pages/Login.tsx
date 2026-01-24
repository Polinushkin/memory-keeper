export default function Login() {
  return <h1>Login</h1>;
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
