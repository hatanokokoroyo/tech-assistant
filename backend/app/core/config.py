from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库
    postgres_db: str = "tech_assistant"
    postgres_user: str = "tech_user"
    postgres_password: str = "change_this_password"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # DeepSeek
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_flash_model: str = "deepseek-chat"
    deepseek_pro_model: str = "deepseek-reasoner"

    # JWT
    jwt_secret_key: str = "change_this_secret_key"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # 沙箱
    sandbox_root: str = "/data/tech-assistant"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
