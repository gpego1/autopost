import logging

logger = logging.getLogger(__name__)


class SeleniumService:
    """
    Fallback service for Instagram publishing via browser automation.

    IMPORTANT: This is a stub implementation for the MVP scaffold.
    The actual Selenium/undetected-chromedriver logic is intentionally
    not implemented here because:

    1. It requires a display server (Xvfb) in production
    2. It violates Instagram's Terms of Service
    3. It is fragile and breaks on Instagram UI changes
    4. The Graph API (InstagramService) is the preferred method

    This class exists as a documented fallback path in case the Graph API
    is not available for an account (e.g., personal accounts that cannot
    be converted to Professional accounts).

    To implement: install undetected-chromedriver and instagrapi:
        pip install undetected-chromedriver instagrapi
    """

    async def publish_instagram(
        self,
        username: str,
        password: str,
        content: str,
        media_path: str,
    ) -> bool:
        """
        Publish a post to Instagram via browser automation (STUB).

        Args:
            username: Instagram account username
            password: Instagram account password
            content: Caption text for the post
            media_path: Local filesystem path to the media file

        Returns:
            True if published successfully, False otherwise.
        """
        logger.warning(
            "SeleniumService.publish_instagram called — this is a STUB. "
            "The Graph API (InstagramService) should be used instead. "
            "Account: %s, media: %s",
            username,
            media_path,
        )
        logger.warning(
            "To enable actual Selenium publishing:\n"
            "  1. Install: pip install undetected-chromedriver instagrapi\n"
            "  2. Ensure Chrome/Chromium is available in PATH\n"
            "  3. Implement the login + upload flow using instagrapi client\n"
            "  4. Handle 2FA, rate limits, and checkpoint challenges"
        )
        # In a real implementation, this would:
        # from instagrapi import Client
        # cl = Client()
        # cl.login(username, password)
        # cl.photo_upload(media_path, content)
        # return True
        raise NotImplementedError(
            "Selenium/browser-based Instagram publishing is not implemented in this MVP. "
            "Please connect an Instagram Professional account and use the Graph API."
        )

    async def check_chrome_available(self) -> bool:
        """Check if Chrome is available for browser automation."""
        import shutil
        chrome_path = shutil.which("google-chrome") or shutil.which("chromium-browser")
        available = chrome_path is not None
        if not available:
            logger.warning("Chrome/Chromium not found in PATH — Selenium unavailable")
        return available
