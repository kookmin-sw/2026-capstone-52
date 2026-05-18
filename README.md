<p align="center">
  <img src="./docs/assets/images/eeum_banner.png" alt="EEUM 헤더 배너" width="100%" />
</p>

<div align="center">
  <h1>EEUM : PDF 기반 개인화 학습 및 수준 진단 AI 서비스</h1>
  <h3>나의 이해를 읽고, 배움의 흐름을 잇다</h3>
  <p>
    PDF 학습 자료와 수준 진단 결과를 기반으로 AI가 현재 이해 수준을 분석하고,<br />
    선수 개념부터 맞춤형 질의응답까지 이어주는 자기주도 AI 학습 튜터 서비스입니다.
  </p>
</div>


## 목차

1. 📌 [프로젝트 소개](#프로젝트-소개)
2. ✨ [주요 기능](#주요-기능)
3. 🎬 [소개 영상](#소개-영상)
4. 🏗️ [시스템 구조](#시스템-구조)
5. 👥 [팀원 소개](#팀원-소개)
6. 🛠️ [기술 스택](#기술-스택)
7. 📁 [폴더 구조](#폴더-구조)
8. 🚀 [실행 방법](#실행-방법)
9. 📚 [참고 자료](#참고-자료)

---

## 📌 프로젝트 소개
<p align="center">
  <img src="./docs/assets/images/capstone_52_poster.png" alt="EEUM 캡스톤 포스터" width="720" />
</p>

기존 LLM 기반 학습 서비스는 사용자의 현재 이해 수준을 충분히 반영하지 못하고,
단순 질의응답 중심으로 동작하는 경우가 많습니다.

EEUM은 사용자의 학습 자료와 수준 진단 결과를 기반으로,
개인의 이해 상태를 분석하고 맞춤형 학습 경험을 제공하는 것을 목표로 합니다.

### 핵심 차별점

- 단순 챗봇이 아닌 수준 진단 기반 개인화 학습
- 선수 개념 기반 진단 흐름
- PDF + Knowledge Graph + RAG 결합 구조
- 프로젝트 단위 학습 상태 추적
- 학습 로그 및 메모 기반 학습 관리
- N-term 간 집중 학습 개념에 대한 미니 퀴즈

---

## ✨ 주요 기능

### 1. PDF 업로드 및 분석

- PDF 학습 자료 업로드
- 핵심 개념 추출
- 개념 간 관계 분석

- 선수 개념 기반 질문 생성
- 사용자 이해도 분석
- 개념별 상태 추적

### 3. AI 질의응답

- PDF 기반 답변 생성
- 개인 수준 반영 설명
- 학습 흐름 기반 응답

### 4. Knowledge Graph

- 개념 간 관계 시각화
- 학습 상태 변화 추적
- 프로젝트별 그래프 관리

### 5. 학습 기록 관리

- 프로젝트별 채팅 기록 저장
- 학습 로그 저장
- 프로젝트 메모장 기능

### 6. 미니 퀴즈
- N-term 간 집중 학습 개념에 대한 미니 퀴즈
- 지속적인 사용자 수준 업데이트

---
## 🎬 소개 영상
>시연 영상 추가예정
---

## 🏗️ 서비스 시스템 아키텍처

<img width="1536" alt="서비스 시스템 아키텍처" src="./docs/assets/images/eeum_service_architecture.png" />

---
## 👥 팀원 소개

<table>
  <tr>
    <th width="300" align="center">이송하</th>
    <th width="300" align="center">박혜민</th>
  </tr>
  <tr>
    <td align="center"><img src="./docs/assets/people/songha.png" width="190" height="190" alt="songha"/></td>
    <td align="center"><img src="./docs/assets/people/hyemin.png" width="190" height="190" alt="hyemin"/></td>
  </tr>
  <tr>
    <td align="center">20215210</td>
    <td align="center">20222971</td>
  </tr>
  <tr>
    <td align="center">songha327@kookmin.ac.kr</td>
    <td align="center">hyeals22@gmail.com</td>
  </tr>
  <tr>
    <td align="center">Frontend</td>
    <td align="center">Backend</td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/hassong327">@hassong327</a></td>
    <td align="center"><a href="https://github.com/hyeals2">@hyeals2</a></td>
  </tr>
  <tr>
    <th width="300" align="center">조민정</th>
    <th width="300" align="center">민태윤</th>
  </tr>
  <tr>
    <td align="center"><img src="./docs/assets/people/minjeong.png" width="190" height="190" alt="minjeong"/></td>
    <td align="center"><img src="./docs/assets/people/taeyoon.png" width="190" height="190" alt="taeyoon"/></td>
  </tr>
  <tr>
    <td align="center">20231895</td>
    <td align="center">20233138</td>
  </tr>
  <tr>
    <td align="center">chominjung821@kookmin.ac.kr</td>
    <td align="center">mintaeyoon@kookmin.ac.kr</td>
  </tr>
  <tr>
    <td align="center">Backend</td>
    <td align="center">AI</td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/itsminjeong">@itsminjeong</a></td>
    <td align="center"><a href="https://github.com/Min-Taeyoon">@Min-Taeyoon</a></td>
  </tr>
</table>

---

## 🛠️ 기술 스택

### 🖥️ Frontend

| 역할 | 종류 |
| --- | --- |
| Framework | <img src="https://img.shields.io/badge/Next.js%2015.2.4-000000.svg?style=for-the-badge&logo=nextdotjs&logoColor=white"/> <img src="https://img.shields.io/badge/React%2019-61DAFB.svg?style=for-the-badge&logo=react&logoColor=000000"/> |
| Programming Language | <img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white"/> <img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=for-the-badge&logo=javascript&logoColor=000000"/> |
| Styling | <img src="https://img.shields.io/badge/Tailwind%20CSS%203.4.17-06B6D4.svg?style=for-the-badge&logo=tailwindcss&logoColor=white"/> <img src="https://img.shields.io/badge/PostCSS-DD3A0A.svg?style=for-the-badge&logo=postcss&logoColor=white"/> |
| State Management | <img src="https://img.shields.io/badge/Zustand-443E38.svg?style=for-the-badge&logo=react&logoColor=white"/> |
| Animation / UI | <img src="https://img.shields.io/badge/Framer%20Motion-0055FF.svg?style=for-the-badge&logo=framer&logoColor=white"/> <img src="https://img.shields.io/badge/FontAwesome-528DD7.svg?style=for-the-badge&logo=fontawesome&logoColor=white"/> |
| Visualization | <img src="https://img.shields.io/badge/react--force--graph--2d-61DAFB.svg?style=for-the-badge&logo=react&logoColor=000000"/> |
| Authentication | <img src="https://img.shields.io/badge/Google%20Identity%20Services-4285F4.svg?style=for-the-badge&logo=google&logoColor=white"/> |
| Test | <img src="https://img.shields.io/badge/Playwright-2EAD33.svg?style=for-the-badge&logo=playwright&logoColor=white"/> |

### 💾 Backend

| 역할 | 종류 |
| --- | --- |
| Framework | <img src="https://img.shields.io/badge/FastAPI-009688.svg?style=for-the-badge&logo=fastapi&logoColor=white"/> |
| Programming Language | <img src="https://img.shields.io/badge/Python-3776AB.svg?style=for-the-badge&logo=python&logoColor=white"/> |
| ASGI Server | <img src="https://img.shields.io/badge/Uvicorn-499848.svg?style=for-the-badge&logo=gunicorn&logoColor=white"/> |
| ORM / Validation | <img src="https://img.shields.io/badge/SQLAlchemy-D71F00.svg?style=for-the-badge&logo=sqlalchemy&logoColor=white"/> <img src="https://img.shields.io/badge/Pydantic-E92063.svg?style=for-the-badge&logo=pydantic&logoColor=white"/> |
| Database | <img src="https://img.shields.io/badge/SQLite-003B57.svg?style=for-the-badge&logo=sqlite&logoColor=white"/> <img src="https://img.shields.io/badge/PostgreSQL%20/%20RDS-4169E1.svg?style=for-the-badge&logo=postgresql&logoColor=white"/> |
| Storage | <img src="https://img.shields.io/badge/Amazon%20S3-569A31.svg?style=for-the-badge&logo=amazons3&logoColor=white"/> |
| File Upload / Env | <img src="https://img.shields.io/badge/python--multipart-3776AB.svg?style=for-the-badge&logo=python&logoColor=white"/> <img src="https://img.shields.io/badge/python--dotenv-ECD53F.svg?style=for-the-badge&logo=dotenv&logoColor=000000"/> |
| API | <img src="https://img.shields.io/badge/REST%20API-02569B.svg?style=for-the-badge&logo=fastapi&logoColor=white"/> |

### 🤖 AI

| 역할 | 종류 |
| --- | --- |
| LLM Platform | <img src="https://img.shields.io/badge/Amazon%20Bedrock-FF9900.svg?style=for-the-badge&logo=amazonaws&logoColor=white"/> |
| LLM Model | <img src="https://img.shields.io/badge/Claude%203.5%20Sonnet-D97757.svg?style=for-the-badge&logo=anthropic&logoColor=white"/> |
| SDK | <img src="https://img.shields.io/badge/boto3-3776AB.svg?style=for-the-badge&logo=python&logoColor=white"/> |
| PDF Processing | <img src="https://img.shields.io/badge/pdfplumber-4B8BBE.svg?style=for-the-badge&logo=python&logoColor=white"/> |
| Graph Extraction | <img src="https://img.shields.io/badge/Concept%20Graph-FF6B6B.svg?style=for-the-badge&logo=neo4j&logoColor=white"/> |
| Concept Normalization | <img src="https://img.shields.io/badge/Alias%20JSON-000000.svg?style=for-the-badge&logo=json&logoColor=white"/> <img src="https://img.shields.io/badge/Fuzzy%20Matching-5C2D91.svg?style=for-the-badge&logo=python&logoColor=white"/> |
| Diagnosis | <img src="https://img.shields.io/badge/LLM%20Question%20Generation-8A2BE2.svg?style=for-the-badge&logo=openai&logoColor=white"/> <img src="https://img.shields.io/badge/Deterministic%20Scoring-3776AB.svg?style=for-the-badge&logo=python&logoColor=white"/> |
| Retrieval | <img src="https://img.shields.io/badge/Keyword%20/%20Phrase%20Retrieval-FFB000.svg?style=for-the-badge&logo=json&logoColor=000000"/> |

## 📁 폴더 구조

```text
2026-capstone-52/
  ├── app/                          # FastAPI 백엔드 및 AI 로직
  │   ├── main.py                   # FastAPI 앱 진입점, 라우터 등록
  │   ├── core/                     # 환경변수 및 공통 설정
  │   │   └── config.py             # DB, AWS S3, Bedrock 모델 설정
  │   ├── db/                       # 데이터베이스 연결 설정
  │   │   ├── base.py               # SQLAlchemy Base
  │   │   └── session.py            # DB 엔진 및 세션 관리
  │   ├── api/                      # API 라우터 계층
  │   │   └── routes/
  │   │       ├── users.py          # 사용자/Google 로그인 API
  │   │       ├── projects.py       # 프로젝트 API
  │   │       ├── project_memos.py  # 프로젝트 메모 API
  │   │       ├── learning_logs.py  # 학습 로그 API
  │   │       ├── mypage.py         # 마이페이지 API
  │   │       ├── upload.py         # PDF 업로드 및 분석 API
  │   │       ├── graph.py          # 지식 그래프 API
  │   │       ├── chat.py           # AI 채팅 API
  │   │       ├── diagnosis.py      # 진단 문항 API
  │   │       └── explanation.py    # 맞춤 설명 API
  │   ├── models/                   # SQLAlchemy ORM 모델
  │   ├── schemas/                  # Pydantic 요청/응답 스키마
  │   ├── services/                 # 비즈니스 로직 계층
  │   ├── ai/                       # AI 기능 모듈
  │   │   ├── llm_client.py         # Amazon Bedrock Claude 호출 공통 클라이언트
  │   │   ├── graph_extractor.py    # PDF 기반 개념/관계 추출
  │   │   ├── concept_normalizer.py # 개념 alias/fuzzy/LLM 정규화
  │   │   ├── chat_ai.py            # 학습 채팅 AI
  │   │   ├── diagnosis_ai.py       # 진단 문항 생성 및 채점
  │   │   └── explanation_ai.py     # 개인화 설명 생성
  │   ├── data/                     # AI 분석용 로컬 데이터
  │   │   ├── aliases/              # 과목별 개념 alias JSON
  │   │   └── backbone/             # 과목별 backbone chunk JSON
  │   └── utils/                    # 공통 유틸리티
  │
  ├── frontend/                     # Next.js 프론트엔드 애플리케이션
  │   ├── app/                      # Next.js App Router 페이지
  │   │   ├── layout.jsx            # 전체 레이아웃
  │   │   ├── page.tsx              # 랜딩 페이지
  │   │   ├── dashboard/            # 대시보드 페이지
  │   │   ├── diagnosis/            # 진단 페이지
  │   │   ├── login/                # 로그인 페이지
  │   │   ├── mypage/               # 마이페이지
  │   │   ├── project/[projectId]/  # 프로젝트 상세 페이지
  │   │   └── upload/               # PDF 업로드 페이지
  │   ├── components/               # React UI 컴포넌트
  │   │   ├── common/               # 공통 컴포넌트
  │   │   ├── dashboard/            # 대시보드 컴포넌트
  │   │   ├── diagnosis/            # 진단 컴포넌트
  │   │   ├── graph/                # 지식 그래프 시각화 컴포넌트
  │   │   ├── landing/              # 랜딩 페이지 컴포넌트
  │   │   ├── mypage/               # 마이페이지 컴포넌트
  │   │   ├── profile/              # 프로필 컴포넌트
  │   │   ├── project/              # 프로젝트 컴포넌트
  │   │   └── upload/               # 업로드 컴포넌트
  │   ├── features/                 # 도메인별 프론트 로직/API 클라이언트
  │   │   ├── api/                  # 공통 API client/session
  │   │   ├── dashboard/
  │   │   ├── diagnosis/
  │   │   ├── graph/
  │   │   ├── learning-log/
  │   │   ├── mypage/
  │   │   ├── project/
  │   │   ├── upload/
  │   │   └── workspace/
  │   ├── data/                     # Mock 데이터 및 샘플 데이터
  │   ├── public/                   # 정적 에셋
  │   │   ├── icons/                # SVG 아이콘
  │   │   └── images/               # 이미지 에셋
  │   ├── store/                    # Zustand 상태 관리
  │   ├── test/                     # Playwright 테스트
  │   ├── types/                    # TypeScript 타입 정의
  │   ├── font/                     # Pretendard 폰트 파일
  │   ├── next.config.mjs           # Next.js 설정
  │   ├── tailwind.config.js        # Tailwind CSS 설정
  │   ├── package.json              # 프론트엔드 의존성 및 스크립트
  │   └── tsconfig.json             # TypeScript 설정
  │
  ├── scripts/                      # 개발/전처리 스크립트
  │   └── preprocess_backbone_pdf.py # PDF를 backbone chunk JSON으로 변환
  ├── .env.example                  # 환경변수 예시 파일
  ├── .gitignore                    # Git 무시 파일 설정
  ├── requirements.txt              # 백엔드 Python 의존성
  ├── package-lock.json             # 루트 npm lock 파일
  └── README.md                     # 프로젝트 README
```

## 🚀 실행 방법

### 📖 사용법 (개발 환경 설정)

이 섹션은 EEUM 프로젝트의 개발 환경을 로컬에서 설정하고 실행하는 방법에 대한 안내입니다.
프로젝트는 FastAPI 백엔드, Next.js 프론트엔드, Amazon Bedrock 기반 AI 기능으로 구성되어 있습니다.

### 1. 저장소 복제

```bash
git clone https://github.com/kookmin-sw/2026-capstone-52.git
cd 2026-capstone-52
```

### 2. 백엔드 (FastAPI)

백엔드 API 서버를 로컬에서 실행하는 방법입니다.
기본 실행 주소는 `http://localhost:8000`입니다.

1. 가상 환경 생성 및 활성화

```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. 의존성 설치

```bash
pip install -r requirements.txt
```

3. 환경 변수 설정

`.env.example` 파일을 복사하여 `.env` 파일을 생성합니다.

```bash
cp .env.example .env
```

로컬 개발용 기본 예시는 다음과 같습니다.

```env
DATABASE_URL=sqlite:///./dev.db
S3_BUCKET_NAME=your-bucket-name
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
USE_S3=false
```

- `DATABASE_URL`: 로컬 개발 시 SQLite 사용 가능
- `USE_S3=false`: S3 업로드를 비활성화하고 기본 API 기능을 테스트할 때 사용
- AI 기능 및 실제 PDF 분석을 사용하려면 AWS 자격 증명, S3 버킷, Bedrock 권한이 필요합니다.

4. 개발 서버 실행

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

실행 후 다음 주소에서 확인할 수 있습니다.

- API 서버: `http://localhost:8000`
- Swagger 문서: `http://localhost:8000/docs`

### 3. 프론트엔드 (Next.js)

프론트엔드 애플리케이션을 로컬에서 실행하는 방법입니다.
기본 실행 주소는 `http://localhost:3000`입니다.

1. 프론트엔드 디렉토리로 이동

```bash
cd frontend
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

`frontend/.env.local` 파일을 생성합니다.

```bash
touch .env.local
```

백엔드 API와 연동하려면 다음 값을 설정합니다.

```env
NEXT_PUBLIC_USE_BACKEND_API=true
BACKEND_API_URL=http://localhost:8000
```

Google 로그인을 사용할 경우 아래 값도 추가합니다.

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

참고로 일반 로컬 개발에서는 `NEXT_PUBLIC_API_BASE_URL`을 따로 설정하지 않아도 됩니다.
기본적으로 프론트엔드는 `/api/backend/*` 요청을 Next.js rewrite를 통해 `http://localhost:8000/api/*`로 전달합니다.

4. 개발 서버 실행

```bash
npm run dev
```

실행 후 `http://localhost:3000`에서 애플리케이션을 확인할 수 있습니다.

### 4. AI / PDF 분석 기능

AI 기능은 Amazon Bedrock의 Claude 모델을 사용합니다.

- 사용 모델 기본값

```env
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
```

- PDF 업로드 및 그래프 분석 기능은 다음 흐름으로 동작합니다.
  - PDF 업로드
  - S3 저장
  - PDF 텍스트 추출
  - Bedrock Claude를 통한 개념 및 관계 추출
  - 개념 그래프 DB 저장

로컬에서 단순 API/프론트 기능만 확인할 경우 `USE_S3=false`로 실행할 수 있습니다.
다만 실제 PDF 분석, S3 저장, Bedrock 기반 AI 응답을 테스트하려면 AWS 인증 정보와 권한 설정이 필요합니다.

### 5. 실행 순서 요약

로컬에서 전체 서비스를 확인하려면 터미널을 두 개 사용합니다.

1. 백엔드 실행

```bash
cd 2026-capstone-52
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. 프론트엔드 실행

```bash
cd 2026-capstone-52/frontend
npm run dev
```

3. 브라우저 접속

```text
http://localhost:3000
```

## 📚 참고 자료

| 번호 | 종류 | 제목 | 출처 | 발행년도 | 저자 | 기타 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 논문 | Generative AI without guardrails can harm learning: Evidence from high school mathematics | Proceedings of the National Academy of Sciences | 2025 | Bastani, Hamsa, et al. |  |
| 2 | 논문 | The science of effective learning with spacing and retrieval practice | Nature Reviews Psychology | 2022 | Carpenter, Shana K., Steven C. Pan, and Andrew C. Butler. |  |
| 3 | 논문 | AI meets the classroom: When do large language models harm learning? | arXiv preprint | 2024 | Lehmann, Matthias, Philipp B. Cornelius, and Fabian J. Sting. |  |
