import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from .models import RefreshToken

async def create_refresh_token(db: AsyncSession, user_id: uuid.UUID, token_hash: str, expires_at: datetime) -> RefreshToken:
    token_entry = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(token_entry)
    await db.commit()
    await db.refresh(token_entry)
    return token_entry

async def get_refresh_token(db: AsyncSession, token_hash: str) -> RefreshToken | None:
    result = await db.execute(
        select(RefreshToken)
        .options(selectinload(RefreshToken.user))
        .where(RefreshToken.token_hash == token_hash)
    )
    return result.scalars().first()

async def revoke_refresh_token(db: AsyncSession, token_hash: str) -> None:
    token_entry = await get_refresh_token(db, token_hash)
    if token_entry:
        token_entry.revoked = True
        await db.commit()
