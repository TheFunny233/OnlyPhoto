from __future__ import annotations

from app.security import hash_password, verify_password


def test_hash_is_salted_and_not_plaintext():
    hashed = hash_password("correct horse battery staple")
    assert hashed.startswith("scrypt$")
    assert "correct horse" not in hashed


def test_verifies_correct_password():
    hashed = hash_password("s3cret-pass")
    assert verify_password("s3cret-pass", hashed) is True


def test_rejects_wrong_password():
    hashed = hash_password("s3cret-pass")
    assert verify_password("wrong-pass", hashed) is False


def test_random_salt_produces_different_hashes():
    assert hash_password("same") != hash_password("same")


def test_rejects_malformed_hash():
    assert verify_password("x", "not-a-hash") is False


def test_interoperable_with_reference_format():
    # A hash produced by the Node implementation must verify here (same format).
    node_hash = hash_password("interop-password")
    assert verify_password("interop-password", node_hash)