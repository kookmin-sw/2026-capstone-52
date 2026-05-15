import { expect, test, type Page, type Response } from "@playwright/test";

type ApiCall = {
  method: string;
  path: string;
  url: string;
  status?: number;
  ok: boolean;
  postData?: string | null;
  error?: string;
  responseBody?: string;
};

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3000";
const knownBackendPathPattern = /^\/(?:api\/backend\/|api\/)(?:users|projects|chat|graph|mypage|learning-logs|explanation|upload|diagnosis)(?:\/|$)/;

function isBackendApiUrl(url: string) {
  const parsedUrl = new URL(url);

  return knownBackendPathPattern.test(parsedUrl.pathname);
}

function normalizeApiPath(url: string) {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname.replace(/^\/api\/backend/, "/api");

  return path.startsWith("/api/") ? path : `/missing-api-prefix${path}`;
}

async function attachApiRecorder(page: Page, calls: ApiCall[]) {
  page.on("response", async (response: Response) => {
    const request = response.request();
    const url = response.url();

    if (!isBackendApiUrl(url)) {
      return;
    }

    const status = response.status();
    const isRedirect = status >= 300 && status < 400;
    const ok = response.ok() || isRedirect;
    const responseBody = ok ? undefined : await response.text().catch(() => undefined);

    calls.push({
      method: request.method(),
      path: normalizeApiPath(url),
      url,
      status,
      ok,
      postData: request.postData(),
      responseBody,
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();

    if (!isBackendApiUrl(url)) {
      return;
    }

    calls.push({
      method: request.method(),
      path: normalizeApiPath(url),
      url,
      ok: false,
      postData: request.postData(),
      error: request.failure()?.errorText || "request failed",
    });
  });
}

async function waitForFrontendSettled(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.waitForTimeout(600);
}

async function goto(page: Page, path: string) {
  await page.goto(`${baseURL}${path}`, { waitUntil: "domcontentloaded" });
  await waitForFrontendSettled(page);
}

function formatCall(call: ApiCall) {
  const status = call.status ? `${call.status}` : "ERR";
  const details = call.error || call.responseBody;
  return `${call.method} ${call.path} -> ${status}${details ? ` (${details.slice(0, 240)})` : ""}`;
}

test.describe("frontend-backend API integration smoke", () => {
  test("dashboard and mypage flows call the expected backend APIs successfully", async ({ page }) => {
    const calls: ApiCall[] = [];
    const consoleMessages: string[] = [];
    await attachApiRecorder(page, calls);

    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push(`${message.type()}: ${message.text()}`);
      }
    });

    await page.addInitScript(() => {
      window.localStorage.removeItem("eeum-current-api-user-id");
      window.localStorage.removeItem("eeum-google-login-active");
    });

    await goto(page, "/dashboard");

    const createProjectButton = page.getByRole("button", {
      name: /새 프로젝트 생성|교과목 추가/,
    });

    await expect(createProjectButton).toBeVisible();
    await createProjectButton.click();

    const subjectOption = page
      .getByRole("radio")
      .filter({ hasText: /운영체제|자료구조|알고리즘|컴퓨터 네트워크/ })
      .first();
    await expect(subjectOption).toBeVisible();
    await subjectOption.click();

    const createButton = page.getByRole("button", { name: /^생성$/ });
    await expect(createButton).toBeEnabled();
    await createButton.click();
    await waitForFrontendSettled(page);

    const chatInput = page.getByPlaceholder("질문을 입력하세요.");
    await expect(chatInput).toBeVisible();
    await chatInput.fill("Playwright API 연동 확인용 질문");

    const sendButton = page.getByRole("button", { name: "전송" });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
    await waitForFrontendSettled(page);

    await goto(page, "/mypage");

    const editProfileButton = page.getByRole("button", { name: "프로필 수정" }).first();
    await expect(editProfileButton).toBeVisible();
    await editProfileButton.click();

    const saveProfileButton = page.getByRole("button", { name: "저장" });
    await expect(saveProfileButton).toBeVisible();
    await saveProfileButton.click();
    await waitForFrontendSettled(page);

    const failedCalls = calls.filter((call) => !call.ok);
    const uploadOrDiagnosisCalls = calls.filter((call) => /^\/api\/(upload|diagnosis)(\/|$)/.test(call.path));
    const requiredCalls: Array<{ label: string; matches: (call: ApiCall) => boolean }> = [
      {
        label: "create or load current user",
        matches: (call) =>
          (call.method === "POST" && /^\/api\/users\/?$/.test(call.path)) ||
          (call.method === "GET" && /^\/api\/users\/\d+$/.test(call.path)),
      },
      { label: "save user profile", matches: (call) => call.method === "PATCH" && /^\/api\/users\/\d+$/.test(call.path) },
      { label: "load user projects", matches: (call) => call.method === "GET" && /^\/api\/projects\/user\/\d+$/.test(call.path) },
      { label: "create project from subject catalog", matches: (call) => call.method === "POST" && /^\/api\/projects\/?$/.test(call.path) },
      { label: "load project chats", matches: (call) => call.method === "GET" && /^\/api\/chat\/project\/\d+$/.test(call.path) },
      { label: "send chat message", matches: (call) => call.method === "POST" && /^\/api\/chat\/\d+$/.test(call.path) },
      { label: "load project graph", matches: (call) => call.method === "GET" && /^\/api\/graph\/\d+$/.test(call.path) },
      { label: "load recent graph nodes", matches: (call) => call.method === "GET" && /^\/api\/graph\/\d+\/recent$/.test(call.path) },
      { label: "load project memos", matches: (call) => call.method === "GET" && /^\/api\/projects\/\d+\/memos$/.test(call.path) },
      { label: "load mypage", matches: (call) => call.method === "GET" && /^\/api\/mypage\/\d+$/.test(call.path) },
      { label: "load learning logs", matches: (call) => call.method === "GET" && /^\/api\/learning-logs\/user\/\d+$/.test(call.path) },
    ];
    const missingRequiredCalls = requiredCalls
      .filter((requiredCall) => !calls.some(requiredCall.matches))
      .map((requiredCall) => requiredCall.label);

    console.table(calls.map((call) => ({
      method: call.method,
      path: call.path,
      status: call.status || call.error || "ERR",
    })));

    if (consoleMessages.length) {
      console.log("Browser console warnings/errors:");
      console.log(consoleMessages.join("\n"));
    }

    expect(
      calls.length,
      [
        "No backend API calls were observed.",
        "Check that the frontend dev server was restarted after setting NEXT_PUBLIC_USE_BACKEND_API=true.",
        "Recommended frontend/.env.local setup:",
        "  NEXT_PUBLIC_USE_BACKEND_API=true",
        "  BACKEND_API_URL=http://localhost:8000",
        "  Do not set NEXT_PUBLIC_API_BASE_URL unless it includes /api, e.g. http://localhost:8000/api",
      ].join("\n"),
    ).toBeGreaterThan(0);
    expect.soft(uploadOrDiagnosisCalls.map(formatCall), "upload/diagnosis flows are intentionally excluded").toEqual([]);
    expect.soft(failedCalls.map(formatCall), "all observed backend calls should succeed").toEqual([]);
    expect(missingRequiredCalls).toEqual([]);
  });
});
