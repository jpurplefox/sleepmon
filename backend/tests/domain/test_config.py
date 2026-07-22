from datetime import timedelta

import pytest

from sleepmon.config import Settings


def test_from_env_reads_auth_settings(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid.apps.googleusercontent.com")
    monkeypatch.setenv("JWT_SECRET", "s3cret")
    monkeypatch.setenv("ACCESS_TTL_SECONDS", "600")
    monkeypatch.setenv("REFRESH_TTL_SECONDS", "1209600")
    monkeypatch.setenv("COOKIE_SECURE", "false")
    s = Settings.from_env()
    assert s.google_client_id == "cid.apps.googleusercontent.com"
    assert s.jwt_secret == "s3cret"
    assert s.access_ttl == timedelta(seconds=600)
    assert s.refresh_ttl == timedelta(seconds=1209600)
    assert s.cookie_secure is False


def test_ttls_have_defaults(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("JWT_SECRET", "x")
    monkeypatch.delenv("ACCESS_TTL_SECONDS", raising=False)
    monkeypatch.delenv("REFRESH_TTL_SECONDS", raising=False)
    s = Settings.from_env()
    assert s.access_ttl == timedelta(seconds=900)
    assert s.refresh_ttl == timedelta(seconds=2592000)
    assert s.cookie_secure is True


def test_cors_and_samesite_have_local_defaults(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("JWT_SECRET", "x")
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    monkeypatch.delenv("COOKIE_SAMESITE", raising=False)
    s = Settings.from_env()
    assert s.cors_origins == ("http://localhost:5173", "http://localhost:3000")
    assert s.cookie_samesite == "strict"


def test_cors_origins_parses_and_trims_comma_list(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("JWT_SECRET", "x")
    # Espacios y una entrada vacía por coma colgante: se ignoran.
    monkeypatch.setenv("CORS_ORIGINS", "https://app.example.com, https://www.example.com,")
    s = Settings.from_env()
    assert s.cors_origins == ("https://app.example.com", "https://www.example.com")


def test_cookie_samesite_none_for_cross_site_deploy(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("JWT_SECRET", "x")
    monkeypatch.setenv("COOKIE_SAMESITE", "None")  # case-insensitive
    s = Settings.from_env()
    assert s.cookie_samesite == "none"


def test_invalid_samesite_is_rejected(monkeypatch) -> None:
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "cid")
    monkeypatch.setenv("JWT_SECRET", "x")
    monkeypatch.setenv("COOKIE_SAMESITE", "bogus")
    with pytest.raises(ValueError, match="COOKIE_SAMESITE"):
        Settings.from_env()
