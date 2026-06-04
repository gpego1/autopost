import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class FacebookService:
    """Service for publishing posts to Facebook Pages via the Graph API."""

    async def publish_post(
        self,
        access_token: str,
        page_id: str,
        content: str,
        media_urls: list[str],
    ) -> dict:
        """
        Publish a post to a Facebook Page.

        For posts with media, first uploads the photo/video, then creates
        a post linking to it. For text-only posts, creates a feed post directly.

        Returns the Graph API response dict containing the post ID.
        """
        async with httpx.AsyncClient(timeout=60) as client:
            if media_urls:
                # Upload all photos first and collect IDs
                media_ids = []
                for url in media_urls:
                    photo_resp = await self._upload_photo(
                        client, access_token, page_id, url
                    )
                    media_ids.append({"media_fbid": photo_resp["id"]})

                if len(media_ids) == 1:
                    # Single photo post
                    data = {
                        "message": content,
                        "access_token": access_token,
                        "attached_media": str(media_ids),
                    }
                else:
                    # Multi-photo post
                    data = {
                        "message": content,
                        "access_token": access_token,
                        "attached_media": str(media_ids),
                    }

                resp = await self._post_with_retry(
                    client,
                    f"{GRAPH_API_BASE}/{page_id}/feed",
                    data={"message": content, "access_token": access_token,
                          "attached_media": str(media_ids)},
                )
            else:
                # Text-only post
                resp = await self._post_with_retry(
                    client,
                    f"{GRAPH_API_BASE}/{page_id}/feed",
                    data={"message": content, "access_token": access_token},
                )

        logger.info("Facebook post published: %s", resp)
        return resp

    async def _upload_photo(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        page_id: str,
        photo_url: str,
    ) -> dict:
        """Upload a photo to the page's photo library (unpublished)."""
        resp = await self._post_with_retry(
            client,
            f"{GRAPH_API_BASE}/{page_id}/photos",
            data={
                "url": photo_url,
                "published": "false",
                "access_token": access_token,
            },
        )
        return resp

    async def _post_with_retry(
        self,
        client: httpx.AsyncClient,
        url: str,
        data: dict,
        max_retries: int = 3,
    ) -> dict:
        """POST with exponential backoff retry for rate limits (code 17/32)."""
        for attempt in range(max_retries):
            response = await client.post(url, data=data)

            if response.status_code == 200:
                return response.json()

            body = response.json()
            error = body.get("error", {})
            error_code = error.get("code", 0)

            # Facebook rate limit error codes
            if error_code in (17, 32, 613) and attempt < max_retries - 1:
                wait_time = 2 ** attempt * 5  # 5, 10, 20 seconds
                logger.warning(
                    "Facebook rate limit hit (code %s), retrying in %ss",
                    error_code,
                    wait_time,
                )
                await asyncio.sleep(wait_time)
                continue

            raise ValueError(
                f"Facebook API error [{error_code}]: {error.get('message', response.text)}"
            )

        raise ValueError("Max retries exceeded for Facebook API call")

    async def refresh_token(
        self,
        access_token: str,
        app_id: str,
        app_secret: str,
    ) -> str:
        """
        Exchange a short-lived user token for a long-lived token.
        Returns the new access token string.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                f"{GRAPH_API_BASE}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": access_token,
                },
            )
            data = resp.json()
            if "access_token" not in data:
                raise ValueError(f"Failed to refresh Facebook token: {data}")
            return data["access_token"]
