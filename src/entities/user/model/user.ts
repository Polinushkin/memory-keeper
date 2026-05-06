export type ProfileVisibility = "public" | "friends" | "private";
export type SharedInvitePolicy = "friends" | "none";

export type UserRow = {
  username?: string;
  usernameLower?: string;
};

export type UsernameRow = {
  uid?: string;
  username?: string;
  usernameLower?: string;
  description?: string;
  avatarDataUrl?: string;
};

export type UserProfileRow = {
  username?: string;
  usernameLower?: string;
  description?: string;
  avatarDataUrl?: string;
  descriptionVisibility?: unknown;
  avatarVisibility?: unknown;
  sharedInvitePolicy?: unknown;
};

export type UsernameMetadata = {
  avatarDataUrl?: string;
  description?: string;
};

export type UserSearchResult = {
  id: string;
  username: string;
  usernameLower: string;
  description: string;
  avatarDataUrl: string;
  descriptionVisibility: ProfileVisibility;
  avatarVisibility: ProfileVisibility;
  sharedInvitePolicy: SharedInvitePolicy;
};

export function getProfileVisibility(value: unknown): ProfileVisibility {
  return value === "friends" || value === "private" ? value : "public";
}

export function getSharedInvitePolicy(value: unknown): SharedInvitePolicy {
  return value === "none" ? value : "friends";
}
