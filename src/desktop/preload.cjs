/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Ponte Electron segura. Expõe apenas métodos selecionados em window.chplayerNative; o código da página não recebe acesso geral ao sistema.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('chplayerNative', {
  platform: () => ipcRenderer.invoke('chplayer-platform'),
  version: () => ipcRenderer.invoke('chplayer-version'),
  openUpdatePage: () => ipcRenderer.invoke('chplayer-update-page'),
  openOfficialCatalog: (url) => ipcRenderer.invoke('chplayer-official-catalog', url),
  fullscreen: () => ipcRenderer.invoke('chplayer-fullscreen'),
  fetch: (input) => ipcRenderer.invoke('chplayer-fetch', input),
});
