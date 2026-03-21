"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  getTurns: () => electron.ipcRenderer.invoke("get-turns"),
  createTurn: () => electron.ipcRenderer.invoke("create-turn"),
  callTurn: (id) => electron.ipcRenderer.invoke("call-turn", id),
  completeTurn: (id) => electron.ipcRenderer.invoke("complete-turn", id),
  saveSetting: (key, value) => electron.ipcRenderer.invoke("save-setting", key, value),
  onUpdate: (callback) => {
    const subscription = (_, value) => callback();
    electron.ipcRenderer.on("db-update", subscription);
    return () => {
      electron.ipcRenderer.removeListener("db-update", subscription);
    };
  }
});
