/* Pont sécurisé jeu <-> Electron (contextIsolation). */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("af3d", {
  quit: () => ipcRenderer.invoke("af3d:quit"),
  steamUnlock: (featId) => ipcRenderer.invoke("af3d:steam-unlock", featId),
  isSteam: () => ipcRenderer.invoke("af3d:is-steam"),
  hostServer: () => ipcRenderer.invoke("af3d:host-server"),
  stopServer: () => ipcRenderer.invoke("af3d:stop-server")
});
