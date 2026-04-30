import { MEMORY_ACCESS_TYPES } from "../../../entities/memory/model/memory";
import type { MemoryFilters } from "../../../entities/memory/model/filters";

type MemoryFiltersPanelProps = {
  categoryOptions: string[];
  draftFilters: MemoryFilters;
  onChange: (nextFilters: MemoryFilters) => void;
  onApply: () => void;
  onReset: () => void;
};

export default function MemoryFiltersPanel({
  categoryOptions,
  draftFilters,
  onChange,
  onApply,
  onReset,
}: MemoryFiltersPanelProps) {
  return (
    <section className="card sectionCard floatingPanel">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Фильтры</div>
          <div className="sectionText">Можно отобрать воспоминания по категории, тегам, месту, диапазону дат и типу доступа.</div>
        </div>
      </div>
      <div className="filtersGrid">
        <div className="field">
          <label className="label">Категория</label>
          <select
            className="input"
            value={draftFilters.category}
            onChange={(event) => onChange({ ...draftFilters, category: event.target.value })}
          >
            <option value="">Все категории</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Тег</label>
          <input
            className="input"
            placeholder="Например, семья или море"
            value={draftFilters.tag}
            onChange={(event) => onChange({ ...draftFilters, tag: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="label">Место</label>
          <input
            className="input"
            placeholder="Например, Москва или парк"
            value={draftFilters.place}
            onChange={(event) => onChange({ ...draftFilters, place: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="label">Тип доступа</label>
          <select
            className="input"
            value={draftFilters.accessType}
            onChange={(event) => onChange({ ...draftFilters, accessType: event.target.value as MemoryFilters["accessType"] })}
          >
            <option value="">Все типы</option>
            {MEMORY_ACCESS_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">Дата события: от</label>
          <input
            className="input"
            type="date"
            value={draftFilters.dateFrom}
            onChange={(event) => onChange({ ...draftFilters, dateFrom: event.target.value })}
          />
        </div>
        <div className="field">
          <label className="label">Дата события: до</label>
          <input
            className="input"
            type="date"
            value={draftFilters.dateTo}
            onChange={(event) => onChange({ ...draftFilters, dateTo: event.target.value })}
          />
        </div>
      </div>
      <div className="panelActions">
        <button className="btnPrimary" type="button" onClick={onApply}>
          Применить
        </button>
        <button className="btnSecondary" type="button" onClick={onReset}>
          Сбросить фильтры
        </button>
      </div>
    </section>
  );
}
