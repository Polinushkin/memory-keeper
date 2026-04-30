import { DEFAULT_MEMORY_SORT_MODE, type MemorySortMode } from "../../../entities/memory/model/sorting";

type MemorySortingPanelProps = {
  sortMode: MemorySortMode;
  onChange: (nextSort: MemorySortMode) => void;
  onReset: () => void;
};

export default function MemorySortingPanel({
  sortMode,
  onChange,
  onReset,
}: MemorySortingPanelProps) {
  return (
    <section className="card sectionCard floatingPanel">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Сортировка</div>
          <div className="sectionText">Выберите один из шести вариантов отображения списка.</div>
        </div>
      </div>
      <div className="sortPanelRow">
        <div className="field sortPanelField">
          <label className="label">Как сортировать</label>
          <select
            className="input"
            value={sortMode}
            onChange={(event) => onChange(event.target.value as MemorySortMode)}
          >
            <option value="created-desc">По дате создания: новые сверху</option>
            <option value="created-asc">По дате создания: старые сверху</option>
            <option value="event-desc">По дате события: новые сверху</option>
            <option value="event-asc">По дате события: старые сверху</option>
            <option value="title-asc">По алфавиту: А-Я</option>
            <option value="title-desc">По алфавиту: Я-А</option>
          </select>
        </div>
        <button
          className="btnSecondary"
          type="button"
          onClick={onReset}
          disabled={sortMode === DEFAULT_MEMORY_SORT_MODE}
        >
          Сбросить сортировку
        </button>
      </div>
    </section>
  );
}
