import os
import re
import hashlib
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException, status
import httpx
from modules.users.models import UserRole

def parse_duration(duration_str: str) -> timedelta:
    match = re.match(r"(\d+)([smhd])", duration_str.strip().lower())
    if not match:
        raise ValueError(f"Invalid duration format: {duration_str}")
    value, unit = int(match.group(1)), match.group(2)
    if unit == 's': return timedelta(seconds=value)
    if unit == 'm': return timedelta(minutes=value)
    if unit == 'h': return timedelta(hours=value)
    if unit == 'd': return timedelta(days=value)
    
    raise ValueError(f"Unsupported duration unit: {unit}")

SECRET_KEY = os.environ.get("JWT_SECRET", "super-secret-fallback-key")
REFRESH_SECRET_KEY = os.environ.get("JWT_REFRESH_SECRET", "super-secret-refresh-fallback-key")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE = parse_duration(os.environ.get("JWT_EXPIRY", "1h"))
REFRESH_TOKEN_EXPIRE = parse_duration(os.environ.get("JWT_REFRESH_EXPIRY", "7d"))

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI")

def create_access_token(user_id: str, email: str, role: UserRole) -> str:
    """Creates a short-lived JWT access token."""
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + ACCESS_TOKEN_EXPIRE
    to_encode = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expire,
        "type": "access"
    }
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_access_token(token: str) -> dict:
    """Decodes and verifies JWT. Raises HTTPException if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") and payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def generate_refresh_token(user_id: str, email: str, role: UserRole) -> str:
    """Generates a JWT refresh token."""
    expire = datetime.now(timezone.utc).replace(tzinfo=None) + REFRESH_TOKEN_EXPIRE
    to_encode = {
        "user_id": user_id,
        "email": email,
        "role": role,
        "exp": expire,
        "type": "refresh"
    }
    encoded_jwt = jwt.encode(to_encode, REFRESH_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_refresh_token(token: str) -> dict:
    """Decodes and verifies Refresh JWT. Raises HTTPException if invalid."""
    try:
        payload = jwt.decode(token, REFRESH_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def hash_token(token: str) -> str:
    """Hashes a token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

async def exchange_google_code(code: str) -> dict:
    """Exchanges an authorization code for Google tokens."""
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code"
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data=data)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange Google code")
        return response.json()

async def get_google_userinfo(access_token: str) -> dict:
    """Fetches user info from Google using the access token."""
    userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
    headers = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient() as client:
        response = await client.get(userinfo_url, headers=headers)
        if response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch Google user info")
        return response.json()
