"""The Turnstile adapter: what it sends to siteverify and how it reads the answer."""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.parse
from typing import Any

import pytest

from sleepmon.adapters.outbound.turnstile import verifier as module
from sleepmon.adapters.outbound.turnstile.verifier import TurnstileVerifier
from sleepmon.domain.errors import HumanVerifierUnavailableError


class _Response(io.BytesIO):
    def __enter__(self) -> _Response:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


def _answer(monkeypatch: pytest.MonkeyPatch, body: bytes, seen: list[Any]) -> None:
    def fake_urlopen(request: Any, timeout: float) -> _Response:
        seen.append((request, timeout))
        return _Response(body)

    monkeypatch.setattr(module.urllib.request, "urlopen", fake_urlopen)


def test_sends_secret_and_token_and_reads_success(monkeypatch: pytest.MonkeyPatch) -> None:
    seen: list[Any] = []
    _answer(monkeypatch, json.dumps({"success": True}).encode(), seen)

    assert TurnstileVerifier("s3cret").verify("tok") is True

    request, timeout = seen[0]
    assert request.full_url == TurnstileVerifier.SITEVERIFY
    assert urllib.parse.parse_qs(request.data.decode()) == {
        "secret": ["s3cret"],
        "response": ["tok"],
    }
    assert timeout == 5.0


def test_a_rejected_token_is_false(monkeypatch: pytest.MonkeyPatch) -> None:
    rejected = {"success": False, "error-codes": ["invalid-input-response"]}
    _answer(monkeypatch, json.dumps(rejected).encode(), [])
    assert TurnstileVerifier("s").verify("bad") is False


def test_garbage_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    _answer(monkeypatch, b"<html>oops</html>", [])
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")


def test_network_failure_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_: Any, **__: Any) -> None:
        raise urllib.error.URLError("timed out")

    monkeypatch.setattr(module.urllib.request, "urlopen", boom)
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")


def test_a_non_object_answer_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    _answer(monkeypatch, b"[]", [])
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")


def test_a_timeout_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_: Any, **__: Any) -> None:
        raise TimeoutError("timed out")

    monkeypatch.setattr(module.urllib.request, "urlopen", boom)
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")


def test_a_connection_reset_while_reading_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class Broken(_Response):
        def read(self, *_: Any) -> bytes:
            raise ConnectionResetError("reset")

    monkeypatch.setattr(module.urllib.request, "urlopen", lambda *_, **__: Broken())
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")


def test_a_truncated_http_response_is_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    import http.client

    def boom(*_: Any, **__: Any) -> None:
        raise http.client.IncompleteRead(b"")

    monkeypatch.setattr(module.urllib.request, "urlopen", boom)
    with pytest.raises(HumanVerifierUnavailableError):
        TurnstileVerifier("s").verify("tok")
