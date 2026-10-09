"""Responses are gzipped when the client accepts it, including through Lambda.

The catalog is the API's largest public response (~100 KB of JSON); gzip shrinks it
about tenfold, which is both load time and the API's data-transfer bill.
"""

from __future__ import annotations

import base64
import gzip
import json

import pytest
from litestar.testing import TestClient

from tests.http.test_api import client  # noqa: F401  (pytest fixture)


def test_catalog_is_gzipped_when_accepted(client: TestClient) -> None:  # noqa: F811
    response = client.get("/catalog", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
    plain = client.get("/catalog", headers={"Accept-Encoding": "identity"})
    assert response.json() == plain.json()
    assert int(response.headers["content-length"]) < len(plain.content) / 5


def test_catalog_is_plain_when_gzip_is_not_accepted(client: TestClient) -> None:  # noqa: F811
    response = client.get("/catalog", headers={"Accept-Encoding": "identity"})

    assert response.status_code == 200
    assert "content-encoding" not in response.headers


def test_gzipped_body_survives_the_lambda_adapter(client: TestClient) -> None:  # noqa: F811
    # Mangum must hand a gzipped body back base64-encoded (it is not valid UTF-8);
    # otherwise the Function URL would return a corrupted response.
    mangum = pytest.importorskip("mangum")
    handler = mangum.Mangum(client.app, lifespan="off")
    event = {
        "version": "2.0",
        "rawPath": "/catalog",
        "rawQueryString": "",
        "headers": {"accept-encoding": "gzip", "host": "api.example"},
        "requestContext": {
            "http": {"method": "GET", "path": "/catalog", "sourceIp": "203.0.113.1"},
            "domainName": "api.example",
        },
        "isBase64Encoded": False,
    }

    result = handler(event, None)

    assert result["statusCode"] == 200
    assert result["headers"]["content-encoding"] == "gzip"
    assert result["isBase64Encoded"] is True
    expected = client.get("/catalog", headers={"Accept-Encoding": "identity"}).json()
    assert json.loads(gzip.decompress(base64.b64decode(result["body"]))) == expected
