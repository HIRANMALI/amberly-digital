from datetime import datetime, timezone
import urllib.parse
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from modules.users.crud import upsert_user
from . import schemas, crud, service

router = APIRouter()

@router.get("/google")
async def login_google(req: Request, redirect_to: str | None = None):
    """Redirects user to Google OAuth consent screen."""
    if not service.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google OAuth not configured")
        
    state = redirect_to if redirect_to else req.headers.get("referer", "/")

    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&"
        f"client_id={service.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={service.GOOGLE_REDIRECT_URI}&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline&"
        f"prompt=select_account&"
        f"state={urllib.parse.quote(state)}"
    )
    return RedirectResponse(url)

@router.get("/google/callback")
async def auth_google_callback(
    request: Request,
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """Handles Google OAuth callback, creates user, issues tokens."""
    if error or not code:
        error_msg = error_description or error or "Authentication cancelled"
        if "access_denied" in error_msg.lower():
            error_msg = "Google login cancelled or access denied"
        return RedirectResponse(url=f"/?auth_error={urllib.parse.quote(error_msg)}")

    # 1. Exchange code for Google tokens
    google_tokens = await service.exchange_google_code(code)
    
    # 2. Get user info from Google
    userinfo = await service.get_google_userinfo(google_tokens["access_token"])
    
    # 3. Upsert user in our database
    user = await upsert_user(
        db,
        google_id=userinfo["id"],
        email=userinfo["email"],
        name=userinfo.get("name"),
        avatar_url=userinfo.get("picture")
    )
    
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is deactivated")
        
    # 4. Generate JWT Access Token
    access_token = service.create_access_token(str(user.id), user.email, user.role)
    
    # 5. Reuse existing valid refresh token or generate a new one
    raw_refresh_token = await crud.get_or_create_refresh_token(db, user.id, user.email, user.role)
    
    redirect_target = "/"
    if state and state.startswith("http"):
        redirect_target = state
        
    response = RedirectResponse(url=redirect_target)
    
    # Check if backend host is not running on localhost/127.0.0.1
    host = request.url.hostname or ""
    is_prod = not (host == "localhost" or host == "127.0.0.1")
    samesite_val = "none" if is_prod else "lax"
    secure_val = True if is_prod else False

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()),
        samesite=samesite_val,
        secure=secure_val,
    )
    
    # Expose non-sensitive user info to frontend JS via cookies (extend to refresh token life so state persists)
    safe_name = urllib.parse.quote(user.name or user.email.split('@')[0])
    response.set_cookie(
        key="user_name", 
        value=safe_name, 
        httponly=False, 
        max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
        samesite=samesite_val,
        secure=secure_val,
    )
    if user.avatar_url:
        response.set_cookie(
            key="user_avatar", 
            value=urllib.parse.quote(user.avatar_url), 
            httponly=False, 
            max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
            samesite=samesite_val,
            secure=secure_val,
        )

    # Expose refresh token to frontend via a secure HttpOnly cookie.
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=True,
        max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
        samesite=samesite_val,
        secure=secure_val,
    )

    return response

@router.post("/refresh", response_model=schemas.TokenResponse)
async def refresh_access_token(request: Request, body: schemas.RefreshRequest | None = None, db: AsyncSession = Depends(get_db)):
    """Swaps a valid refresh token for a new access token."""
    # 1. Try body first, then fallback to HttpOnly cookie
    token = body.refresh_token if body and body.refresh_token else request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Verify the JWT signature and basic expiry first
    service.verify_refresh_token(token)
    
    token_hash = service.hash_token(token)
    token_entry = await crud.get_refresh_token(db, token_hash)
    
    if not token_entry or token_entry.revoked or token_entry.expires_at < datetime.now(timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
        
    # Generate new access token
    access_token = service.create_access_token(
        str(token_entry.user.id), 
        token_entry.user.email, 
        token_entry.user.role
    )
    
    content = schemas.TokenResponse(
        access_token=access_token,
        refresh_token=token, # keep the same refresh token
        expires_in=int(service.ACCESS_TOKEN_EXPIRE.total_seconds())
    ).model_dump()
    
    # Determine secure / samesite dynamically based on request origin
    origin = request.headers.get("origin") or ""
    is_prod = not ("localhost" in origin or "127.0.0.1" in origin or not origin)
    samesite_val = "none" if is_prod else "lax"
    secure_val = True if is_prod else False

    response = JSONResponse(content=content)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()),
        samesite=samesite_val,
        secure=secure_val,
    )
    
    # Re-issue non-sensitive user info cookies to extend their life
    safe_name = urllib.parse.quote(token_entry.user.name or token_entry.user.email.split('@')[0])
    response.set_cookie(
        key="user_name",
        value=safe_name,
        httponly=False,
        max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
        samesite=samesite_val,
        secure=secure_val,
    )
    if token_entry.user.avatar_url:
        response.set_cookie(
            key="user_avatar",
            value=urllib.parse.quote(token_entry.user.avatar_url),
            httponly=False,
            max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
            samesite=samesite_val,
            secure=secure_val,
        )
    return response

@router.post("/logout")
async def logout(request: Request, body: schemas.RefreshRequest | None = None, db: AsyncSession = Depends(get_db)):
    """Revokes the refresh token."""
    token = body.refresh_token if body and body.refresh_token else request.cookies.get("refresh_token")
    
    if token:
        token_hash = service.hash_token(token)
        await crud.revoke_refresh_token(db, token_hash)
    
    # Determine secure / samesite dynamically based on request origin
    origin = request.headers.get("origin") or ""
    is_prod = not ("localhost" in origin or "127.0.0.1" in origin or not origin)
    samesite_val = "none" if is_prod else "lax"
    secure_val = True if is_prod else False

    response = JSONResponse(content={"message": "Successfully logged out"})
    
    # Explicitly clear cookies with matching attributes
    response.delete_cookie("access_token", samesite=samesite_val, secure=secure_val)
    response.delete_cookie("refresh_token", samesite=samesite_val, secure=secure_val)
    response.delete_cookie("user_name", samesite=samesite_val, secure=secure_val)
    response.delete_cookie("user_avatar", samesite=samesite_val, secure=secure_val)
    return response
