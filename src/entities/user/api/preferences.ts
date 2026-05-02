import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../shared/api/firebase/firebase";

type UserPreferenceDocument = {
  dailyRemindersEnabled?: unknown;
  lastDailyReminderDate?: unknown;
};

export type UserReminderSettings = {
  dailyRemindersEnabled: boolean;
  lastDailyReminderDate: string;
};

export async function getUserReminderSettings(userId: string): Promise<UserReminderSettings> {
  const snapshot = await getDoc(doc(db, "users", userId));
  if (!snapshot.exists()) {
    return {
      dailyRemindersEnabled: false,
      lastDailyReminderDate: "",
    };
  }

  const data = snapshot.data() as UserPreferenceDocument;
  return {
    dailyRemindersEnabled: data.dailyRemindersEnabled === true,
    lastDailyReminderDate: typeof data.lastDailyReminderDate === "string" ? data.lastDailyReminderDate : "",
  };
}

export async function updateDailyRemindersEnabled(userId: string, enabled: boolean) {
  await setDoc(doc(db, "users", userId), { dailyRemindersEnabled: enabled }, { merge: true });
}

export async function updateLastDailyReminderDate(userId: string, value: string) {
  await setDoc(doc(db, "users", userId), {
    lastDailyReminderDate: value,
  }, { merge: true });
}
