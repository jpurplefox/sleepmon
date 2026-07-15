from datetime import timedelta

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
