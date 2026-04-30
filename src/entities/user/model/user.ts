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
  description?: string;
  avatarDataUrl?: string;
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
};
