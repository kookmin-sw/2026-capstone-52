const DEFAULT_API_BASE_URL = "/api/backend";
const ACCESS_TOKEN_STORAGE_KEY = "eeum-api-access-token";

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

function buildApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function isFormDataBody(body) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export class ApiError extends Error {
  constructor(message, { status = 0, payload = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function canUseStorage() {
  return typeof window !== "undefined";
}

function getStoredAccessToken() {
  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function setStoredAccessToken(token) {
  if (!canUseStorage() || !token) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAccessToken() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export async function apiRequest(path, options = {}) {
  const { body, headers, ...restOptions } = options;
  const requestHeaders = new Headers(headers || {});
  let requestBody = body;
  const accessToken = getStoredAccessToken();

  if (accessToken && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const isBlobBody = typeof Blob !== "undefined" && body instanceof Blob;

  if (body && typeof body === "object" && !isFormDataBody(body) && !isBlobBody) {
    requestHeaders.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(buildApiUrl(path), {
    ...restOptions,
    headers: requestHeaders,
    body: requestBody,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload
        ? payload.detail || payload.message || "API 요청에 실패했습니다."
        : payload || "API 요청에 실패했습니다.";

    throw new ApiError(message, { status: response.status, payload });
  }

  if (payload && typeof payload === "object" && payload.success === false) {
    throw new ApiError(payload.message || "API 요청에 실패했습니다.", {
      status: response.status,
      payload,
    });
  }

  return payload && typeof payload === "object" && "data" in payload ? payload.data : payload;
}
