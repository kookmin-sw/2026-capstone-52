# 환경변수 설정 — .env 파일에서 값을 읽어옴

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # DB 연결 URL (로컬 개발: SQLite, 배포: RDS PostgreSQL)
    database_url: str = "sqlite:///./dev.db"

    # AWS 공통 설정
    aws_region: str = "us-east-1"

    # S3 버킷 — PDF 파일 원본 저장
    s3_bucket_name: str = "pj-kmucd1-02-s3-documents"

    # Amazon Bedrock — 맞춤 설명 생성에 사용할 Claude 모델
    bedrock_model_id: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"

    # 로컬 테스트용 — False면 S3 업로드 건너뜀
    use_s3: bool = True

    # JWT — Google 로그인 성공 후 프론트에 전달할 서비스 access token
    jwt_secret_key: str = "change-me-in-env"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7

    class Config:
        env_file = ".env"


settings = Settings()
