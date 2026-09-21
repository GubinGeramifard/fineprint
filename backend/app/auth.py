"""Authenticate requests using the Supabase access token."""
import httpx
from fastapi import Header, HTTPException

from app.config import settings


def get_current_user(authorization: str = Header(default="")) -> str:
    """Validate the bearer token with Supabase and return the user's id."""
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    token = authorization.split(" ", 1)[1]
    try:
        resp = httpx.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_anon_key},
            timeout=10,
        )
    except Exception:
        raise HTTPException(status_code=503, detail="Auth service unreachable.")
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Session expired. Sign in again.")
    return resp.json()["id"]
