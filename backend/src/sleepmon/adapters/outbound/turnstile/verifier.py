"""Cloudflare Turnstile as the human check (ADR 0012). Standard library only."""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Final

from sleepmon.domain.errors import HumanVerifierUnavailableError
from sleepmon.domain.ports import HumanVerifier


class TurnstileVerifier(HumanVerifier):
    SITEVERIFY: Final = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    def __init__(self, secret_key: str, timeout: float = 5.0) -> None:
        self._secret = secret_key
        self._timeout = timeout

    def verify(self, token: str) -> bool:
        body = urllib.parse.urlencode({"secret": self._secret, "response": token}).encode()
        request = urllib.request.Request(self.SITEVERIFY, data=body, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self._timeout) as response:
                answer = json.loads(response.read())
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            raise HumanVerifierUnavailableError() from exc
        if not isinstance(answer, dict):
            raise HumanVerifierUnavailableError()
        return answer.get("success") is True
