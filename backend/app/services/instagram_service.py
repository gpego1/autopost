import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

GRAPH_API_BASE = "https://graph.facebook.com/v19.0"


class InstagramService:
    """
    Service for publishing posts to Instagram via the Instagram Graph API.
    Requires a connected Facebook Page with an Instagram Professional Account.
    """

    async def publish_post(
        self,
        access_token: str,
        ig_user_id: str,
        content: str,
        media_urls: list[str],
    ) -> dict:
        """
        Publish a post to Instagram.

        Handles three cases:
        - Single image post (one media_url)
        - Carousel post (multiple media_urls)
        - Caption-only if no media (creates a text post via reels stub)

        Two-step process per IG Graph API:
        1. Create a media container
        2. Publish the container
        """
        async with httpx.AsyncClient(timeout=90) as client:
            if not media_urls:
                raise ValueError(
                    "Instagram requires at least one media URL to publish a post"
                )

            if len(media_urls) == 1:
                result = await self._publish_single_image(
                    client, access_token, ig_user_id, content, media_urls[0]
                )
            else:
                result = await self._publish_carousel(
                    client, access_token, ig_user_id, content, media_urls
                )

        logger.info("Instagram post published: %s", result)
        return result

    async def _publish_single_image(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        ig_user_id: str,
        caption: str,
        image_url: str,
    ) -> dict:
        """Create a single-image IG post."""
        # Step 1: Create media container
        container_resp = await client.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media",
            data={
                "image_url": image_url,
                "caption": caption,
                "access_token": access_token,
            },
        )
        container_data = self._check_response(container_resp, "create media container")
        container_id = container_data["id"]

        # Wait for container to be ready
        await self._wait_for_container(client, access_token, container_id)

        # Step 2: Publish container
        publish_resp = await client.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
            data={
                "creation_id": container_id,
                "access_token": access_token,
            },
        )
        return self._check_response(publish_resp, "publish media")

    async def _publish_carousel(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        ig_user_id: str,
        caption: str,
        image_urls: list[str],
    ) -> dict:
        """Create a carousel (multi-image) IG post."""
        # Step 1: Create individual item containers
        item_ids = []
        for url in image_urls:
            item_resp = await client.post(
                f"{GRAPH_API_BASE}/{ig_user_id}/media",
                data={
                    "image_url": url,
                    "is_carousel_item": "true",
                    "access_token": access_token,
                },
            )
            item_data = self._check_response(item_resp, f"create carousel item {url}")
            item_ids.append(item_data["id"])

        # Step 2: Create carousel container
        carousel_resp = await client.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media",
            data={
                "media_type": "CAROUSEL",
                "children": ",".join(item_ids),
                "caption": caption,
                "access_token": access_token,
            },
        )
        carousel_data = self._check_response(carousel_resp, "create carousel container")
        carousel_id = carousel_data["id"]

        # Wait for carousel container to be ready
        await self._wait_for_container(client, access_token, carousel_id)

        # Step 3: Publish carousel
        publish_resp = await client.post(
            f"{GRAPH_API_BASE}/{ig_user_id}/media_publish",
            data={
                "creation_id": carousel_id,
                "access_token": access_token,
            },
        )
        return self._check_response(publish_resp, "publish carousel")

    async def _wait_for_container(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        container_id: str,
        max_polls: int = 10,
        poll_interval: int = 5,
    ) -> None:
        """Poll until the media container status is FINISHED."""
        for _ in range(max_polls):
            status_resp = await client.get(
                f"{GRAPH_API_BASE}/{container_id}",
                params={
                    "fields": "status_code,status",
                    "access_token": access_token,
                },
            )
            try:
                data = status_resp.json()
            except Exception:
                logger.warning("Container %s: non-JSON status response, retrying", container_id)
                await asyncio.sleep(poll_interval)
                continue
            status_code = data.get("status_code", "")

            if status_code == "FINISHED":
                return
            elif status_code == "ERROR":
                raise ValueError(f"Instagram media container failed: {data}")
            elif status_code == "EXPIRED":
                raise ValueError("Instagram media container expired")

            logger.debug("Container %s status: %s — waiting", container_id, status_code)
            await asyncio.sleep(poll_interval)

        raise ValueError(f"Container {container_id} did not become ready in time")

    def _check_response(self, response: httpx.Response, context: str) -> dict:
        """Raise ValueError if the Graph API returned an error."""
        try:
            data = response.json()
        except Exception:
            raise ValueError(
                f"Instagram API returned non-JSON response during '{context}' "
                f"[HTTP {response.status_code}]: {response.text[:200]}"
            )
        if "error" in data:
            err = data["error"]
            raise ValueError(
                f"Instagram API error during '{context}' "
                f"[{err.get('code')}]: {err.get('message', response.text)}"
            )
        return data
