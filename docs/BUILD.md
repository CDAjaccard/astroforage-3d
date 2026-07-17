# Builds & CI

## Développement

```bash
npm install          # tout le monorepo (workspaces)
npm run dev          # client Vite : http://localhost:5173 (solo)
npm run dev:server   # serveur coop : :8080 (relance à chaud, tsx watch)
npm test             # vitest (simulation partagée)
npm run typecheck    # TS strict partout
```

Le serveur sert aussi `client/dist` s'il existe (`npm run build`) : un seul
process pour héberger le jeu complet.

## Bureau (Electron)

```bash
npm run build                                        # client → client/dist
npm --workspace=@astroforage/desktop run start       # lance le jeu desktop
```

Le process principal (`desktop/src/main.cjs`) charge le client construit,
initialise Steamworks si présent, et peut héberger le serveur coop en
utilityProcess (bouton « Héberger (LAN) » du menu Coop).

## Packaging Windows

```bash
npm run dist:win
# → desktop/release/astroforage-3d-setup-0.1.0.exe   (installeur NSIS)
# → desktop/release/win-unpacked/                     (dépôt Steam, cf docs/STEAM.md)
```

Notes :
- `steamworks.js` est optionnel ; pour un build Steam, l'installer d'abord :
  `npm install steamworks.js --workspace=@astroforage/desktop`.
- L'icône est `desktop/build/icon.png` (générée) — electron-builder produit
  l'`.ico` automatiquement.
- `desktop/steam_appid.txt` (480 = appid de test) est copié à côté de l'exe ;
  à remplacer par l'appid réel pour la release (et retirer du build public
  final : Steam fournit le contexte en production).

## Packaging macOS (plus tard)

À exécuter **sur un Mac** :

```bash
npm install && npm run build
npm run dist:mac        # → .dmg + .zip (non signés par défaut : identity: null)
```

Pour la distribution Steam/hors-Steam signée :
1. Compte Apple Developer + certificat **Developer ID Application**.
2. Dans `desktop/electron-builder.yml` : supprimer `identity: null`.
3. Notarisation : exporter `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`,
   `APPLE_TEAM_ID` — electron-builder notarise automatiquement.
4. Steam ne requiert pas la notarisation (lancement via le client Steam), mais
   elle est indispensable pour tout téléchargement direct.

## CI (GitHub Actions)

`.github/workflows/ci.yml` :
- **À chaque push/PR** : `npm ci` → typecheck → tests → build client
  (matrice Ubuntu + Windows), artefact `client-dist`.
- **Sur tag `v*`** : packaging Electron Windows, artefact
  `astroforage-3d-win`.

## Versionner une release

```bash
npm version minor --workspaces --include-workspace-root   # ou patch/major
git push && git push --tags                               # déclenche dist-win
```
