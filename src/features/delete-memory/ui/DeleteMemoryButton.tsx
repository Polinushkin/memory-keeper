import { useState } from "react";
import { deleteMemoryById } from "../../../entities/memory/api/memories";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";

type DeleteMemoryButtonProps = {
  memoryId: string;
  onDeleted: () => void;
  onError: (message: string) => void;
};

export default function DeleteMemoryButton({ memoryId, onDeleted, onError }: DeleteMemoryButtonProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("Удалить это воспоминание?");
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    try {
      await deleteMemoryById(memoryId);
      onDeleted();
    } catch (error: unknown) {
      onError(getErrorMessage(error, "Не удалось удалить воспоминание"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      className="btnSmallDanger"
      onClick={() => void handleDelete()}
      disabled={deleting}
    >
      {deleting ? "..." : "Удалить"}
    </button>
  );
}
