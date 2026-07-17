# Architecture

## Monorepo (npm workspaces)

```
astroforage-3d/
├── shared/          @astroforage/shared — simulation pure (TS, zéro dépendance)
│   └── src/
│       ├── data.ts      constantes du jeu (port fidèle de data.js original) + i18n
│       ├── rng.ts       mulberry32 (PRNG déterministe du jeu original)
│       ├── world.ts     génération voxel, Acte II, séismes, accès grille
│       ├── sim.ts       GameSim : LA simulation autoritative + fonctions pures
│       ├── types.ts     état partagé, avatars, événements, snapshots
│       └── protocol.ts  messages coop + constantes réseau
├── server/          @astroforage/server — Node 20 + ws (tsx, sans étape de build)
├── client/          @astroforage/client — Vite + Three.js + TS
│   └── src/
│       ├── game/        orchestrateur, ports de sim, physique voxel
│       ├── render/      chunks, atlas, ciel, props, effets
│       ├── ui/          HUD, panneaux, menus, i18n FR/EN
│       ├── audio/       moteur WebAudio 100 % procédural
│       └── save/        slots localStorage + export/import
└── desktop/         @astroforage/desktop — Electron + steamworks.js (optionnel)
```

`shared` est consommé **en source** (alias Vite + tsx) : aucune étape de build
intermédiaire, un seul endroit où vit la logique de jeu.

## Le principe central : une seule simulation

`GameSim` (shared/src/sim.ts) possède tout l'état partagé : terrain voxel,
stock, bâtiments, énergie, robots, faune, nids, fusée, quêtes, météo, actes.

- **Solo** : le client instancie `GameSim` localement (`LocalSim`) — 100 %
  hors-ligne, aucune différence de gameplay.
- **Coop** : le serveur instancie une `GameSim` par salle ; les clients en
  gardent une **réplique** (`NetSim`) mise à jour par messages.

Les clients ne simulent JAMAIS le monde : ils envoient des **intentions**
(`dig`, `build`, `upgrade`, `deposit`, `contribute`, `launch`, …) que
`GameSim.applyIntent()` valide et applique. En revanche, chaque client simule
**son avatar** (astronaute/foreuse : mouvement, O2, batterie, forage en cours)
— prédiction locale, fluidité parfaite, exactement le modèle « Palier 2 » du
jeu original.

```
              intentions                       étapes (30 Hz)
client ────────────────────────▶ GameSim ◀──────────────────── horloge
   ▲                                │
   │   deltas voxel · état base ·   │ drainTileDeltas() / drainEvents()
   └────── faune · événements ──────┘ drainDamage() / drainResync()
```

Les sorties de la sim sont des **files drainées** : deltas de voxels (à
diffuser/appliquer), événements de présentation (toasts, SAM, explosions,
décollage…), dégâts par joueur, demande de resync (Acte II).

## Monde voxel

- Grille `Uint8Array` 64×64×150 (Acte II : ×210), ids identiques à l'original
  (strates 1-5, lave 6, gaz 7, cristal 8, socle 9, minerais 10+, Cœur 31,
  strates abyssales 32-33). 1 voxel = 2 m ⇒ toutes les constantes de
  profondeur de l'original restent vraies.
- Génération **déterministe par seed** (mulberry32). Les densités de minerai
  2D (minerai rencontré par mètre de tunnel) sont converties en densités
  volumiques — creuser rapporte comme dans l'original.
- Toute modification passe par `setTile()` qui journalise dans `edits[]` :
  un snapshot = `seed + éditions + état`, jamais la grille (léger en réseau
  et sur disque). `GameSim.restore()` regénère puis rejoue.
- Sauvegarde solo = même snapshot + état de l'avatar (slots localStorage,
  export/import JSON).

## Rendu (client)

- **Chunks 16³** : culling de faces, occlusion ambiante par sommet (avec flip
  de quad anti-artefact), deux géométries par chunk (éclairée / émissive pour
  la lave). Reconstruction incrémentale (file de chunks sales, budget/frame).
- **Atlas procédural** (canvas 8×4 cases) : teintes des strates originales,
  éclats lumineux par minerai, braises de lave, suintements de gaz.
- Cristaux et Cœur : **props** (GLB généré / repli procédural), pas des cubes.
- **Ciel shader** : cycle jour/nuit (150 s), soleil, étoiles, deux lunes,
  voile de tempête. Brouillard et lumières pilotés par profondeur/heure ;
  lampe frontale spot + tone mapping ACES.
- Props générés par MCP (foreuse, fusée, rampant, cristal, robot) avec repli
  procédural systématique ; astronaute 100 % procédural (recolorable —
  vestiaire visible en coop) ; 12 bâtiments procéduraux à silhouettes
  distinctes.

## Boucle client

`Game.update(dt)` : contrôleur d'avatar (balayage AABB par axe contre la
grille + raycast DDA pour le forage) → `sim.update()` → application des
files → visuels des entités (interpolation) → caméra FPS/TPS (anti-clip mur)
→ HUD → audio réactif.

Hooks de test headless (dev uniquement) : `AF3D_STEP(dt, n)` avance la boucle
manuellement, `AF3D_SHOT()` capture le canvas — le jeu se pilote et se
vérifie sans fenêtre visible (agents, CI).
