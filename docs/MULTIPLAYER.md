# Multijoueur coopératif (2-4)

Monde **entièrement partagé** : terrain foré, base, stock, robots, production,
énergie, faune, fusée, objectifs. Chaque pilote garde **ses** améliorations
de foreuse/jetpack et ses couleurs de combinaison. Même modèle autoritatif
que le jeu original (« Palier 2 »).

## Jouer en coop

### Serveur
```bash
npm run dev:server        # (ou npm start) — http + WebSocket sur :8080
```
Le serveur sert aussi le client construit (`npm run build`) : vos amis peuvent
jouer directement sur `http://VOTRE-IP:8080`, sans rien installer.

Dans le build **desktop** (Electron), le bouton **◈ COOP → Héberger (LAN)**
lance ce même serveur à l'intérieur du jeu (port 8080).

### Clients
Menu **◈ COOP** : adresse du serveur (`ws://IP:8080`), **code de salle**
(A-Z/0-9), pseudo, mot de passe optionnel → **Rejoindre**.
- Même code = même planète.
- Un mot de passe fourni **à la création** de la salle la rend privée.
- La liste des **salles publiques** du serveur s'affiche dans le menu
  (`GET /api/rooms`).

### Persistance
Chaque salle est sauvegardée dans `server/data/rooms/<CODE>.json`
(seed + éditions du terrain + état complet) :
- à intervalle régulier (30 s) tant que des joueurs sont présents,
- au départ du dernier joueur et à l'arrêt du serveur (SIGINT/SIGTERM).
Les mondes coop **survivent aux redémarrages**.

## Protocole (JSON sur WebSocket)

### Client → serveur
| t | Contenu | Rôle |
|---|---|---|
| `join` | room, name, pass?, cos | entrer dans une salle |
| `s` | x,y,z,yaw,pitch,d,g,j,dg,b,a (18 Hz) | état de l'avatar |
| `intent` | `i` = dig, harvest, deposit, debris, build, demolish, machine, upgrade, research, robotAdd, robotDeploy, robotRecall, baieUp, spdUp, contribute, launch, rescue | toute action sur le monde partagé |

### Serveur → client
| t | Contenu | Cadence |
|---|---|---|
| `welcome` | id, room, snapshot (seed + éditions + état) | à l'entrée |
| `players` | positions/états des avatars | 30 Hz |
| `world` | deltas de voxels `[x,z,d,v,…]` | quand ça change |
| `base` | stock, bâtiments, robots, fusée, énergie, quêtes, météo | ~4 Hz |
| `mobs` | créatures, projectiles, nids | 30 Hz quand actifs |
| `hurt` | dégâts (coque / oxygène) du joueur visé | événementiel |
| `events` | toasts, SAM, explosions, décollage, act2, win… | événementiel |
| `resync` | snapshot complet (ouverture des abysses) | Acte II |
| `ack` | réponse aux intents personnels (upgrade, deposit, dig) | événementiel |

Le snapshot ne contient **jamais** la grille : le client regénère le monde
depuis la seed (génération déterministe partagée) puis rejoue les éditions —
quelques Ko au lieu de ~600 Ko.

## Déployer un serveur public

Le serveur est un simple process Node (aucune base de données) :

```bash
git clone https://github.com/CDAjaccard/astroforage-3d && cd astroforage-3d
npm install && npm run build         # client servi par le serveur
PORT=8080 npm start
```

- Derrière un reverse-proxy TLS (nginx/caddy), exposez `wss://` — le client
  accepte `ws://` et `wss://`.
- Le dossier `server/data/` doit être persistant (volumes).
- Modèle de confiance : positions d'avatar **client-autoritatives** (comme
  l'original) — adapté à du coop entre amis, pas à du compétitif public.

Roadmap réseau (invitations Steam, relay) : voir `docs/ROADMAP.md`.
