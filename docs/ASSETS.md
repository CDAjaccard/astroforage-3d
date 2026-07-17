# Assets — génération et pipeline

## Assets générés (MCP Higgsfield, 17 juillet 2026)

Modèles 3D (`tripo_3d`, texturés PBR, GLB) — dans
`client/public/assets/models/` :

| Fichier | Rôle en jeu | Job id |
|---|---|---|
| `foreuse.glb` | la foreuse volante pilotable | bcf6cb33-8217-4c8a-bde4-494a5e5ad81a |
| `fusee.glb` | la fusée à réparer (site du crash) | de8e96a1-0786-4d80-8282-443e18e8f02b |
| `rampant.glb` | faune (teinté rouge = Traqueur, vert = Cracheur) | f4ef7676-ce69-4b19-afe4-7af403b70aa6 |
| `cristal.glb` | cristaux des cavernes (récolte à pied) | 20a1686f-ac8a-4834-8a30-e1f5cbfc80ee |
| `robot.glb` | robots-foreuses autonomes | 3c611ff5-0e29-4762-a540-ab6558268924 |
| `astronaute.glb` | astronaute chibi **riggé + marche embarquée** (Meshy image_to_3d, concept seedream 79d5c0aa) — teinté par le vestiaire, AnimationMixer | e696ab83-ea8a-49e7-b7e8-6f7a353eaea5 |
| `batiments/*.glb` (×12) | les 12 bâtiments de la base, animés par `render/buildings.ts` : fumée/vapeur, lueurs pulsées (+ vraies lumières pour fonderie/monte-charge/labo/réacteur), éléments mobiles (plateforme du monte-charge, hologramme du labo, anneau-sonar du scanner, ventilateur du générateur, panneau solaire qui suit le soleil) et **bruits d'usine** par proximité (hum/vapeur/réacteur) | dc11640b, e8d17493, 8f559d4a, 0449f636, 1dfd0940, 1475a5be, 296b8698, a775b735, 687c74a8, 101156fc, adef8148, 80dc9751 |

Images (`seedream_v4_5`) — dans `steam/store/` :

| Fichier | Rôle |
|---|---|
| `keyart.png` (2560×1440) | key art sans texte (hero, screenshots marketing) |
| `capsule-source.png` | base des capsules avec titre |
| `icon.png` (2048²) | icône du jeu (app + `desktop/build/icon.png`) |

Les capsules Steam aux dimensions exactes (header/main/small/hero/icon-256)
sont dérivées par recadrage centré — régénérables via le snippet
System.Drawing de l'historique de build ou tout outil d'image.

Coût total : ~28 crédits (5/modèle 3D, 1/image).

## Principes d'intégration

1. **Repli procédural systématique** : chaque prop a une version primitives
   dans `client/src/render/props.ts`. Supprimez un GLB → le jeu tourne
   toujours. Les GLB sont normalisés au chargement (hauteur cible, pied à
   y=0, centrage).
2. **L'astronaute** est un GLB stylisé **riggé** (demande joueur) : clonage de
   squelette par instance, clip de marche piloté par la vitesse, teinte du
   vestiaire appliquée par lerp sur les matériaux. Le rig procédural d'origine
   reste le repli si le GLB manque.
3. **Les bâtiments sont procéduraux** : 12 silhouettes distinctes + icône
   flottante — lisibilité > fidélité photographique, et zéro dépendance à la
   génération.
4. **Textures voxel, ciel, particules, audio : 100 % procéduraux** (atlas
   canvas, shader, WebAudio) — déterministes, légers, cohérents avec la
   palette du jeu original.

## Régénérer / ajouter un asset

Via le MCP Higgsfield (« XField ») :
1. `generate_3d` modèle `tripo_3d`, prompt descriptif « stylized game asset,
   single object », `texture:true, pbr:true`, `face_limit` 20-40k.
2. Télécharger le GLB du job dans `client/public/assets/models/<nom>.glb`.
3. Ajouter le chargement dans `Props.load()` (+ un repli procédural).

Licence : assets générés pour ce projet — voir LICENSE (pas de réutilisation
hors ASTRO·FORAGE sans accord).
