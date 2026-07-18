# Publication Steam — checklist complète

Objectif : sortir **ASTRO·FORAGE 3D** sur Steam (Windows d'abord, macOS
ensuite). Le jeu est un client web packagé **Electron** — approche acceptée
sur Steam (nombreux précédents commerciaux).

## 1. Compte et fiche

- [ ] Compte [Steamworks](https://partner.steamgames.com) + frais Steam Direct
      (100 USD par jeu, remboursés à 1 000 USD de ventes).
- [ ] Créer l'app → noter l'**AppID** réel.
- [ ] Remplacer l'appid de test (480) :
      `desktop/steam_appid.txt` **et** `STEAM_APPID` dans
      `desktop/src/steam.cjs`.
- [ ] Fiche magasin : textes FR/EN prêts à adapter depuis la fiche mobile du
      jeu original (`mobile/store/LISTING.md` du repo 2D) — pitch identique.
- [ ] Classification : questionnaire de contenu (violence fantastique légère,
      pas d'achats intégrés, pas de contenu généré par les joueurs).
- [ ] Politique de confidentialité : reprendre
      `https://astro.weprocess.dev/privacy` (déjà en ligne, FR+EN, couvre le
      coop — pseudo + position transitent par le serveur, rien de conservé).

## 2. Assets graphiques (déjà générés dans `steam/store/`)

| Fichier | Usage Steam | Taille requise |
|---|---|---|
| `capsule-header-460x215.png` | Header capsule | 460×215 ✅ |
| `capsule-main-616x353.png` | Main capsule | 616×353 ✅ |
| `capsule-small-231x87.png` | Small capsule | 231×87 ✅ |
| `hero-3840x1240.png` | Library hero | 3840×1240 ✅ |
| `icon-256.png` | Icône client / communauté | 256×256 ✅ |
| `keyart.png` | Base pour screenshots/hero | 2560×1440 |
| — à produire | Library capsule **600×900** (portrait) | régénérer une version verticale du key art |
| — à produire | 5+ **captures de jeu** 1920×1080 | prendre en jeu (F11, HUD visible) |
| — à produire | Trailer 30-60 s | capture OBS des moments forts |

> Les capsules avec texte doivent garder le titre lisible aux petites tailles —
> `capsule-small` est à re-composer avec le logo seul si besoin.

## 3. Build et dépôts

```bash
npm run dist:win      # → desktop/release/astroforage-3d-setup-<version>.exe
                      #   + dossier win-unpacked/ (contenu du dépôt Steam)
```

Sur Steam on ne livre pas l'installeur NSIS mais le **dossier déballé**
(`desktop/release/win-unpacked/`). Gabarits SteamPipe fournis dans
`steam/` :

- `steam/app_build.vdf` — description du build (remplacer APPID),
- `steam/depot_windows.vdf` — dépôt Windows (contenu = win-unpacked).

Upload :
```bash
steamcmd +login <compte> +run_app_build ..\steam\app_build.vdf +quit
```

- [ ] Options de lancement : exécutable `ASTRO-FORAGE 3D.exe`, OS Windows.
- [ ] Steamworks SDK : la lib `steam_api64.dll` est fournie par
      `steamworks.js` (voir §4).
- [ ] Tester via la branche `beta` privée avant `default`.

## 4. Intégration Steamworks

`steamworks.js` est une dépendance **optionnelle** : sans elle (ou hors
Steam), le jeu tourne normalement, succès désactivés.

```bash
npm install steamworks.js --workspace=@astroforage/desktop   # avant dist
```

- **Succès** : les 14 exploits du jeu sont déjà mappés dans
  `desktop/src/steam.cjs` (`ACH_FIRST_ORE`, `ACH_DEPTH_50`, …,
  `ACH_FLAWLESS`). Créer les 14 succès avec ces API names dans Steamworks →
  Stats & Achievements, avec les textes FR/EN de `shared/src/data.ts`
  (`FEATS`). Le déblocage in-game appelle `af3d.steamUnlock(featId)`
  automatiquement.
- **Overlay** : l'overlay Steam fonctionne avec Electron ; si souci, lancer
  avec `--in-process-gpu` (à tester sur build réel).
- **Steam Cloud** : activer l'Auto-Cloud sur le dossier de profil Electron
  (`%APPDATA%/astroforage-3d` — Local Storage) ou attendre l'export de
  sauvegarde fichier (roadmap).
- **Steam Input / manette** : roadmap (le jeu est clavier/souris v0.1).

## 5. Coop et Steam

v0.1 : coop par serveur auto-hébergé (LAN/Internet, code de salle) — décrire
clairement sur la fiche (« Online Co-op », « LAN Co-op »).
Roadmap : invitations Steam + Steam Datagram Relay via `steamworks.js`
(`networking` API) pour du join-sans-IP.

## 6. Review Valve — pièges connus

- [ ] Le jeu doit se lancer **hors ligne** et sans compte tiers ✅ (solo
      100 % local).
- [ ] Pas de contenu web distant obligatoire ✅ (tout est packagé).
- [ ] Quitter proprement (bouton Quitter du menu) ✅.
- [ ] Résolutions : fenêtre redimensionnable + plein écran ✅.
- [ ] macOS : build ultérieur — retirer la coche macOS au lancement Windows.

## 7. Steam Deck — checklist « Verified »

Le jeu est conçu pour passer la review Deck :

| Critère Valve | État |
|---|---|
| Support manette complet | ✅ Gamepad API (Steam Input → XInput) : sticks déplacement/visée, A saut/vol, RT/RB forer, LB/LT surrégime, X interagir, Y caméra, B retour, Start pause, Select stock, D-pad construire/aide/robot/rappel. Astuce 🎮 affichée à la connexion. |
| Résolution 1280×800 | ✅ UI fluide (CSS responsive), FOV réglable 60-110 |
| Lisibilité du texte | ✅ tailles ≥ 12 px ; à re-vérifier sur écran Deck réel |
| Pas de launcher/DRM tiers | ✅ l'exe démarre directement |
| Jouable hors-ligne | ✅ solo 100 % local |
| Défauts de performance | Options : résolution interne 0.75×, particules allégées, ombres désactivées par défaut |
| Clavier virtuel | ⚠️ champs texte (pseudo/salle coop) : invoquer le clavier Steam — à tester sur Deck ; sinon saisie tactile |

Reste à faire sur machine réelle : passe de test Deck (perfs Proton,
overlay, clavier virtuel) avant de cocher « Deck Verified » sur la fiche.

## 8. macOS (plus tard)

`npm run dist:mac` sur un Mac (electron-builder ne cross-compile pas les
builds signés). Nécessite : compte Apple Developer, certificat Developer ID,
notarisation (`electron-builder` la gère via variables d'env). Détails dans
`docs/BUILD.md`.
