---
layout: default
title: "개발 환경 설정"
parent: "개발 가이드"
nav_order: 2
has_toc: true
permalink: /documents/development/setup/
---

# 개발 환경 설정

## 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

## 프로덕션 빌드 확인

```bash
cd frontend
npm run build
npm run start
```

## 백엔드 API 환경 변수 예시

```bash
NEXT_PUBLIC_USE_BACKEND_API=true
NEXT_PUBLIC_API_BASE_URL=/api/backend
BACKEND_API_URL=http://localhost:8000
```

## 백엔드 실행 예시

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
