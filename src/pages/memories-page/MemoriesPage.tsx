import { useNavigate } from "react-router-dom";
import MemoriesList from "../../widgets/memories-list/MemoriesList";

export default function MemoriesPage() {
  const navigate = useNavigate();

  return (
    <div className="pageWide">
      <h1 className="titleCenter">My memories</h1>

      <div className="centerRow">
        <button className="btnPrimary" onClick={() => navigate("/memories/new")}>
          Add memory
        </button>
      </div>

      <MemoriesList />
    </div>
  );
}