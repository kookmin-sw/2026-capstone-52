# EEUM Deployment Guide

이 문서는 Amazon Linux 2023 EC2에서 EEUM 서비스를 도메인으로 배포하기 위한 기준 설정입니다.

- 도메인: `eeum-study.kr`
- EC2 Elastic IP: `34.206.229.66`
- Frontend: Next.js, 내부 포트 `3000`
- Backend: FastAPI, 내부 포트 `8000`
- 외부 접속:
  - Frontend: `http://eeum-study.kr`, `http://www.eeum-study.kr`
  - Backend API: `http://eeum-study.kr/api`
  - Swagger: `http://eeum-study.kr/docs`

주의: 실제 `JWT_SECRET_KEY`, Google Client Secret, `.env`, `.env.local`, `dev.db`, `dev.db.bak`는 커밋하지 않습니다.

## DNS

도메인 DNS A 레코드는 아래처럼 설정합니다.

```text
A @   34.206.229.66
A www 34.206.229.66
TTL 600
```

DNS 전파 확인:

```bash
dig eeum-study.kr
dig www.eeum-study.kr
```

## Nginx 설치

Amazon Linux 2023 기준:

```bash
sudo dnf update -y
sudo dnf install nginx -y
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

## Nginx 설정

`/etc/nginx/conf.d/eeum.conf` 파일을 생성합니다.

```nginx
server {
    listen 80;
    server_name eeum-study.kr www.eeum-study.kr;

    client_max_body_size 50m;

    location /api {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /docs {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /docs/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /openapi.json {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

중요: `/api`의 `proxy_pass`는 `http://127.0.0.1:8000`처럼 뒤에 `/api`나 trailing slash를 붙이지 않습니다. 그래야 `/api/users/google` 요청이 FastAPI에도 그대로 `/api/users/google`로 전달됩니다.

설정 확인 및 적용:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
```

접속 확인:

```bash
curl -I http://eeum-study.kr
curl -I http://eeum-study.kr/docs
curl http://eeum-study.kr/openapi.json
```

## Backend 환경변수

`backend/.env` 예시입니다. 실제 값은 서버에서만 관리하고 GitHub에 올리지 않습니다.

```env
DATABASE_URL=

JWT_SECRET_KEY=
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

프로젝트에서 필요한 추가 API 키나 설정이 있다면 같은 `.env`에 추가하되, 실제 값은 문서에 적지 않습니다.

## Frontend 환경변수

프론트엔드 `frontend/.env.local` 예시입니다.

권장 설정:

```env
NEXT_PUBLIC_USE_BACKEND_API=true
NEXT_PUBLIC_API_BASE_URL=http://eeum-study.kr/api
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

이 설정에서는 브라우저가 `http://eeum-study.kr/api`로 직접 요청하고, Nginx가 FastAPI 내부 포트 `8000`으로 전달합니다.

로컬 개발처럼 Next.js rewrite를 사용하고 싶다면 아래처럼 `NEXT_PUBLIC_API_BASE_URL`을 비워두거나 제거할 수 있습니다.

```env
NEXT_PUBLIC_USE_BACKEND_API=true
BACKEND_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=
```

주의: 위 rewrite 방식은 로컬 개발에 적합합니다. 현재 Nginx 설정은 `/api`를 FastAPI로 보내므로, 배포 환경에서 `NEXT_PUBLIC_API_BASE_URL`을 비워두면 프론트 기본값 `/api/backend` 요청이 FastAPI로 직접 전달되어 경로가 맞지 않을 수 있습니다. 배포 환경에서는 `NEXT_PUBLIC_API_BASE_URL=http://eeum-study.kr/api`를 명시하는 것을 권장합니다.

`NEXT_PUBLIC_GOOGLE_CLIENT_ID`는 공개 가능한 OAuth client id입니다. Google Client Secret은 프론트 `.env.local`에 넣지 않습니다.

## Backend 실행

EC2에서 백엔드 실행 예시:

```bash
cd /home/ec2-user/2026-capstone-52/backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Swagger 확인:

```text
http://34.206.229.66:8000/docs
http://eeum-study.kr/docs
```

## Frontend 실행

테스트용 실행:

```bash
cd /home/ec2-user/2026-capstone-52/frontend
npm install
npm run dev -- -H 0.0.0.0
```

배포용 실행:

```bash
cd /home/ec2-user/2026-capstone-52/frontend
npm install
npm run build
npm start -- -H 0.0.0.0
```

## systemd Backend Service

`/etc/systemd/system/eeum-backend.service`:

```ini
[Unit]
Description=EEUM FastAPI Backend
After=network.target

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/home/ec2-user/2026-capstone-52/backend
EnvironmentFile=/home/ec2-user/2026-capstone-52/backend/.env
ExecStart=/home/ec2-user/2026-capstone-52/backend/venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## systemd Frontend Service

`/etc/systemd/system/eeum-frontend.service`:

```ini
[Unit]
Description=EEUM Next.js Frontend
After=network.target

[Service]
User=ec2-user
Group=ec2-user
WorkingDirectory=/home/ec2-user/2026-capstone-52/frontend
EnvironmentFile=/home/ec2-user/2026-capstone-52/frontend/.env.local
ExecStart=/usr/bin/npm start -- -H 127.0.0.1 -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

서비스 적용:

```bash
sudo systemctl daemon-reload
sudo systemctl enable eeum-backend
sudo systemctl enable eeum-frontend
sudo systemctl start eeum-backend
sudo systemctl start eeum-frontend
sudo systemctl status eeum-backend
sudo systemctl status eeum-frontend
```

로그 확인:

```bash
sudo journalctl -u eeum-backend -f
sudo journalctl -u eeum-frontend -f
```

서비스 재시작:

```bash
sudo systemctl restart eeum-backend
sudo systemctl restart eeum-frontend
sudo systemctl reload nginx
```

## EC2 보안그룹

외부 공개가 필요한 포트:

```text
22  SSH   관리자 접속용
80  HTTP  Nginx 웹 접속용
```

Nginx 적용 후에는 `3000`, `8000`을 외부에 공개하지 않는 것을 권장합니다. Next.js와 FastAPI는 EC2 내부에서만 `127.0.0.1:3000`, `127.0.0.1:8000`으로 실행하고, 외부 요청은 Nginx가 80번 포트에서 받아서 내부 포트로 프록시합니다.

임시 테스트가 필요할 때만 보안그룹에서 `3000`, `8000`을 열고, 테스트 후 닫습니다.

## Google Cloud Console OAuth 설정

Google Cloud Console의 OAuth Client 설정에 아래 값을 등록합니다.

Authorized JavaScript origins:

```text
http://eeum-study.kr
http://www.eeum-study.kr
```

Authorized redirect URIs:

```text
http://eeum-study.kr/login
http://www.eeum-study.kr/login
```

Google OAuth 설정에서 JavaScript origin에는 path를 넣지 않습니다. redirect URI에는 실제 로그인 콜백으로 사용하는 경로를 넣습니다.

운영 배포에서는 HTTPS 적용 후 아래 주소로 교체하는 것을 권장합니다.

```text
https://eeum-study.kr
https://www.eeum-study.kr
https://eeum-study.kr/login
https://www.eeum-study.kr/login
```

## 배포 체크리스트

```text
[ ] DNS A 레코드가 EC2 Elastic IP를 바라본다.
[ ] EC2 보안그룹에서 80번 포트가 열려 있다.
[ ] 3000, 8000 포트는 Nginx 적용 후 외부 공개하지 않는다.
[ ] 백엔드 .env에 실제 JWT_SECRET_KEY가 서버에만 저장되어 있다.
[ ] 프론트 .env.local에 NEXT_PUBLIC_GOOGLE_CLIENT_ID가 설정되어 있다.
[ ] npm run build가 성공한다.
[ ] eeum-backend.service가 실행 중이다.
[ ] eeum-frontend.service가 실행 중이다.
[ ] sudo nginx -t가 성공한다.
[ ] http://eeum-study.kr 접속이 된다.
[ ] http://eeum-study.kr/docs 접속이 된다.
[ ] Google OAuth Authorized JavaScript origins가 도메인과 일치한다.
```
