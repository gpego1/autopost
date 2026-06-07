import logging

import httpx

logger = logging.getLogger(__name__)

LINKEDIN_API_BASE = "https://api.linkedin.com/v2"


class LinkedInService:
    """
    Service for publishing posts to LinkedIn via the UGC Posts API.
    Supports text posts and single-image posts.
    """

    async def publish_post(
        self,
        access_token: str,
        person_urn: str,
        content: str,
        media_urls: list[str],
    ) -> dict:
        """
        Publish a post to LinkedIn.

        Uses the UGC Posts API. If media_urls are provided, registers
        the image and attaches it to the post.

        person_urn format: "urn:li:person:{id}"
        """
        async with httpx.AsyncClient(timeout=60) as client:
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            }

            if media_urls:
                result = await self._publish_with_media(
                    client, headers, person_urn, content, media_urls[0]
                )
            else:
                result = await self._publish_text_post(
                    client, headers, person_urn, content
                )

        logger.info("LinkedIn post published: %s", result)
        return result

    async def _publish_text_post(
        self,
        client: httpx.AsyncClient,
        headers: dict,
        person_urn: str,
        content: str,
    ) -> dict:
        """Create a text-only UGC post."""
        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": content},
                    "shareMediaCategory": "NONE",
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        resp = await client.post(
            f"{LINKEDIN_API_BASE}/ugcPosts", json=payload, headers=headers
        )
        return self._check_response(resp, "create text post")

    async def _publish_with_media(
        self,
        client: httpx.AsyncClient,
        headers: dict,
        person_urn: str,
        content: str,
        image_url: str,
    ) -> dict:
        """
        Register an image asset and create an image post.
        LinkedIn requires registering the upload first, uploading the bytes,
        then creating the post referencing the asset.
        """
        # Step 1: Register image upload
        register_payload = {
            "registerUploadRequest": {
                "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
                "owner": person_urn,
                "serviceRelationships": [
                    {
                        "relationshipType": "OWNER",
                        "identifier": "urn:li:userGeneratedContent",
                    }
                ],
            }
        }
        register_resp = await client.post(
            f"{LINKEDIN_API_BASE}/assets?action=registerUpload",
            json=register_payload,
            headers=headers,
        )
        register_data = self._check_response(register_resp, "register upload")
        try:
            upload_url = register_data["value"]["uploadMechanism"][
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
            ]["uploadUrl"]
            asset_urn = register_data["value"]["asset"]
        except (KeyError, TypeError) as exc:
            raise ValueError(
                f"Unexpected LinkedIn upload registration response: {exc}: {register_data}"
            )

        # Step 2: Download the image from the URL and upload to LinkedIn
        image_resp = await client.get(image_url)
        if image_resp.status_code != 200:
            raise ValueError(f"Failed to download image from {image_url}")

        upload_resp = await client.put(
            upload_url,
            content=image_resp.content,
            headers={**headers, "Content-Type": "application/octet-stream"},
        )
        if upload_resp.status_code not in (200, 201):
            raise ValueError(f"Failed to upload image to LinkedIn: {upload_resp.text}")

        # Step 3: Create the post with the uploaded image
        payload = {
            "author": person_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": content},
                    "shareMediaCategory": "IMAGE",
                    "media": [
                        {
                            "status": "READY",
                            "description": {"text": ""},
                            "media": asset_urn,
                            "title": {"text": ""},
                        }
                    ],
                }
            },
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        post_resp = await client.post(
            f"{LINKEDIN_API_BASE}/ugcPosts", json=payload, headers=headers
        )
        return self._check_response(post_resp, "create image post")

    async def refresh_token(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
    ) -> dict:
        """
        Refresh a LinkedIn access token using the refresh token.
        Returns dict with access_token, expires_in, refresh_token.
        """
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            data = resp.json()
            if "access_token" not in data:
                raise ValueError(f"Failed to refresh LinkedIn token: {data}")
            return data

    def _check_response(self, response: httpx.Response, context: str) -> dict:
        """Raise ValueError if the LinkedIn API returned an error."""
        if response.status_code in (200, 201):
            try:
                return response.json()
            except Exception:
                return {"status": response.status_code}

        try:
            body = response.json()
        except Exception:
            body = {"message": response.text}

        raise ValueError(
            f"LinkedIn API error during '{context}' "
            f"[HTTP {response.status_code}]: {body.get('message', response.text)}"
        )
