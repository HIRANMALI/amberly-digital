import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from .models import RefreshToken
from modules.users.models import UserRole


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


async def get_or_create_refresh_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    email: str,
    role: "UserRole",
) -> str:
    """Return the raw JWT of an existing valid refresh token for this user,
    or mint a brand-new one if no valid token exists."""
    from modules.auth import service  # local import to avoid circular dependency

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Look for an existing valid (not revoked, not expired) token for this user
    result = await db.execute(
        select(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked == False,  # noqa: E712
            RefreshToken.expires_at > now,
        )
        .order_by(RefreshToken.expires_at.desc())  # pick the one that expires last
        .limit(1)
    )
    existing = result.scalars().first()

    if existing:
        # We cannot recover the raw JWT from the stored hash, so we re-issue a
        # new signed token that is stored under the SAME hash row — impossible.
        # Instead we just return a freshly signed token and update the DB row
        # so the hash matches the new token.
        raw_token = service.generate_refresh_token(str(user_id), email, role)
        new_hash = service.hash_token(raw_token)
        new_expires = now + service.REFRESH_TOKEN_EXPIRE
        existing.token_hash = new_hash
        existing.expires_at = new_expires
        existing.revoked = False
        await db.commit()
        return raw_token

    # No valid token found — create a fresh one
    raw_token = service.generate_refresh_token(str(user_id), email, role)
    token_hash = service.hash_token(raw_token)
    expires_at = now + service.REFRESH_TOKEN_EXPIRE
    await create_refresh_token(db, user_id, token_hash, expires_at)
    return raw_token

