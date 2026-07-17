# Roadmap

## v0.1.0 — vertical slice (actuel) ✅

Toute la boucle du jeu original en 3D, vérifiée de bout en bout :
forage voxel (FPS/TPS), base automatisée complète, robots, recherche,
faune + nids, météo/météorites/séismes, fusée Acte I → crash → abysses →
Acte II → victoire, exploits, sauvegardes multi-slots + export, coop 2-4
autoritative persistante, FR/EN, Electron + scaffold Steamworks, CI, tests.

## v0.2 — « feel » (avant page Steam)

- [ ] Relief de surface (cratères, rochers) — la surface est plane comme en
      2D, la 3D mérite mieux
- [ ] Animations de la foreuse : rotation du foret, flammes des réacteurs,
      inclinaison en vol ; impacts de forage plus riches
- [ ] SFX localisés (panner 3D) + variations ; mix
- [ ] Mini-carte / boussole d'objectifs (fusée, base, dernier robot)
- [ ] Indicateurs du Géoscanner en surbrillance à travers la roche (le
      bâtiment existe, l'effet visuel est minimal)
- [ ] Tutoriel contextuel renforcé (fantômes d'aide à la 1ʳᵉ construction)
- [ ] Paramètres graphiques (ombres, particules, résolution interne)

## v0.3 — intérieur & manette

- [ ] Intérieur de la fusée : vestiaire + établi de décoration (parité 2D,
      décision n°14)
- [ ] Support manette (Steam Input) + Steam Deck verified checklist
- [ ] Photosensibilité/accessibilité (réduction du shake, FOV étendu)

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
