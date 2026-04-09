import { useNavigate } from "react-router-dom";
import MemoriesList from "../../widgets/memories-list/MemoriesList";

export default function MemoriesPage() {
  const navigate = useNavigate();

  return (
    <div className="pageWide">
      <h1 className="titleCenter">Мои воспоминания</h1>

      <div className="centerRow">
        <button className="btnPrimary" onClick={() => navigate("/memories/new")}>
          Создать воспоминание
        </button>
      </div>

      <MemoriesList />
    </div>
  );
}
