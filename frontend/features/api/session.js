import { ApiError, apiRequest, clearStoredAccessToken, setStoredAccessToken } from "./client";

const CURRENT_USER_STORAGE_KEY = "eeum-current-api-user-id";
const GOOGLE_LOGIN_STORAGE_KEY = "eeum-google-login-active";
const isBackendApiEnabled = process.env.NEXT_PUBLIC_USE_BACKEND_API === "true";

const DEFAULT_USER_PROFILE = {
  emailPrefix: "local-dev",
  nickname: "이지안",
  profile_image: null,
  major: "소프트웨어전공",
  learning_fields: "대학생",
  current_level: "beginner",
  preferred_explanation_style: "example",
  learning_goal: "컴퓨터공학",
  learning_type: "project",
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

export function setCurrentUserId(userId) {
  setStoredUserId(userId);
}

function emitSessionChange() {
  if (!canUseStorage()) {
    return;
  }

  window.dispatchEvent(new Event("eeum-auth-session-change"));
}

function setGoogleLoginActive() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(GOOGLE_LOGIN_STORAGE_KEY, "true");
}

export function hasGoogleLoginSession() {
  if (!canUseStorage()) {
    return false;
  }

  return window.localStorage.getItem(GOOGLE_LOGIN_STORAGE_KEY) === "true" && Boolean(getStoredUserId());
}

export function logoutGoogleSession() {
  if (!canUseStorage()) {
    return;
  }

  clearStoredAccessToken();
  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  window.localStorage.removeItem(GOOGLE_LOGIN_STORAGE_KEY);
  emitSessionChange();
}

function redirectToLogin() {
  if (!canUseStorage() || window.location.pathname === "/login") {
    return;
  }

  window.location.assign("/login");
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
      : DEFAULT_USER_PROFILE.learning_type,
    learningGoal: user?.interest_field || user?.learning_goal || DEFAULT_USER_PROFILE.learning_goal,
  };
}

export function mapProfileToApiUpdate(profile, profileImage = null) {
  return {
    nickname: profile.name,
    profile_image: profileImage,
    preferred_explanation_style: profile.explanationStyle,
  };
}

export async function getApiUser(userId) {
  return apiRequest(`/users/${encodeURIComponent(userId)}`, {
    method: "GET",
  });
}

export async function ensureCurrentUser() {
  if (isBackendApiEnabled) {
    try {
      const user = await apiRequest("/users/me", {
        method: "GET",
      });
      setStoredUserId(user.user_id);
      return user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirectToLogin();
      }

      throw error;
    }
  }

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
        preferred_explanation_style: DEFAULT_USER_PROFILE.preferred_explanation_style,
      },
    });
  } catch {
    return user;
  }
}

/**
 * @param {{ email: string, nickname?: string | null, profile_image?: string | null }} profile
 */
export async function loginWithGoogleProfile({ email, nickname = null, profile_image = null }) {
  const user = await apiRequest("/users/google", {
    method: "POST",
    body: {
      email,
      nickname,
      profile_image,
    },
  });

  if (user.access_token) {
    setStoredAccessToken(user.access_token);
  }

  setStoredUserId(user.user_id);
  setGoogleLoginActive();
  emitSessionChange();
  return user;
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
  const path = isBackendApiEnabled ? "/users/me" : `/users/${encodeURIComponent(await getCurrentUserId())}`;
  const user = await apiRequest(path, {
    method: "PATCH",
    body: mapProfileToApiUpdate(profile, profileImage),
  });

  return mapApiUserToProfile(user);
}
