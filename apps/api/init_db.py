import asyncio
import dotenv

dotenv.load_dotenv()

from db.database import engine, Base

# Import all models here so that they are registered with the Base metadata
from modules.users.models import User
from modules.auth.models import RefreshToken
from modules.tasks.models import Task

async def init_db():
    print("Initializing database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully!")

if __name__ == "__main__":
    asyncio.run(init_db())
