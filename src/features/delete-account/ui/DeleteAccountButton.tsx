import { deleteUser } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { deleteAccountData } from "../../../entities/user/api/account";
import { getErrorMessage } from "../../../shared/lib/firebase-errors";

type DeleteAccountButtonProps = {
  userId: string;
  username: string;
  authUser: Parameters<typeof deleteUser>[0];
};

export default function DeleteAccountButton({
  userId,
  username,
  authUser,
}: DeleteAccountButtonProps) {
  const navigate = useNavigate();
  async function handleDeleteAccount() {
    const confirmed = window.confirm("Удалить аккаунт? Это действие удалит профиль, username и все воспоминания без возможности восстановления.");
    if (!confirmed) {
      return;
    }

    try {
      await deleteAccountData({ userId, username });
      await deleteUser(authUser);
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      window.alert(getErrorMessage(error, "Не удалось удалить аккаунт. Возможно, требуется заново войти в систему."));
    }
  }

  return (
    <button type="button" className="btnSmallDanger" onClick={() => void handleDeleteAccount()}>
      Удалить аккаунт
    </button>
  );
}
