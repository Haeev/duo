# Clé de test des paquets

Clé Ed25519 `duo-test`, versionnée exprès (ADR 0010, point 1; ADR 0013): elle signe les paquets des tests et des essais de bout en bout. Ce n'est pas un secret, puisque seules les versions de test de Duo (`DUO_TEST`) la connaissent. Une version publiée refuse tout paquet signé par elle, et la CI vérifie que la clé publique ci-dessous est absente de l'application publiée.

- `duo-test.pem`: clé privée, PEM PKCS8.
- `duo-test.pub`: clé publique brute, 32 octets en base64 (`BykDvRBr0nsJcew7Ilc4Dc4KYzGIyXYyLlJPAqBQxfs=`).

Fabriquer un paquet de test:

```sh
DUO_CLE_PAQUETS="$(cat packages/paquet/cle-test/duo-test.pem)" DUO_CLE_PAQUETS_ID=duo-test \
  node outils/paquet-jeu.mjs games/mon-jeu --sortie /tmp/paquets
```

La clé de publication (`duo-2026`) vit dans les secrets de GitHub Actions et ne sort jamais de la CI.
