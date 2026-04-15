from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://raksh:raksh123@localhost:5432/rakshaidb"
    jwt_secret: str = "devsecret"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    openweather_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
