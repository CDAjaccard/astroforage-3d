# ASTRO·FORAGE 3D — Game Design Document

> Adaptation 3D fidèle de [Astro·Forage](https://github.com/CDAjaccard/astroforage)
> (2D, web/mobile). Toutes les mécaniques, données d'équilibrage, quêtes et
> textes de SAM proviennent du jeu original (`js/data.js`, build 44). Ce
> document décrit ce qui est conservé tel quel et comment chaque mécanique 2D
> est transposée en 3D première/troisième personne.

## 1. Pitch

Votre vaisseau s'écrase sur **KEPLER-9b**. Explorez à pied, pilotez la
**foreuse volante**, creusez des galeries dans un monde **voxel** en couches de
plus en plus profondes, construisez une **base automatisée** (générateurs,
fonderie, robots-foreuses…), survivez à la faune et réparez la **fusée** pour
rentrer — deux fois : le premier décollage échoue toujours et ouvre les
**abysses** (Acte II). Solo hors-ligne ou **coop 2-4** en monde partagé.

- **Vues** : première personne (FPS) et troisième personne (TPS), bascule `V`.
- **Plateformes** : Windows (Steam), puis macOS. Développement/test : navigateur.
- **Langues** : FR (par défaut) + EN.

## 2. Le monde : de la grille 2D au voxel 3D

| Original 2D | 3D |
|---|---|
| Grille 64×150 tuiles (`G.W`,`G.H`), 1 tuile = 2 m | Voxels **64×64 colonnes × 150 de profondeur**, 1 voxel = **2 m** (arête). Les profondeurs en mètres restent identiques : `profondeur_m = voxels × 2`. |
| Surface à la rangée `SURF=8` | Surface au niveau `d=8` ; au-dessus : ciel. Le monde est borné par du socle sur les 4 côtés et au fond. |
| Strates : régolithe (<15), roche (<40), basalte (<80), roche profonde (<120), manteau | Identique, par profondeur `d-SURF`. |
| 22 cavernes en marche aléatoire | Cavernes en « vers » 3D (marche aléatoire volumique, rayon 1-2), densité ajustée au volume. |
| Filons 2D par bandes de profondeur (charbon, fer, cuivre, quartz, glace, titane, uranium) | Mêmes bandes de profondeur, mêmes duretés, marche aléatoire 3D ; densité par colonne calibrée sur l'original. |
| Lave (id 6), poches de gaz (7), cristaux (8, au sol des cavernes), socle (9), Cœur de Kepler (31) | Identiques. Le gaz explose (sphère de rayon ~2 voxels), la lave ne se fore pas et brûle, les cristaux se récoltent **à pied uniquement**, le Cœur est enfoui dans une chambre au fond. |
| Acte II : `deepenWorld()` étend à H=210 (croûte abyssale 32, roche du noyau 33, magmatite, iridium) | Identique : extension du monde vers le bas à l'ouverture des abysses, mêmes strates/filons. |
| Secousses sismiques : régénération de filons | Identique (serveur/sim autoritaire), toasts + SAM. |
| Brouillard de guerre 2D (`rev`) | Supprimé : en 3D on ne voit que les parois exposées. Le **Géoscanner** fait briller les minerais à travers la roche autour de la foreuse ; le **Labo** révèle les cristaux (balises lumineuses). |

Génération **déterministe par seed** (mulberry32 porté tel quel) : en coop, le
serveur n'envoie que `seed + liste des voxels modifiés`, pas la grille entière.

## 3. Avatars et pilotage

### À pied (astronaute)
- Marche/course, saut, **jetpack** (maintenir Espace en l'air, jauge `jetpack`
  de l'Atelier : 90/150/240, +80 avec la recherche Nova).
- **Oxygène** : 150 s, consommé sous terre (`×` difficulté), rechargé en
  surface ou dans la foreuse. Alerte SAM sous 30 %.
- **Sacoche** : 4 cristaux max, déposés automatiquement en surface.
- Ne creuse pas. Récolte les cristaux (`E`), ramasse les débris de météorite,
  interagit avec bâtiments/fusée/foreuse (`E`).
- Caméra FPS (tête) ou TPS (épaule/orbite), bascule `V`.

### Foreuse (véhicule volant)
- Entrer/sortir : `E` à proximité (sortie uniquement posée).
- Vol : poussée verticale (Espace), déplacement horizontal (ZQSD/WASD relatif
  à la caméra), gravité constante. **Surrégime** (Shift) : tout ×~1.9 mais
  batterie fondue et surchauffe amplifiée.
- **Forage 3D** : viser un voxel adjacent (portée ~4.5 m) au réticule et
  maintenir le clic. Temps de perçage = `0.55 × dureté / vitesse_foret`
  (valeurs Mk1→Mk5 identiques). Remplace le forage 4-directions du 2D par la
  visée libre — même coût, même vitesse.
- **Soute** (12/20/32/50), **batterie** (100→350), **coque** (60→220),
  **refroidissement** (surchauffe au-delà de la profondeur sûre),
  **réacteurs** (poussée 26/32/40).
- Posée/planée au niveau de la surface : déchargement, recharge (46/s) et
  réparation (8/s) automatiques.
- **Rappel monte-charge** (`T`) : téléportation en surface, 25↯, recharge 8 s.
- Batterie à 0 sous terre ou coque à 0 → **rapatriement d'urgence**, cargaison
  perdue (statistique `rescues`, exploit « Mission parfaite » si zéro).

## 4. Base, énergie, production — identiques à l'original

Bâtiments (coûts, multiplicateur ×1.35 des répétables, max, prérequis — copiés
de `G.BUILDINGS`) : Générateur à charbon (+8↯), Fonderie, Atelier (unique),
Panneau solaire (+3↯ le jour), Accumulateur (100↯), Silo (+250), Raffinerie,
Monte-charge (unique), Baie robotique (unique, requiert Monte-charge), Labo
cristallin (unique, surcadence ×1.8), Réacteur nucléaire (+40↯), Géoscanner.

- Placement libre en surface autour du site du crash : fantôme 3D aligné sur
  la grille, sol plein requis, pas trop près de la fusée/autres bâtiments.
  Démolition = 60 % remboursés.
- Énergie : production/demande/ratio, accumulateurs (charge 6/accu, décharge
  9/accu), tempêtes qui aveuglent les panneaux (×0.2, ×0.5 avec Voile),
  surcadence ×1.8 (demande ×2.5). Recettes et temps : copie de `G.RECIPES`.
- Robots-foreuses : coût {acier:4, câble:4, circuit:1}, capacité de baie
  3/6/9, cadence 3.5/2.6/1.8 s (×0.8 avec Servos), rayon 4 (5 avec Servos),
  déployés sous terre (`R`), minerai téléporté à la base, ralentis (jamais
  arrêtés) si l'énergie manque. Rappel d'un robot par interaction.
- Recherche au Labo (payée en cristaux) : Optique, Blindage thermique, Servos,
  Recyclage (20 % bonus), Voile anti-tempête, Propulseurs Nova, Répulseur
  sonique — effets identiques.

## 5. Fusée, actes, victoire

- **Acte I** : 5 systèmes (`G.ROCKET`) — Structure, Câblage, Avionique,
  Moteur, Carburant (40). Fournir les pièces depuis le stock (panneau Fusée).
  DÉCOLLAGE → cinématique 3D → **panne à ~4.4 s** → crash au même endroit →
  **Acte II** : abysses ouvertes, 5 systèmes stellaires (`G.ROCKET2`,
  alliage/plasma/carburant enrichi), quêtes 10-13.
- **Acte II** : second décollage → **victoire** (temps, stats, exploits).
- Quêtes 1-13 : textes, conditions, progressions et récompenses de `G.QUESTS`,
  narrées par **SAM** (messages d'origine, FR ; traduits en EN).
- Paliers de profondeur (50→400 m) : commentaires SAM + primes identiques.

## 6. Dangers et faune

- **Chaleur** : au-delà de la profondeur sûre du refroidissement, dégâts de
  coque croissants (×1.7 en surrégime en forage, ×0.5 avec Blindage thermique).
  HUD : jauge de température + zone rouge visible en profondeur.
- **Lave, gaz, chutes** : dégâts identiques (chute > 13 m/s d'impact).
- **Météorites nocturnes** : impact en surface, débris (3-6 titane + 4-7 fer),
  disparition après 120 s.
- **Tempêtes de sable** : brume + vent en surface, panneaux aveuglés.
- **Faune** (stats de `creatures.js`) : **Rampant** (22 PV, contact), 
  **Traqueur** (34 PV, rapide, ≥120 m), **Cracheur** (18 PV, projectiles,
  ≥150 m). Écrasables avec la foreuse lancée (dégâts ∝ vitesse), repoussés par
  le Répulseur sonique. Butin : biogel (1/2/2) → bio-carburant ×3.
  En 3D : déplacement volumétrique dans les galeries, évitement des parois.
- **Nids** (2 par monde) : chambres profondes, pondent en continu à proximité,
  130 PV, détruits en fonçant dedans → 14-19 biogel + 2 cristaux.
- Les créatures ne montent jamais à moins de 6 m de la surface.

## 7. Coop 2-4 joueurs — même architecture que l'original

- **Serveur autoritatif** : il exécute la même `GameSim` que le solo (terrain,
  stock, bâtiments, robots, énergie, fusée, quêtes, faune, événements).
- **Clients** : prédisent leur avatar (18 Hz), envoient des **intentions**
  (`dig`, `build`, `demolish`, `upgrade`, `research`, `deposit`, `contribute`,
  `harvest`, `robot*`, `launch`…), reçoivent deltas de voxels, état « base »,
  positions des autres, faune, événements, `resync` à l'Acte II.
- **Salles** : code (A-Z0-9, 12 max), mot de passe optionnel, 4 joueurs max,
  persistance disque, liste publique `/api/rooms`.
- Chaque joueur a **ses** améliorations de foreuse/jetpack et sa combinaison
  (couleurs du vestiaire), le reste est partagé.
- Le **solo reste 100 % hors-ligne** : la même `GameSim` tourne en local dans
  le client, les intentions passent par la même interface.

## 8. Interface

- **HUD** : O2, jetpack, batterie, coque, soute (+ contenu), profondeur,
  chaleur, énergie base (prod/demande/accus), objectif courant, messages SAM,
  toasts, boussole/indicateur de la base.
- **Menus** : titre (Solo — 3 difficultés, Coop — carnet de serveurs + salles
  publiques + code/mot de passe, Options, Exploits), pause, gestionnaire de
  sauvegardes (slots, export/import JSON), victoire.
- **Panneaux** : Construire, bâtiment (recette/pause/surcadence/démolir),
  Atelier (améliorations), Labo (recherche), Fusée (contribution/décollage),
  Stock (`I`), Aide (astuces de `G.TIPS`).
- **Options** : sensibilité souris, inversion Y, FOV, volume/musique, langue,
  qualité (distance de rendu), plein écran.
- **Difficultés** : Détendu / Normal / Survie (multiplicateurs `G.DIFFS`).
- **Exploits** : les 14 de `G.FEATS`, persistants, mappés plus tard sur les
  succès Steam (voir `docs/STEAM.md`).

## 9. Direction artistique

- Palette du jeu original : ambres/rouille pour la roche, teal `#7de0d8` pour
  l'UI et les visières, rose `#ff9de8` pour les cristaux, orange `#ff8c42`.
- Voxels texturés par atlas procédural (teintes des strates originales),
  minerais incrustés lumineux, lave émissive, ciel jour/nuit dynamique avec
  étoiles et deux lunes, brouillard souterrain, lampe frontale.
- Props 3D générés via MCP Higgsfield (foreuse, fusée, rampant, cristaux,
  robot) — voir `docs/ASSETS.md`. Astronaute et bâtiments : géométrie
  procédurale stylisée (recolorable pour le vestiaire coop).
- Audio 100 % WebAudio procédural (comme l'original) : nappe réactive
  profondeur/nuit/tempête, forage filtré, blips UI, boom, décollage.

## 10. Hors périmètre v0.1 (roadmap)

Intérieur de la fusée décorable (établi + vestiaire complet — le choix des
couleurs reste disponible dans les Options), contrôles manette, mobile/tactile,
console d'admin serveur, Steam Datagram Relay, succès Steam actifs (scaffold
prêt), macOS signé/notarié. Voir `docs/ROADMAP.md`.
