"""Clé de signature de l'appli Android, refaite à l'identique à chaque fabrication à partir d'une phrase secrète
(secret GitHub ANDROID_GRAINE, choisie par la personne et connue d'elle seule).

Android n'installe une nouvelle version par-dessus l'ancienne (en gardant la mémoire de l'appli) que si elle est signée
par le MÊME certificat. Au lieu de garder un fichier de clé quelque part, on le recalcule : même phrase → même clé RSA,
même certificat (dates et numéro fixes, signature PKCS#1 v1.5 qui ne tire rien au hasard).

    python3 cle.py <sortie.p12>      (phrase lue dans la variable ANDROID_GRAINE ; mot de passe du fichier écrit sur la sortie)
"""
import datetime
import hashlib
import hmac
import os
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID


class Tirage:
    """Suite d'octets entièrement déterminée par la phrase (HMAC-SHA256 en mode compteur)."""

    def __init__(self, graine: bytes):
        self.cle = hashlib.sha256(b"boite-mail-android|" + graine).digest()
        self.n = 0

    def octets(self, k: int) -> bytes:
        sortie = b""
        while len(sortie) < k:
            self.n += 1
            sortie += hmac.new(self.cle, self.n.to_bytes(8, "big"), hashlib.sha256).digest()
        return sortie[:k]

    def entier(self, bits: int) -> int:
        return int.from_bytes(self.octets((bits + 7) // 8), "big") >> ((8 - bits % 8) % 8)


PETITS = [p for p in range(3, 2000, 2) if all(p % q for q in range(3, int(p ** 0.5) + 1, 2))]


def premier(n: int, t: Tirage) -> bool:
    if n < 2 or any(n % p == 0 and n != p for p in PETITS):
        return False
    d, s = n - 1, 0
    while d % 2 == 0:
        d //= 2
        s += 1
    for _ in range(40):
        a = 2 + t.entier(n.bit_length() + 8) % (n - 3)
        x = pow(a, d, n)
        if x in (1, n - 1):
            continue
        for _ in range(s - 1):
            x = pow(x, 2, n)
            if x == n - 1:
                break
        else:
            return False
    return True


def nombre_premier(bits: int, t: Tirage, e: int) -> int:
    while True:
        c = t.entier(bits) | (3 << (bits - 2)) | 1
        if premier(c, t) and (c - 1) % e != 0:
            return c


def main():
    graine = os.environ.get("ANDROID_GRAINE", "").encode("utf-8")
    if len(graine) < 12:
        sys.exit("ANDROID_GRAINE absente ou trop courte (12 caractères au moins)")
    t = Tirage(graine)
    e = 65537
    p = nombre_premier(1536, t, e)
    q = nombre_premier(1536, t, e)
    if p < q:
        p, q = q, p
    n = p * q
    phi = (p - 1) * (q - 1)
    d = pow(e, -1, phi)
    pub = rsa.RSAPublicNumbers(e, n)
    priv = rsa.RSAPrivateNumbers(p, q, d, d % (p - 1), d % (q - 1), pow(q, -1, p), pub).private_key()

    nom = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Boite mail"), x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Origami"),
                     x509.NameAttribute(NameOID.COUNTRY_NAME, "CH")])
    serie = int.from_bytes(t.octets(16), "big") >> 2 or 1
    cert = (x509.CertificateBuilder().subject_name(nom).issuer_name(nom).public_key(priv.public_key()).serial_number(serie)
            .not_valid_before(datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc))
            .not_valid_after(datetime.datetime(2076, 1, 1, tzinfo=datetime.timezone.utc))
            .sign(priv, hashes.SHA256(), rsa_padding=padding.PKCS1v15()))

    mdp = hashlib.sha256(b"mdp|" + t.cle).hexdigest()[:32]
    with open(sys.argv[1], "wb") as f:
        f.write(pkcs12.serialize_key_and_certificates(b"boite", priv, cert, None, serialization.BestAvailableEncryption(mdp.encode())))
    print(mdp)
    empreinte = hashlib.sha256(cert.public_bytes(serialization.Encoding.DER)).hexdigest()
    print("empreinte du certificat : " + empreinte, file=sys.stderr)


if __name__ == "__main__":
    main()
