/* ASTRO·FORAGE 3D — processus principal Electron (build Steam).
 * - Fenêtre unique, chargement du client construit (client/dist)
 * - Steamworks optionnel (steam.cjs) : succès, présence
 * - « Héberger (LAN) » : serveur coop lancé en utilityProcess (dist/server.cjs)
 */
"use strict";
const { app, BrowserWindow, Menu, ipcMain, shell, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { initSteam, unlockAchievement } = require("./steam.cjs");

let win = null;
let steam = null;
let serverProc = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function clientIndex() {
  if (app.isPackaged) return path.join(process.resourcesPath, "app-client", "index.html");
  return path.join(__dirname, "..", "..", "client", "dist", "index.html");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0b0e14",
    title: "ASTRO·FORAGE 3D",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);

  const index = clientIndex();
  if (!fs.existsSync(index)) {
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(
      "<body style='background:#0b0e14;color:#7de0d8;font-family:sans-serif;display:grid;place-items:center;height:100vh'>" +
      "<div><h2>Client non construit</h2><p>Lancez <code>npm run build</code> à la racine du repo puis relancez.</p></div></body>"));
  } else {
    win.loadFile(index);
  }

  win.webContents.on("did-finish-load", () => {
    console.log("[app] client chargé :", index);
    /* témoin de démarrage pour les tests automatisés (AF3D_READY_FILE) */
    if (process.env.AF3D_READY_FILE) {
      try { fs.writeFileSync(process.env.AF3D_READY_FILE, index); } catch { /* témoin best-effort */ }
    }
  });
  win.webContents.on("render-process-gone", (_e, d) => console.error("[app] renderer down:", d.reason));
  /* liens externes -> navigateur système */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
  win.on("closed", () => { win = null; });
}

/* ---- IPC exposée au jeu (preload) ---- */
ipcMain.handle("af3d:quit", () => app.quit());
ipcMain.handle("af3d:steam-unlock", (_e, featId) => unlockAchievement(steam, featId));
ipcMain.handle("af3d:is-steam", () => !!steam);
ipcMain.handle("af3d:host-server", () => {
  if (serverProc) return { ok: true, already: true };
  const serverJs = app.isPackaged
    ? path.join(process.resourcesPath, "server", "server.cjs")
    : path.join(__dirname, "..", "dist", "server.cjs");
  if (!fs.existsSync(serverJs)) return { ok: false, error: "server.cjs introuvable — lancez npm run bundle-server" };
  try {
    serverProc = utilityProcess.fork(serverJs, [], {
      env: {
        ...process.env,
        PORT: "8080",
        AF3D_DATA: path.join(app.getPath("userData"), "rooms")   // dossier inscriptible
      }
    });
    serverProc.on("exit", () => { serverProc = null; });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});
ipcMain.handle("af3d:stop-server", () => {
  if (serverProc) { try { serverProc.kill(); } catch { /* déjà mort */ } serverProc = null; }
  return { ok: true };
});

app.whenReady().then(() => {
  steam = initSteam();
  if (steam) console.log("[steam] Steamworks initialisé");
  else console.log("[steam] hors Steam — succès désactivés (mode normal en dev)");
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => {
  if (serverProc) { try { serverProc.kill(); } catch { /* rien */ } }
  app.quit();
});
