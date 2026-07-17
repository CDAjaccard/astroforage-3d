/* Intégration Steamworks (optionnelle) via steamworks.js.
 * En dev : appid 480 (Spacewar). Pour la release : remplacer STEAM_APPID par
 * l'appid attribué par Valve (et dans steam_appid.txt). Voir docs/STEAM.md. */
"use strict";

const STEAM_APPID = 480; // TODO release : appid réel ASTRO·FORAGE 3D

/** Mapping exploit du jeu -> API name du succès Steam (à créer dans Steamworks). */
const ACH = {
  premier: "ACH_FIRST_ORE",
  prof50: "ACH_DEPTH_50",
  prof150: "ACH_DEPTH_150",
  prof250: "ACH_DEPTH_250",
  cristaux: "ACH_CRYSTALS_5",
  usine: "ACH_SIX_BUILDINGS",
  automate: "ACH_THREE_ROBOTS",
  armada: "ACH_SIX_ROBOTS",
  chasseur: "ACH_TEN_KILLS",
  brisenid: "ACH_NEST_BREAKER",
  plancher: "ACH_OVERDRIVE_60",
  coeur: "ACH_HEART_OF_KEPLER",
  retour: "ACH_HOMECOMING",
  parfaite: "ACH_FLAWLESS"
};

function initSteam() {
  try {
    // eslint-disable-next-line global-require
    const steamworks = require("steamworks.js");
    return steamworks.init(STEAM_APPID);
  } catch {
    return null; // hors Steam / module absent : le jeu fonctionne normalement
  }
}

function unlockAchievement(client, featId) {
  if (!client) return false;
  const api = ACH[featId];
  if (!api) return false;
  try {
    client.achievement.activate(api);
    return true;
  } catch {
    return false;
  }
}

module.exports = { initSteam, unlockAchievement, ACH, STEAM_APPID };
