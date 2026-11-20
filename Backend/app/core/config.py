from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_database: str = "dut_documents"
    mysql_username: str = "root"
    mysql_password: str = ""
    database_url: str | None = None
    jwt_secret: str = ""
    jwt_access_expiration: int = 900
    jwt_refresh_expiration: int = 604800
    jwt_algorithm: str = "HS256"
    frontend_url: str = "http://localhost:4200"
    storage_location: str = "./storage"
    max_file_size: int = 52428800
    cookie_secure: bool = False
    bootstrap_admin_student_id: str | None = None
    bootstrap_admin_password: str | None = None

    @property
    def sqlalchemy_database_uri(self) -> str:
        if self.database_url:
            return self.database_url
        return URL.create(
            "mysql+pymysql", username=self.mysql_username, password=self.mysql_password,
            host=self.mysql_host, port=self.mysql_port, database=self.mysql_database,
            query={"charset": "utf8mb4"},
        ).render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
