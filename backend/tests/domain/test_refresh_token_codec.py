from sleepmon.adapters.outbound.auth.refresh_token import SecretsRefreshTokenCodec


def test_generate_returns_clear_and_matching_hash() -> None:
    codec = SecretsRefreshTokenCodec()
    clear, hashed = codec.generate()
    assert clear and hashed
    assert codec.hash(clear) == hashed


def test_hash_is_deterministic_and_hides_clear() -> None:
    codec = SecretsRefreshTokenCodec()
    assert codec.hash("abc") == codec.hash("abc")
    assert codec.hash("abc") != "abc"


def test_generate_is_unique() -> None:
    codec = SecretsRefreshTokenCodec()
    assert codec.generate()[0] != codec.generate()[0]
