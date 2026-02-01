import { useNavigate } from "react-router-dom";

const MOCK = Array.from({ length: 9 }).map((_, i) => ({
  id: String(i + 1),
  title: "Title",
  text: "Short text...",
  date: "12 Jan 2026",
}));

export default function Memories() {
  const navigate = useNavigate();

  return (
    <div className="pageWide">
      <h1 className="titleCenter">My memories</h1>

      <div className="centerRow">
        <button className="btnPrimary" onClick={() => navigate("/memories/new")}>
          Add memory
        </button>
      </div>

      <div className="grid">
        {MOCK.map((m) => (
          <div className="memoryCard" key={m.id}>
            <div className="memoryTitle">{m.title}</div>
            <div className="memoryText">{m.text}</div>
            <div className="memoryDate">{m.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
