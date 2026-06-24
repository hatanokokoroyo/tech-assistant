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
    deepseek_flash_model: str = "deepseek-v4-flash"
    deepseek_pro_model: str = "deepseek-v4-pro"

    # DeepSeek 模型上下文长度
    deepseek_flash_context_length: int = 1_000_000
    deepseek_pro_context_length: int = 1_000_000

    # DeepSeek 模型单价（元/1K tokens，基于官方 USD 价格折算）
    # deepseek-v4-flash: $0.14/1M input, $0.0028/1M cached input, $0.28/1M output
    deepseek_flash_input_price: float = 0.00014
    deepseek_flash_output_price: float = 0.00028
    deepseek_flash_cached_input_price: float = 0.0000028
    # deepseek-v4-pro: $0.435/1M input, $0.003625/1M cached input, $0.87/1M output
    deepseek_pro_input_price: float = 0.000435
    deepseek_pro_cached_input_price: float = 0.000003625
    deepseek_pro_output_price: float = 0.00087

    # JWT
    jwt_secret_key: str = "change_this_secret_key"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24

    # 沙箱
    sandbox_root: str = "/data/tech-assistant"

    # 数据源加密密钥（32字节，Base64编码）
    datasource_encryption_key: str = ""

    # MCP Server 地址（Backend 连接用）
    db_query_mcp_url: str = "http://127.0.0.1:9100"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
