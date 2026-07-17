# ASTRO·FORAGE 3D — Mission Retour 🚀

Adaptation **3D** (vue première/troisième personne) du jeu
[Astro·Forage](https://github.com/CDAjaccard/astroforage) : votre vaisseau
s'écrase sur **KEPLER-9b** — forez un monde **voxel** en profondeur avec la
foreuse volante, construisez une base **automatisée**, survivez à la faune,
réparez la fusée… deux fois. **Solo hors-ligne** ou **coop 2-4** en monde
partagé. Objectif : **Steam** (Windows, puis macOS).

*The 3D remake of Astro·Forage: crash-land on KEPLER-9b, dig a voxel world with
your flying mining pod, automate your base, survive the fauna and rebuild your
rocket — twice. Offline solo or 2-4 player co-op. Steam-bound. English
included — switch language in Options.*

![Statut](https://img.shields.io/badge/statut-v0.1.0_vertical_slice-79e0d6)
![CI](https://github.com/CDAjaccard/astroforage-3d/actions/workflows/ci.yml/badge.svg)

## Démarrage rapide

Prérequis : [Node.js ≥ 20](https://nodejs.org).

```bash
npm install

# jouer (solo, hors-ligne) — serveur de dev Vite
npm run dev                # http://localhost:5173

# coop : serveur autoritatif (+ sert aussi le client construit)
npm run dev:server         # ws + http sur :8080
# puis menu ◈ COOP → même code de salle dans 2 fenêtres → Rejoindre

# version de bureau (Electron, base du build Steam)
npm run build              # construit le client
npm --workspace=@astroforage/desktop run start
```

## Contrôles

| Touche | Action |
|---|---|
| ZQSD / WASD + souris | se déplacer / regarder |
| Espace | sauter · **jetpack** (maintenir en l'air) · poussée de la foreuse |
| **E** | interagir : foreuse, cristaux, bâtiments, fusée, robots |
| Clic gauche | **forer** le voxel visé (en foreuse) |
| Shift | **surrégime** (fore et vole plus vite, batterie fond) |
| **V** | caméra 1ʳᵉ / 3ᵉ personne |
| B / I / H | construire / stockage / aide |
| R / T | déployer un robot · rappel monte-charge |
| Échap / P | pause |

## La boucle de jeu

1. **Forez** : visez, maintenez le clic. Fer, charbon, cuivre… puis quartz,
   glace, titane, uranium selon la profondeur (jusqu'à 300 m — et au-delà à
   l'Acte II).
2. **Déchargez** : posez-vous en surface — dépôt, recharge et réparations
   automatiques.
3. **Construisez** : générateur, fonderie, atelier, panneaux, silo, raffinerie,
   monte-charge, baie robotique, labo, réacteur, géoscanner.
4. **Automatisez** : robots-foreuses autonomes, recettes en continu, gestion
   de l'énergie (solaire + accumulateurs la nuit), surcadence ×1.8.
5. **Survivez** : oxygène à pied, surchauffe en profondeur, lave, poches de
   gaz, tempêtes, météorites nocturnes, Rampants / Traqueurs / Cracheurs et
   leurs nids.
6. **Réparez la fusée** (5 systèmes) et **décollez**. Le premier départ ne se
   passe pas comme prévu — les **abysses** s'ouvrent (Acte II : magmatite,
   iridium, alliage stellaire, plasma).

Toutes les données d'équilibrage (ressources, recettes, coûts, quêtes, textes
de SAM, exploits, difficultés) proviennent **à l'identique** du jeu original.

## Architecture (résumé)

```
shared/   simulation TypeScript pure : génération voxel déterministe (seed),
          production, robots, faune, fusée, quêtes — LA vérité du jeu
client/   Three.js + Vite : rendu par chunks (AO, atlas procédural), contrôleurs
          FPS/TPS, HUD, menus FR/EN, audio WebAudio 100 % synthétisé
server/   Node + ws : coop autoritative (salles à code, mot de passe,
          persistance disque) — exécute la même GameSim que le solo
desktop/  Electron + steamworks.js (optionnel) : build Steam, succès,
          « Héberger (LAN) » intégré
```

En solo, la `GameSim` tourne **dans le client, hors-ligne**. En coop, la même
`GameSim` tourne **sur le serveur** ; les clients envoient des intentions et
prédisent leur avatar — le modèle du jeu original, conservé. Détails :
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) ·
[docs/MULTIPLAYER.md](docs/MULTIPLAYER.md).

## Documentation

| Document | Contenu |
|---|---|
| [docs/GDD.md](docs/GDD.md) | Game design : mapping complet 2D → 3D |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Décisions prises pendant le développement autonome, avec justifications |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Monorepo, simulation partagée, rendu voxel |
| [docs/MULTIPLAYER.md](docs/MULTIPLAYER.md) | Protocole coop, salles, hébergement d'un serveur |
| [docs/STEAM.md](docs/STEAM.md) | Checklist de publication Steam (dépôts, capsules, succès) |
| [docs/BUILD.md](docs/BUILD.md) | Builds Windows / macOS, CI |
| [docs/ASSETS.md](docs/ASSETS.md) | Assets générés (MCP Higgsfield) et pipeline |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Ce qui manque encore et dans quel ordre |

## Tests

```bash
npm test            # vitest : worldgen déterministe, sim, campagne, snapshots
npm run typecheck   # TypeScript strict sur tous les workspaces
```

## Licence

Code source consultable, **tous droits réservés** — voir [LICENSE](LICENSE).
© 2026 Arnaud Jaccard / WeProcess.
