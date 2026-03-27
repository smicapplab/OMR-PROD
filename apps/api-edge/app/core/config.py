from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "OMR Edge API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    # SQLite Configuration
    DATABASE_URL: str = "sqlite:///./omr_edge.db"

    # Security (Placeholder for SQLCipher or encryption logic)
    DATABASE_KEY: Optional[str] = None

    CLOUD_API_URL: str = "http://localhost:4000"
    MACHINE_ID: str = "MACHINE-00001"
    MACHINE_SECRET: Optional[str] = None
    SECRET_KEY: str = "GENERATE_SECURE_SECRET_AT_RUNTIME"
    DEFAULT_SCHOOL_ID: str = "305312"

    # Scan directories — relative to project root (2 levels above apps/api-edge)
    RAW_SCANS_DIR: str = "../../raw_scans"
    UPLOADS_DIR: str = "../../uploads"
    SUCCESS_DIR: str = "../../success"
    ERROR_DIR: str = "../../error"

    # CORS: comma-separated list of allowed origins
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    # Set to True in production when served over HTTPS
    SECURE_COOKIES: bool = False

    @property
    def allowed_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
