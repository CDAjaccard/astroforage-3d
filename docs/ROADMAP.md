# Roadmap

## v0.1.0 — vertical slice ✅

Toute la boucle du jeu original en 3D, vérifiée de bout en bout :
forage voxel (FPS/TPS), base automatisée complète, robots, recherche,
faune + nids, météo/météorites/séismes, fusée Acte I → crash → abysses →
Acte II → victoire, exploits, sauvegardes multi-slots + export, coop 2-4
autoritative persistante, FR/EN, Electron + scaffold Steamworks, CI, tests.

## v0.2.0 — parité de contenu 100 % ✅

- [x] **Intérieur de la fusée** : pièce 3D, sas, vestiaire, console, **établi
      de décoration** (les 8 objets de l'original, partagés en coop,
      persistés) — décision n°14 levée
- [x] Effet **Géoscanner** : filons en surbrillance à travers la roche autour
      de la foreuse (+ Optique de scan)
- [x] **Labo** : balises lumineuses sur tous les cristaux du monde
- [x] Boussole de retour (équivalent 3D de la mini-carte) : base depuis la
      foreuse, foreuse depuis l'astronaute
- [x] Bouton d'aide « Rapatrier à la base » (anti-blocage)
- [x] Cinématique d'intro du crash (fondu + impact)
- [x] Carnet de serveurs coop
- [x] Console d'administration serveur (ADMIN_TOKEN)
- [x] Particules de sable pendant les tempêtes

## v0.3 — « feel » (avant page Steam)

- [x] Relief de surface : ondulations + rochers épars (zone de base plate)
- [x] Animations de la foreuse : foret-vortex, flammes, inclinaison, hover
- [x] SFX localisés : pan stéréo par direction + variations de fréquence
- [x] Paramètres graphiques : résolution interne, densité de particules
- [x] Ombres dynamiques (option, défaut off, suivent le joueur)
- [x] Tutoriel contextuel : astuces une-fois (forage, placement, gestion, manette)
- [x] Support manette (Gamepad API / Steam Input) + checklist Steam Deck (docs/STEAM.md §7)
- [x] Accessibilité : secousses d'écran réglables (normales/réduites/off), FOV 60-110

**v0.3 complète** — reste avant la fiche Steam : actions côté compte Valve
(AppID réel, fiche, captures/trailer, passe de test sur Steam Deck réel).

## v0.4 — Steam release candidate

- [ ] AppID réel + succès créés (mapping prêt dans `desktop/src/steam.cjs`)
- [ ] Captures + trailer + library capsule 600×900
- [ ] Steam Cloud (Auto-Cloud)
- [ ] Beta fermée via branche Steam `beta`
- [ ] Localisation DE/ES (structure i18n prête)

## Plus tard

- [ ] Invitations Steam + Steam Datagram Relay (coop sans IP)
- [ ] Console d'admin serveur (parité avec l'original)
- [ ] macOS signé/notarisé
- [ ] Mode spectateur / caméra photo
- [ ] Un « vrai » Acte III ? (le Cœur de Kepler n'a pas dit son dernier mot)

## Dette technique connue

- Positions d'avatar client-autoritatives en coop (héritage assumé de
  l'original — OK entre amis, à durcir si serveurs publics)
- `AF3D_STEP`/`AF3D_SHOT` : hooks de test dev-only à transformer en suite
  de tests E2E scriptée (Playwright)
- Statuts machines : clés traduites côté client, quelques libellés composés
  (accus) à affiner
