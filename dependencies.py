from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from modules.auth.service import verify_access_token
from modules.users.crud import get_user_by_id
from modules.users.models import User, UserRole
import uuid

# We use OAuth2PasswordBearer just to extract the token from the "Authorization: Bearer <token>" header
# We set auto_error=False so we can fall back to checking the cookie if the header is missing
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to get the current authenticated user from the JWT access token."""
    access_token = token or request.cookies.get("access_token")
    
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        
    payload = verify_access_token(access_token)
    user_id_str = payload.get("user_id")
    
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        
    user = await get_user_by_id(db, uuid.UUID(user_id_str))
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists")
        
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user account")
        
    return user

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency that ensures the current user has the 'admin' role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
