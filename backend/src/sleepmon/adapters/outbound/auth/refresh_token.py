from __future__ import annotations

import hashlib
import secrets

from sleepmon.domain.ports import RefreshTokenCodec


class SecretsRefreshTokenCodec(RefreshTokenCodec):
    def generate(self) -> tuple[str, str]:
        clear = secrets.token_urlsafe(32)
        return clear, self.hash(clear)

    def hash(self, clear: str) -> str:
        return hashlib.sha256(clear.encode("utf-8")).hexdigest()
