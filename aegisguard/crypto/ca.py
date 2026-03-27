"""
AegisGuard – Internal Certificate Authority (CA)
Threat model: Private CA keys live only on the server, 400-permission files, never transmitted.
All client certificates are signed here and tracked in the database.

Operations:
  - issue_client_cert(common_name, days) → (cert_pem, key_pem, fingerprint)
  - revoke_cert(serial)
  - sign_payload(data) → signature_b64        [for audit log sealing]
  - verify_signature(data, signature_b64) → bool
  - get_cert_fingerprint(cert_pem) → str
"""
from __future__ import annotations

import base64
import hashlib
import os
from datetime import datetime, timedelta, timezone

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPrivateKey
from cryptography.x509.oid import NameOID

from server.config import settings


def _load_ca() -> tuple[x509.Certificate, RSAPrivateKey]:
    """Load the AegisGuard root CA cert and key from disk (never cached in RAM long-term)."""
    with open(settings.aegis_ca_cert, "rb") as f:
        ca_cert = x509.load_pem_x509_certificate(f.read())
    with open(settings.aegis_ca_key, "rb") as f:
        ca_key = serialization.load_pem_private_key(f.read(), password=None)
    return ca_cert, ca_key  # type: ignore[return-value]


def _load_master_key() -> RSAPrivateKey:
    """Load the server master key used exclusively for audit log signing."""
    with open(settings.aegis_master_key, "rb") as f:
        return serialization.load_pem_private_key(f.read(), password=None)  # type: ignore[return-value]


def issue_client_cert(
    common_name: str,
    days: int = 365,
    san_ips: list[str] | None = None,
) -> tuple[str, str, str]:
    """
    Issue a new client TLS certificate signed by the AegisGuard CA.

    Returns:
        (cert_pem, private_key_pem, sha256_fingerprint)

    The private key is ONLY returned once and must be distributed securely.
    It is NOT stored on the server.
    """
    ca_cert, ca_key = _load_ca()

    # Generate client RSA key (4096-bit)
    client_key = rsa.generate_private_key(public_exponent=65537, key_size=4096)

    # Build the certificate
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "AegisGuard"),
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
    ])

    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(ca_cert.subject)
        .public_key(client_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.now(timezone.utc))
        .not_valid_after(datetime.now(timezone.utc) + timedelta(days=days))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(
            x509.ExtendedKeyUsage([x509.ExtendedKeyUsageOID.CLIENT_AUTH]),
            critical=False,
        )
    )

    # Add SAN IP addresses if provided
    if san_ips:
        from ipaddress import IPv4Address
        builder = builder.add_extension(
            x509.SubjectAlternativeName(
                [x509.IPAddress(IPv4Address(ip)) for ip in san_ips]
            ),
            critical=False,
        )

    cert = builder.sign(ca_key, hashes.SHA256())

    # Serialize
    cert_pem = cert.public_bytes(serialization.Encoding.PEM).decode()
    key_pem  = client_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()

    # SHA-256 fingerprint of the DER-encoded cert
    fingerprint = hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()

    return cert_pem, key_pem, fingerprint


def get_cert_fingerprint(cert_pem: str) -> str:
    """Compute SHA-256 fingerprint of a PEM certificate."""
    cert = x509.load_pem_x509_certificate(cert_pem.encode())
    return hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()


def sign_payload(data: bytes) -> str:
    """
    Sign arbitrary data with the server master key (RSA-PSS + SHA-256).
    Used to seal audit log entries so they cannot be tampered with.
    Returns base64-encoded signature.
    """
    master_key = _load_master_key()
    signature = master_key.sign(
        data,
        padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
        hashes.SHA256(),
    )
    return base64.b64encode(signature).decode()


def verify_signature(data: bytes, signature_b64: str) -> bool:
    """
    Verify that data matches a signature produced by sign_payload().
    Used during forensic audit verification.
    """
    master_key = _load_master_key()
    public_key = master_key.public_key()
    try:
        public_key.verify(
            base64.b64decode(signature_b64),
            data,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256(),
        )
        return True
    except Exception:
        return False


def revoke_cert(serial: int) -> None:
    """
    Add a certificate to the CRL (Certificate Revocation List).
    In production: rebuild OpenVPN CRL and reload VPN processes.
    """
    # TODO: Implement CRL management with cryptography library
    # This will update the CRL file and signal OpenVPN to reload
    pass
