# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: test/backend-api-integration.spec.ts >> frontend-backend API integration smoke >> dashboard and mypage flows call the expected backend APIs successfully
- Location: test/backend-api-integration.spec.ts:91:7

# Error details

```
Error: all observed backend calls should succeed

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "POST /api/chat/3 -> 500 (Internal Server Error)",
+ ]
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - generic [ref=e5]:
          - button "← 돌아가기" [ref=e6] [cursor=pointer]
          - generic [ref=e7]: ·
          - heading "마이페이지" [level=1] [ref=e8]
        - generic [ref=e9]:
          - button "프로필 수정" [ref=e10] [cursor=pointer]
          - button "↪ 로그아웃" [ref=e11] [cursor=pointer]
    - main [ref=e12]:
      - generic [ref=e14]:
        - generic [ref=e16]:
          - button "프로필 이미지 변경" [ref=e17] [cursor=pointer]:
            - generic [ref=e18]: 👨‍💻
            - generic: 사진 변경
          - generic [ref=e19]:
            - generic [ref=e20]:
              - heading "이지안" [level=2] [ref=e21]
              - button "⌘ 전체 그래프" [ref=e22] [cursor=pointer]
            - paragraph [ref=e23]: 소프트웨어전공 · 대학생
            - generic [ref=e24]:
              - generic [ref=e25]: 예시 중심 설명
              - generic [ref=e26]: 과제 / 프로젝트
              - generic [ref=e27]: 컴퓨터공학
        - generic [ref=e28]:
          - generic [ref=e29]:
            - strong [ref=e30]: "0"
            - generic [ref=e31]: 진행 프로젝트
          - generic [ref=e32]:
            - strong [ref=e33]: "0"
            - generic [ref=e34]: 총 학습 횟수
          - generic [ref=e35]:
            - strong [ref=e36]: "0"
            - generic [ref=e37]: 진단 횟수
          - generic [ref=e38]:
            - strong [ref=e39]: "0"
            - generic [ref=e40]: 이해 개념
      - generic [ref=e43]:
        - heading "최근 학습 기록" [level=3] [ref=e44]
        - paragraph [ref=e45]: 최근 30일
  - button "Open Next.js Dev Tools" [ref=e52] [cursor=pointer]:
    - img [ref=e53]
  - alert [ref=e56]
```

# Test source

