from datetime import datetime, timedelta, timezone
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
        
    import urllib.parse
    state = redirect_to if redirect_to else req.headers.get("referer", "/")

    url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&"
        f"client_id={service.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={service.GOOGLE_REDIRECT_URI}&"
        f"scope=openid%20email%20profile&"
        f"access_type=offline&"
        f"prompt=consent&"
        f"state={urllib.parse.quote(state)}"
    )
    return RedirectResponse(url)

@router.get("/google/callback")
async def auth_google_callback(
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    state: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """Handles Google OAuth callback, creates user, issues tokens."""
    if error or not code:
        import urllib.parse
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
    
    # 5. Generate Refresh Token and store its hash
    raw_refresh_token = service.generate_refresh_token(str(user.id), user.email, user.role)
    token_hash = service.hash_token(raw_refresh_token)
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + service.REFRESH_TOKEN_EXPIRE
    
    await crud.create_refresh_token(db, user.id, token_hash, expires_at)
    
    import urllib.parse
    
    redirect_target = "/"
    if state and state.startswith("http"):
        redirect_target = state
        
    response = RedirectResponse(url=redirect_target)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()),
        samesite="lax",
        secure=False, # Set to True in production HTTPS environment
    )
    
    # Expose non-sensitive user info to frontend JS via cookies
    safe_name = urllib.parse.quote(user.name or user.email.split('@')[0])
    response.set_cookie(key="user_name", value=safe_name, httponly=False, max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()))
    if user.avatar_url:
        response.set_cookie(key="user_avatar", value=urllib.parse.quote(user.avatar_url), httponly=False, max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()))

    # Expose refresh token to frontend JS so it can silently renew expired access tokens.
    # The refresh token is a signed JWT — exposure to JS has similar risk to localStorage.
    response.set_cookie(
        key="refresh_token",
        value=raw_refresh_token,
        httponly=False,
        max_age=int(service.REFRESH_TOKEN_EXPIRE.total_seconds()),
        samesite="lax",
        secure=False,  # Set to True in production HTTPS environment
    )

    return response

@router.post("/refresh", response_model=schemas.TokenResponse)
async def refresh_access_token(req: schemas.RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Swaps a valid refresh token for a new access token."""
    # Verify the JWT signature and basic expiry first
    service.verify_refresh_token(req.refresh_token)
    
    token_hash = service.hash_token(req.refresh_token)
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
        refresh_token=req.refresh_token, # keep the same refresh token
        expires_in=int(service.ACCESS_TOKEN_EXPIRE.total_seconds())
    ).model_dump()
    
    response = JSONResponse(content=content)
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=int(service.ACCESS_TOKEN_EXPIRE.total_seconds()),
        samesite="lax",
        secure=False,
    )
    return response

@router.post("/logout")
async def logout(request: Request, body: schemas.RefreshRequest | None = None, db: AsyncSession = Depends(get_db)):
    """Revokes the refresh token."""
    token = body.refresh_token if body and body.refresh_token else request.cookies.get("refresh_token")
    
    if token:
        token_hash = service.hash_token(token)
        await crud.revoke_refresh_token(db, token_hash)
    
    response = JSONResponse(content={"message": "Successfully logged out"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("user_name")
    response.delete_cookie("user_avatar")
    return response
