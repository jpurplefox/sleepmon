import pytest

from sleepmon.adapters.outbound.auth.google_identity import GoogleIdentityProvider
from sleepmon.domain.auth import InvalidCredentialError


def _fake_ok(credential, request, client_id):
    return {"sub": "123", "email": "a@b.com", "name": "Ada", "picture": "http://p/a.png"}


def test_verify_maps_google_claims() -> None:
    prov = GoogleIdentityProvider(client_id="cid", verifier=_fake_ok)
    ident = prov.verify("any-id-token")
    assert (ident.subject, ident.email, ident.display_name) == ("123", "a@b.com", "Ada")
    assert ident.avatar_url == "http://p/a.png"


def test_verify_wraps_library_errors() -> None:
    def _boom(credential, request, client_id):
        raise ValueError("bad token")

    prov = GoogleIdentityProvider(client_id="cid", verifier=_boom)
    with pytest.raises(InvalidCredentialError):
        prov.verify("bad")


def test_missing_picture_is_none() -> None:
    def _no_pic(credential, request, client_id):
        return {"sub": "1", "email": "a@b.com", "name": "A"}

    prov = GoogleIdentityProvider(client_id="cid", verifier=_no_pic)
    assert prov.verify("t").avatar_url is None
