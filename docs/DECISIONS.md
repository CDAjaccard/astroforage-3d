# Journal des décisions

Projet développé de A à Z par Claude (agent) à la demande d'Arnaud Jaccard,
sans disponibilité du propriétaire pendant le développement. Chaque question
qui aurait dû lui être posée est consignée ici avec la réponse retenue et sa
justification. À relire au retour — tout est réversible.

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Moteur / stack ? | **Three.js + TypeScript + Vite** (client), **Node + ws** (serveur), **Electron** (Steam) — pas Godot/Unity/Unreal. | Le jeu original est 100 % web ; cette stack permet de développer, tester et vérifier le jeu de bout en bout en local (y compris le coop multi-onglets) sans installer de moteur. Electron est accepté sur Steam (Vampire Survivors v1 était un jeu web packagé). Compétences réutilisables depuis le jeu original. |
| 2 | Comment transposer le forage 2D ? | Monde **voxel** 64×64×150 (Acte II : ×210), 1 voxel = 2 m, strates/filons/cavernes générés avec les mêmes bandes de profondeur et le même PRNG (mulberry32). | Creuser des galeries EST l'identité du jeu. La convention 1 voxel = 2 m conserve à l'identique toutes les constantes de l'original (paliers 50-400 m, ligne de surchauffe, profondeur des filons). |
| 3 | La foreuse en 3D ? | Véhicule **volant** piloté (comme en 2D : elle vole avec des réacteurs), forage au réticule (voxel adjacent, portée ~4.5 m). | Fidèle au pilotage original (poussée verticale + latéral + creuser dans 4 directions → généralisé en visée libre). Évite une physique de véhicule à roues, injustifiée ici. |
| 4 | Équilibrage : reprendre ou rééquilibrer ? | **Copie stricte de `data.js`** (ressources, recettes, coûts, améliorations, quêtes, exploits, difficultés, textes SAM). Seules les densités de génération sont recalibrées au volume 3D. | « Reprendre les mêmes mécaniques » ; l'équilibrage original est éprouvé (jeu publié sur les stores mobiles). |
| 5 | Architecture coop ? | Même modèle que l'original : **serveur autoritatif** exécutant la sim complète, clients prédictifs envoyant des intentions ; salles à code + mot de passe + persistance disque. Snapshot = seed + deltas (pas la grille). | Architecture validée par l'original (« Palier 2 »). Le snapshot par seed+deltas rend le voxel 3D (600k+ cases) léger sur le réseau. |
| 6 | Solo : en ligne ou hors-ligne ? | **100 % hors-ligne** : la même `GameSim` tourne en local (interface unique `SimPort` locale/réseau). | Parité avec l'original, exigence Steam raisonnable (jeu jouable sans serveur), et un seul code de simulation à maintenir. |
| 7 | Astronaute : modèle généré ou procédural ? | **Procédural** (primitives animées par code). Props (foreuse, fusée, rampant, cristal, robot) : **générés via MCP Higgsfield**. | Le vestiaire (couleurs combinaison/visière/accent, visibles en coop) exige un modèle recolorable par matériaux ; un GLB texturé généré ne l'est pas proprement. Les props fixes, eux, profitent à fond de la génération. |
| 8 | Skybox générée ? | **Procédurale** (shader jour/nuit, étoiles, deux lunes). | Une équirectangulaire générée présente des risques de couture/projection ; le ciel dynamique jour/nuit exige de toute façon du procédural. Crédits économisés pour les props. |
| 9 | Musique / SFX ? | **WebAudio procédural** porté de l'original (nappe réactive profondeur/nuit/tempête + SFX synthétisés). Pas de TTS pour SAM (texte + blip radio, comme l'original). | L'original est déjà 100 % procédural — identité sonore conservée. Le MCP ne fournit pas de modèle musique hors de son pipeline de jeux hébergés ; le respect de ses règles d'usage prime. |
| 10 | Visibilité du repo GitHub ? | **Public**, licence « tous droits réservés, source consultable » (pas MIT). | Le repo original est public ; un jeu commercial Steam ne doit pas être librement redistribuable. Basculable en privé en un clic si souhaité. |
| 11 | Nom du repo ? | `astroforage-3d` (compte CDAjaccard). | Demande : « AstroForage 3d » ; kebab-case conforme aux conventions GitHub, cohérent avec `astroforage`. |
| 12 | Budget crédits MCP (166 dispo) ? | ~30 crédits : 5 modèles 3D (5 cr pièce) + 3 images store (1 cr pièce). | Couvre tous les assets à forte valeur ; garde une grosse réserve pour itérations de l'utilisateur. |
| 13 | Brouillard de guerre ? | Supprimé en 3D ; compensé par Géoscanner (minerais en surbrillance à travers la roche, portée courte) et Labo (balises cristaux). | Le fog-of-war 2D n'a pas d'équivalent lisible en vue subjective ; l'occlusion naturelle des galeries joue déjà ce rôle. Les deux bâtiments gardent ainsi leur utilité. |
| 14 | Intérieur de la fusée (déco, vestiaire) ? | Reporté (roadmap). Les couleurs de combinaison restent réglables (Options) et synchronisées en coop ; l'établi de décoration viendra après. | Système entièrement cosmétique, coûteux en 3D (pièce intérieure + placement libre), non bloquant pour la boucle de jeu ni pour Steam. |
| 15 | Multijoueur Steam (invitations, relay) ? | v0.1 : serveur dédié auto-hébergeable + « Héberger (LAN) » intégré au build desktop (le serveur tourne dans Electron). Steam Networking/SDR : roadmap. | Reproduit le modèle éprouvé de l'original (serveur communautaire) sans dépendre des review Steamworks pour jouer. |
| 16 | Touches par défaut ? | ZQSD **et** WASD acceptés (comme l'original : flèches/QD/ZS), `E` interagir, `V` caméra, `R` robot, `T` rappel, `B` construire, `I` stock, Shift surrégime, Espace saut/poussée. | Continuité avec l'original + public FR (ZQSD) et international (WASD). |
| 17 | Versions | v0.1.0 « vertical slice complet » : toute la boucle Acte I + Acte II, coop, Electron. | Base saine : tout ce qui est présent fonctionne et est testé ; le reste est explicitement en roadmap. |

Voir aussi `docs/GDD.md` (mapping mécanique par mécanique) et
`docs/ROADMAP.md`.
