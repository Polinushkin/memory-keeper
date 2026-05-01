import { MemoriesList } from "../../widgets/memories-list";

export default function SharedMemoriesPage() {
  return (
    <div className="pageWide">
      <h1 className="titleCenter">Доступные воспоминания</h1>
      <MemoriesList scope="shared" />
    </div>
  );
}
