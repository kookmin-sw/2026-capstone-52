import { apiRequest } from "./client";

const CURRENT_USER_STORAGE_KEY = "eeum-current-api-user-id";

const DEFAULT_USER_PROFILE = {
  emailPrefix: "local-dev",
  nickname: "이지안",
  profile_image: null,
  major: "컴퓨터공학과",
  learning_fields: "Frontend Engineer",
  current_level: "beginner",
  preferred_explanation_style: "example",
  learning_goal: "project",
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function getStoredUserId() {
  if (!canUseStorage()) {
    return process.env.NEXT_PUBLIC_EEUM_USER_ID || null;
  }

  return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY) || process.env.NEXT_PUBLIC_EEUM_USER_ID || null;
}

function setStoredUserId(userId) {
  if (!canUseStorage() || !userId) {
    return;
  }

  window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, String(userId));
}

function buildLocalEmail() {
  const suffix =
    canUseStorage() && typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${DEFAULT_USER_PROFILE.emailPrefix}-${suffix}@eeum.local`;
}

export function mapApiUserToProfile(user) {
  return {
    name: user?.nickname || DEFAULT_USER_PROFILE.nickname,
    language: "한국어",
    job: user?.learning_fields || DEFAULT_USER_PROFILE.learning_fields,
    major: user?.major || DEFAULT_USER_PROFILE.major,
    explanationStyle: ["example", "step", "concise", "deep"].includes(user?.preferred_explanation_style)
      ? user.preferred_explanation_style
      : DEFAULT_USER_PROFILE.preferred_explanation_style,
    learningType: ["exam", "concept", "project", "light"].includes(user?.learning_goal)
      ? user.learning_goal
      : DEFAULT_USER_PROFILE.learning_goal,
  };
}

export function mapProfileToApiUpdate(profile, profileImage = null) {
  return {
    nickname: profile.name,
    profile_image: profileImage,
    major: profile.major,
    learning_fields: profile.job,
    preferred_explanation_style: profile.explanationStyle,
    learning_goal: profile.learningType,
  };
}

export async function getApiUser(userId) {
  return apiRequest(`/users/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
}

export async function ensureCurrentUser() {
  const storedUserId = getStoredUserId();

  if (storedUserId) {
    try {
      const user = await getApiUser(storedUserId);
      setStoredUserId(user.user_id);
      return user;
    } catch {
      // The EC2 DB can be recreated while localStorage still has an old id.
    }
  }

  const user = await apiRequest("/users/", {
    method: "POST",
    body: {
      email: buildLocalEmail(),
      nickname: DEFAULT_USER_PROFILE.nickname,
      profile_image: DEFAULT_USER_PROFILE.profile_image,
    },
  });

  setStoredUserId(user.user_id);

  try {
    return await apiRequest(`/users/${encodeURIComponent(user.user_id)}`, {
      method: "PATCH",
      body: {
        major: DEFAULT_USER_PROFILE.major,
        learning_fields: DEFAULT_USER_PROFILE.learning_fields,
        current_level: DEFAULT_USER_PROFILE.current_level,
        preferred_explanation_style: DEFAULT_USER_PROFILE.preferred_explanation_style,
        learning_goal: DEFAULT_USER_PROFILE.learning_goal,
      },
    });
  } catch {
    return user;
  }
}

export async function getCurrentUserId() {
  const user = await ensureCurrentUser();
  return Number(user.user_id);
}

/**
 * @param {import("@/types/profile").ProfileInfo} profile
 * @param {string | null} profileImage
 */
export async function updateCurrentUserProfile(profile, profileImage = null) {
  const userId = await getCurrentUserId();
  const user = await apiRequest(`/users/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: mapProfileToApiUpdate(profile, profileImage),
  });

  return mapApiUserToProfile(user);
}
