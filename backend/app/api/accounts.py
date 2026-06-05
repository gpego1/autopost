import logging
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user_id, get_db
from app.core.security import decrypt_token, encrypt_token
from app.models.social_account import SocialAccount
from app.schemas.account import OAuthCallbackRequest, SocialAccountResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/accounts", tags=["accounts"])

META_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token"
META_ME_URL = "https://graph.facebook.com/v19.0/me"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
LINKEDIN_ME_URL = "https://api.linkedin.com/v2/userinfo"


def _validate_redirect_uri(redirect_uri: str) -> None:
    """Reject any redirect_uri whose origin is not in the allowlist."""
    parsed = urlparse(redirect_uri)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    allowed = {
        settings.frontend_url.rstrip("/"),
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    }
    if origin not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri not allowed",
        )


@router.get("", response_model=list[SocialAccountResponse])
async def list_accounts(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[SocialAccount]:
    """List all connected social accounts for the authenticated user."""
    result = await db.execute(
        select(SocialAccount)
        .where(SocialAccount.user_id == user_id)
        .order_by(SocialAccount.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/oauth/meta")
async def get_meta_oauth_url(
    redirect_uri: str,
    _user_id: UUID = Depends(get_current_user_id),
) -> dict:
    """Return the Meta OAuth authorization URL."""
    _validate_redirect_uri(redirect_uri)
    scope = "pages_manage_posts,pages_read_engagement,pages_show_list"
    url = (
        f"https://www.facebook.com/v19.0/dialog/oauth"
        f"?client_id={settings.meta_app_id}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
        f"&scope={scope}"
        f"&response_type=code"
    )
    return {"authorization_url": url}


@router.get("/oauth/linkedin")
async def get_linkedin_oauth_url(
    redirect_uri: str,
    _user_id: UUID = Depends(get_current_user_id),
) -> dict:
    """Return the LinkedIn OAuth authorization URL."""
    _validate_redirect_uri(redirect_uri)
    scope = "openid+profile+email+w_member_social"
    url = (
        f"https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={settings.linkedin_client_id}"
        f"&redirect_uri={quote(redirect_uri, safe='')}"
        f"&scope={scope}"
    )
    return {"authorization_url": url}


META_ACCOUNTS_URL = "https://graph.facebook.com/v19.0/me/accounts"


@router.post(
    "/connect/meta/callback",
    response_model=list[SocialAccountResponse],
    status_code=status.HTTP_201_CREATED,
)
async def meta_oauth_callback(
    payload: OAuthCallbackRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[SocialAccount]:
    """Handle Meta OAuth callback: exchange code for token, fetch managed Pages
    and save each Page as a separate SocialAccount with its own Page access token.
    """
    _validate_redirect_uri(payload.redirect_uri)

    async with httpx.AsyncClient(timeout=30) as client:
        token_resp = await client.get(
            META_TOKEN_URL,
            params={
                "client_id": settings.meta_app_id,
                "client_secret": settings.meta_app_secret,
                "redirect_uri": payload.redirect_uri,
                "code": payload.code,
            },
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange Meta code: {token_resp.text}",
            )
        token_data = token_resp.json()
        user_access_token = token_data.get("access_token")

        pages_resp = await client.get(
            META_ACCOUNTS_URL,
            params={"access_token": user_access_token, "fields": "id,name,access_token"},
        )
        if pages_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch Facebook Pages: {pages_resp.text}",
            )
        pages_data = pages_resp.json().get("data", [])

    if not pages_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma Página do Facebook encontrada. Certifique-se de ter pelo menos uma Página e ser administrador dela.",
        )

    saved_accounts: list[SocialAccount] = []
    for page in pages_data:
        page_id = page["id"]
        page_name = page.get("name", "Facebook Page")
        page_token = page.get("access_token", user_access_token)

        existing = await db.execute(
            select(SocialAccount).where(
                SocialAccount.user_id == user_id,
                SocialAccount.platform == "facebook",
                SocialAccount.platform_user_id == page_id,
            )
        )
        account = existing.scalar_one_or_none()

        if account is None:
            account = SocialAccount(
                user_id=user_id,
                platform="facebook",
                account_name=page_name,
                platform_user_id=page_id,
            )
            db.add(account)

        account.access_token = encrypt_token(page_token)
        account.token_expires_at = None  # Page tokens are long-lived
        account.is_active = True
        saved_accounts.append(account)

    await db.flush()
    for account in saved_accounts:
        await db.refresh(account)

    logger.info("Connected %d Facebook Page(s) for user %s", len(saved_accounts), user_id)
    return saved_accounts


@router.post(
    "/connect/linkedin/callback",
    response_model=SocialAccountResponse,
    status_code=status.HTTP_201_CREATED,
)
async def linkedin_oauth_callback(
    payload: OAuthCallbackRequest,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> SocialAccount:
    """Handle LinkedIn OAuth callback: exchange code for token and save account."""
    _validate_redirect_uri(payload.redirect_uri)

    async with httpx.AsyncClient(timeout=30) as client:
        token_resp = await client.post(
            LINKEDIN_TOKEN_URL,
            data={
                "grant_type": "authorization_code",
                "code": payload.code,
                "redirect_uri": payload.redirect_uri,
                "client_id": settings.linkedin_client_id,
                "client_secret": settings.linkedin_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if token_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange LinkedIn code: {token_resp.text}",
            )
        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")

        me_resp = await client.get(
            LINKEDIN_ME_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if me_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch LinkedIn user info",
            )
        me_data = me_resp.json()

    token_expires_at: Optional[datetime] = None
    if expires_in:
        token_expires_at = datetime.fromtimestamp(
            datetime.now(tz=timezone.utc).timestamp() + int(expires_in),
            tz=timezone.utc,
        )

    platform_user_id = me_data.get("sub", me_data.get("id", "unknown"))
    account_name = me_data.get("name", me_data.get("localizedFirstName", "Unknown"))

    existing = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == "linkedin",
            SocialAccount.platform_user_id == platform_user_id,
        )
    )
    account = existing.scalar_one_or_none()

    if account is None:
        account = SocialAccount(
            user_id=user_id,
            platform="linkedin",
            account_name=account_name,
            platform_user_id=platform_user_id,
        )
        db.add(account)

    account.access_token = encrypt_token(access_token)
    if refresh_token:
        account.refresh_token = encrypt_token(refresh_token)
    account.token_expires_at = token_expires_at
    account.is_active = True

    await db.flush()
    await db.refresh(account)
    logger.info("Connected LinkedIn account %s for user %s", platform_user_id, user_id)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Disconnect (delete) a social account."""
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Social account not found",
        )
    await db.delete(account)
    logger.info("Disconnected account %s for user %s", account_id, user_id)
