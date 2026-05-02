import { getAllTags, type MemoryAccessType, type NormalizedMemory } from "../../memory";

export type NamedCount = {
  label: string;
  count: number;
};

export type AccessDistributionItem = {
  type: MemoryAccessType;
  label: string;
  count: number;
};

export type EmotionWeekdayRow = {
  emotion: string;
  weekdays: number[];
};

export type MemoryStatistics = {
  monthCount: number;
  yearCount: number;
  totalCount: number;
  byWeekday: NamedCount[];
  byMonth: NamedCount[];
  popularTags: NamedCount[];
  popularPlaces: NamedCount[];
  accessDistribution: AccessDistributionItem[];
  emotionWeekdayMap: EmotionWeekdayRow[];
  topCollaborators: NamedCount[];
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const ACCESS_LABELS: Record<MemoryAccessType, string> = {
  private: "Приватные",
  shared: "Shared",
  public: "Публичные",
};

export function buildMemoryStatistics(memories: NormalizedMemory[]): MemoryStatistics {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

  const byWeekday = Array.from({ length: 7 }, (_, index) => ({
    label: WEEKDAY_LABELS[index],
    count: 0,
  }));
  const byMonth = Array.from({ length: 12 }, (_, index) => ({
    label: MONTH_LABELS[index],
    count: 0,
  }));
  const tagMap = new Map<string, number>();
  const placeMap = new Map<string, number>();
  const collaboratorMap = new Map<string, number>();
  const emotionWeekdayMap = new Map<string, number[]>();
  const accessDistributionMap = new Map<MemoryAccessType, number>([
    ["private", 0],
    ["shared", 0],
    ["public", 0],
  ]);

  let monthCount = 0;
  let yearCount = 0;

  memories.forEach((memory) => {
    const targetDate = getMemoryDate(memory);
    if (!targetDate) {
      return;
    }

    if (targetDate >= monthAgo) {
      monthCount += 1;
    }

    if (targetDate >= yearAgo) {
      yearCount += 1;
    }

    const weekdayIndex = getMondayFirstWeekday(targetDate);
    byWeekday[weekdayIndex].count += 1;
    byMonth[targetDate.getMonth()].count += 1;

    accessDistributionMap.set(memory.accessType, (accessDistributionMap.get(memory.accessType) ?? 0) + 1);

    getAllTags(memory).forEach((tag) => {
      const normalized = tag.trim();
      if (!normalized) {
        return;
      }

      tagMap.set(normalized, (tagMap.get(normalized) ?? 0) + 1);
    });

    memory.emotionTags.forEach((emotion) => {
      const normalized = emotion.trim();
      if (!normalized) {
        return;
      }

      const weekdays = emotionWeekdayMap.get(normalized) ?? [0, 0, 0, 0, 0, 0, 0];
      weekdays[weekdayIndex] += 1;
      emotionWeekdayMap.set(normalized, weekdays);
    });

    const place = memory.place.trim();
    if (place) {
      placeMap.set(place, (placeMap.get(place) ?? 0) + 1);
    }

    if (memory.accessType === "shared") {
      memory.sharedWith.forEach((share) => {
        const username = share.username.trim();
        if (!username) {
          return;
        }

        collaboratorMap.set(username, (collaboratorMap.get(username) ?? 0) + 1);
      });
    }
  });

  return {
    monthCount,
    yearCount,
    totalCount: memories.length,
    byWeekday,
    byMonth,
    popularTags: mapToSortedCounts(tagMap),
    popularPlaces: mapToSortedCounts(placeMap),
    accessDistribution: (["private", "shared", "public"] as const).map((type) => ({
      type,
      label: ACCESS_LABELS[type],
      count: accessDistributionMap.get(type) ?? 0,
    })),
    emotionWeekdayMap: Array.from(emotionWeekdayMap.entries())
      .map(([emotion, weekdays]) => ({ emotion, weekdays }))
      .sort((left, right) => left.emotion.localeCompare(right.emotion, "ru")),
    topCollaborators: mapToSortedCounts(collaboratorMap),
  };
}

export function getMemoryOfDayCandidate(memories: NormalizedMemory[], now = new Date()) {
  const sameDayMemories = memories
    .filter((memory) => {
      const targetDate = getMemoryDate(memory);
      return targetDate
        && targetDate.getMonth() === now.getMonth()
        && targetDate.getDate() === now.getDate()
        && targetDate.getFullYear() < now.getFullYear();
    })
    .sort((left, right) => {
      const leftDate = getMemoryDate(left)?.getTime() ?? 0;
      const rightDate = getMemoryDate(right)?.getTime() ?? 0;
      return rightDate - leftDate;
    });

  return sameDayMemories[0] ?? null;
}

export function getWeekdayLabels() {
  return [...WEEKDAY_LABELS];
}

function getMemoryDate(memory: Pick<NormalizedMemory, "date" | "createdAt">) {
  if (memory.date) {
    const parsed = new Date(`${memory.date}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return memory.createdAt;
}

function getMondayFirstWeekday(date: Date) {
  return (date.getDay() + 6) % 7;
}

function mapToSortedCounts(map: Map<string, number>) {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "ru");
    })
    .slice(0, 5);
}
