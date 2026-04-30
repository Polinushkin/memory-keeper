import { useState } from "react";
import { deleteCategory, renameCategory, saveUserCategories } from "../../../entities/memory/api/categories";
import { findSimilarCategory, normalizeCategoryName } from "../../../entities/memory/model/memory";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";
import { MEMORY_CATEGORY_MAX, validateMemoryCategory } from "../../../shared/lib/validation";

type ManageMemoryCategoriesProps = {
  userId: string;
  categories: string[];
  categoryOptions: string[];
  onCategoriesChange: (nextCategories: string[]) => void;
  onCategoryRenamed: (previousCategory: string, nextCategory: string) => void;
  onCategoryDeleted: (category: string) => void;
};

export default function ManageMemoryCategories({
  userId,
  categories,
  categoryOptions,
  onCategoriesChange,
  onCategoryRenamed,
  onCategoryDeleted,
}: ManageMemoryCategoriesProps) {
  const [categoryName, setCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function handleCreateCategory() {
    const nextName = normalizeCategoryName(categoryName);
    const validationError = validateMemoryCategory(nextName);
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    if (!nextName) {
      setCategoryError("Введите название категории");
      return;
    }

    if (categoryOptions.includes(nextName)) {
      setCategoryError("Такая категория уже есть");
      return;
    }

    const similarCategory = findSimilarCategory(categoryOptions, nextName);
    if (similarCategory) {
      setCategoryError(`Похожая категория уже есть: ${similarCategory}`);
      return;
    }

    try {
      const nextCategories = [...categories, nextName].sort((left, right) => left.localeCompare(right, "ru"));
      await saveUserCategories(userId, nextCategories);
      onCategoriesChange(nextCategories);
      setCategoryName("");
      setCategoryError(null);
    } catch (createError: unknown) {
      setCategoryError(parseCategoryError(createError, "Не удалось создать категорию"));
    }
  }

  async function handleRenameCategory(category: string) {
    const nextName = window.prompt("Новое название категории", category);
    if (nextName === null) {
      return;
    }

    const validationError = validateMemoryCategory(nextName);
    if (validationError) {
      setCategoryError(validationError);
      return;
    }

    if (!normalizeCategoryName(nextName)) {
      setCategoryError("Название категории не может быть пустым");
      return;
    }

    try {
      const normalizedName = normalizeCategoryName(nextName);
      const nextCategories = await renameCategory(userId, category, normalizedName);
      onCategoriesChange(nextCategories);
      onCategoryRenamed(category, normalizedName);
      setCategoryError(null);
    } catch (renameError: unknown) {
      setCategoryError(parseCategoryError(renameError, "Не удалось переименовать категорию"));
    }
  }

  async function handleDeleteCategory(category: string) {
    const ok = window.confirm(`Удалить категорию "${category}"? У воспоминаний она будет очищена.`);
    if (!ok) {
      return;
    }

    try {
      const nextCategories = await deleteCategory(userId, category);
      onCategoriesChange(nextCategories);
      onCategoryDeleted(category);
      setCategoryError(null);
    } catch (deleteError: unknown) {
      setCategoryError(getErrorMessage(deleteError, "Не удалось удалить категорию"));
    }
  }

  return (
    <section className="card sectionCard floatingPanel">
      <div className="sectionHeader">
        <div>
          <div className="sectionTitle">Категории</div>
          <div className="sectionText">Создавайте, переименовывайте и удаляйте категории для организации архива.</div>
        </div>
      </div>
      <div className="categoryCreateRow">
        <input
          className={`input ${categoryError ? "inputError" : ""}`}
          placeholder="Новая категория"
          value={categoryName}
          onChange={(event) => setCategoryName(event.target.value)}
          maxLength={MEMORY_CATEGORY_MAX}
        />
        <button className="btnPrimary" type="button" onClick={() => void handleCreateCategory()}>
          Создать
        </button>
      </div>
      {categoryError && <div className="error">{categoryError}</div>}
      <div className="categoryManagerList">
        {categoryOptions.length > 0 ? categoryOptions.map((category) => (
          <div className="categoryManagerItem" key={category}>
            <span>{category}</span>
            <div className="categoryManagerActions">
              <button className="btnSmall" type="button" onClick={() => void handleRenameCategory(category)}>
                Переименовать
              </button>
              <button className="btnSmallDanger" type="button" onClick={() => void handleDeleteCategory(category)}>
                Удалить
              </button>
            </div>
          </div>
        )) : <div className="emptyState">Пока нет категорий. Можно создать первую выше.</div>}
      </div>
    </section>
  );
}

function parseCategoryError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.startsWith("CATEGORY_EXISTS:")) {
    return `Похожая категория уже есть: ${error.message.replace("CATEGORY_EXISTS:", "")}`;
  }

  return getErrorMessage(error, fallback);
}
