import type { FriendProfile } from "../../../entities/friend";
import {
  getMemoryShareRole,
  normalizeMemoryShares,
  type MemoryShareRole,
  type NormalizedMemoryShare,
} from "../../../entities/memory";

export function toggleMemoryShare(
  currentShares: NormalizedMemoryShare[],
  friend: FriendProfile,
  role: MemoryShareRole = "view"
) {
  const currentShare = currentShares.find((item) => item.userId === friend.id);
  if (currentShare) {
    return currentShares.filter((item) => item.userId !== friend.id);
  }

  return normalizeMemoryShares([
    ...currentShares,
    {
      userId: friend.id,
      username: friend.username,
      role: getMemoryShareRole(role),
      grantedAt: new Date(),
    },
  ]);
}

export function updateMemoryShareRole(
  currentShares: NormalizedMemoryShare[],
  friend: FriendProfile,
  role: MemoryShareRole
) {
  const normalizedRole = getMemoryShareRole(role);
  const nextShares = currentShares.map((item) => (
    item.userId === friend.id
      ? { ...item, role: normalizedRole }
      : item
  ));

  return normalizeMemoryShares(nextShares);
}
