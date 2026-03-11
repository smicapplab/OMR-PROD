from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "OMR Edge API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # SQLite Configuration
    DATABASE_URL: str = "sqlite:///./omr_edge.db"
    
    # Security (Placeholder for SQLCipher or encryption logic)
    DATABASE_KEY: Optional[str] = "dev-secret-key"
    
    CLOUD_API_URL: str = "http://localhost:4000"
    MACHINE_ID: str = "MACHINE-00001"
    MACHINE_SECRET: Optional[str] = None
    DEFAULT_SCHOOL_ID: str = "305312"

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"

settings = Settings()