```ts
  95  | 
  96  |     page.on("console", (message) => {
  97  |       if (["error", "warning"].includes(message.type())) {
  98  |         consoleMessages.push(`${message.type()}: ${message.text()}`);
  99  |       }
  100 |     });
  101 | 
  102 |     await page.addInitScript(() => {
  103 |       window.localStorage.removeItem("eeum-current-api-user-id");
  104 |       window.localStorage.removeItem("eeum-google-login-active");
  105 |     });
  106 | 
  107 |     await goto(page, "/dashboard");
  108 | 
  109 |     const createProjectButton = page.getByRole("button", {
  110 |       name: /새 프로젝트 생성|교과목 추가/,
  111 |     });
  112 | 
  113 |     await expect(createProjectButton).toBeVisible();
  114 |     await createProjectButton.click();
  115 | 
  116 |     const subjectOption = page
  117 |       .getByRole("radio")
  118 |       .filter({ hasText: /운영체제|자료구조|알고리즘|컴퓨터 네트워크/ })
  119 |       .first();
  120 |     await expect(subjectOption).toBeVisible();
  121 |     await subjectOption.click();
  122 | 
  123 |     const createButton = page.getByRole("button", { name: /^생성$/ });
  124 |     await expect(createButton).toBeEnabled();
  125 |     await createButton.click();
  126 |     await waitForFrontendSettled(page);
  127 | 
  128 |     const chatInput = page.getByPlaceholder("질문을 입력하세요.");
  129 |     await expect(chatInput).toBeVisible();
  130 |     await chatInput.fill("Playwright API 연동 확인용 질문");
  131 | 
  132 |     const sendButton = page.getByRole("button", { name: "전송" });
  133 |     await expect(sendButton).toBeEnabled();
  134 |     await sendButton.click();
  135 |     await waitForFrontendSettled(page);
  136 | 
  137 |     await goto(page, "/mypage");
  138 | 
  139 |     const editProfileButton = page.getByRole("button", { name: "프로필 수정" }).first();
  140 |     await expect(editProfileButton).toBeVisible();
  141 |     await editProfileButton.click();
  142 | 
  143 |     const saveProfileButton = page.getByRole("button", { name: "저장" });
  144 |     await expect(saveProfileButton).toBeVisible();
  145 |     await saveProfileButton.click();
  146 |     await waitForFrontendSettled(page);
  147 | 
  148 |     const failedCalls = calls.filter((call) => !call.ok);
  149 |     const uploadOrDiagnosisCalls = calls.filter((call) => /^\/api\/(upload|diagnosis)(\/|$)/.test(call.path));
  150 |     const requiredCalls: Array<{ label: string; matches: (call: ApiCall) => boolean }> = [
  151 |       {
  152 |         label: "create or load current user",
  153 |         matches: (call) =>
  154 |           (call.method === "POST" && /^\/api\/users\/?$/.test(call.path)) ||
  155 |           (call.method === "GET" && /^\/api\/users\/\d+$/.test(call.path)),
  156 |       },
  157 |       { label: "save user profile", matches: (call) => call.method === "PATCH" && /^\/api\/users\/\d+$/.test(call.path) },
  158 |       { label: "load user projects", matches: (call) => call.method === "GET" && /^\/api\/projects\/user\/\d+$/.test(call.path) },
  159 |       { label: "create project from subject catalog", matches: (call) => call.method === "POST" && /^\/api\/projects\/?$/.test(call.path) },
  160 |       { label: "load project chats", matches: (call) => call.method === "GET" && /^\/api\/chat\/project\/\d+$/.test(call.path) },
  161 |       { label: "send chat message", matches: (call) => call.method === "POST" && /^\/api\/chat\/\d+$/.test(call.path) },
  162 |       { label: "load project graph", matches: (call) => call.method === "GET" && /^\/api\/graph\/\d+$/.test(call.path) },
  163 |       { label: "load recent graph nodes", matches: (call) => call.method === "GET" && /^\/api\/graph\/\d+\/recent$/.test(call.path) },
  164 |       { label: "load project memo", matches: (call) => call.method === "GET" && /^\/api\/projects\/\d+\/memo$/.test(call.path) },
  165 |       { label: "load mypage", matches: (call) => call.method === "GET" && /^\/api\/mypage\/\d+$/.test(call.path) },
  166 |       { label: "load learning logs", matches: (call) => call.method === "GET" && /^\/api\/learning-logs\/user\/\d+$/.test(call.path) },
  167 |     ];
  168 |     const missingRequiredCalls = requiredCalls
  169 |       .filter((requiredCall) => !calls.some(requiredCall.matches))
  170 |       .map((requiredCall) => requiredCall.label);
  171 | 
  172 |     console.table(calls.map((call) => ({
  173 |       method: call.method,
  174 |       path: call.path,
  175 |       status: call.status || call.error || "ERR",
  176 |     })));
  177 | 
  178 |     if (consoleMessages.length) {
  179 |       console.log("Browser console warnings/errors:");
  180 |       console.log(consoleMessages.join("\n"));
  181 |     }
  182 | 
  183 |     expect(
  184 |       calls.length,
  185 |       [
  186 |         "No backend API calls were observed.",
  187 |         "Check that the frontend dev server was restarted after setting NEXT_PUBLIC_USE_BACKEND_API=true.",
  188 |         "Recommended frontend/.env.local setup:",
  189 |         "  NEXT_PUBLIC_USE_BACKEND_API=true",
  190 |         "  BACKEND_API_URL=http://localhost:8000",
  191 |         "  Do not set NEXT_PUBLIC_API_BASE_URL unless it includes /api, e.g. http://localhost:8000/api",
  192 |       ].join("\n"),
  193 |     ).toBeGreaterThan(0);
  194 |     expect.soft(uploadOrDiagnosisCalls.map(formatCall), "upload/diagnosis flows are intentionally excluded").toEqual([]);
> 195 |     expect.soft(failedCalls.map(formatCall), "all observed backend calls should succeed").toEqual([]);
      |                                                                                           ^ Error: all observed backend calls should succeed
  196 |     expect(missingRequiredCalls).toEqual([]);
  197 |   });
  198 | });
  199 | 
```