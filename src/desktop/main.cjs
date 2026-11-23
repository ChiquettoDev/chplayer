/**
 * CHPLAYER — CÓPIA COMENTADA PARA ESTUDO
 * Processo principal Electron de Windows/Linux. Abre a janela, serve os arquivos locais e valida chamadas IPC vindas de preload.cjs.
 * Fluxo e dependências: docs/architecture.md.
 * Comentários desta cópia não alteram a versão publicada.
 */
const { app, BrowserWindow, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');

protocol.registerSchemesAsPrivileged([{ scheme: 'chplayer-app', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }]);
let mainWindow;

app.whenReady().then(() => {
  const files = new Set(['index.html', 'chplayer.js', 'player.js', 'appinfo.json', 'fetch-bridge.js', 'desktop.js', 'desktop.css', 'updates.js', 'catalog-corrections.js']);
  protocol.handle('chplayer-app', (request) => {
    const pathname = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '');
    if (!files.has(pathname) && !/^(?:img|icons|fonts)\/[a-zA-Z0-9_.-]+$/.test(pathname)) {
      return new Response('', { status: 404 });
    }
    return net.fetch(require('node:url').pathToFileURL(path.join(__dirname, 'web', pathname)).href);
  });
  ipcMain.handle('chplayer-fetch', async (event, input) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) {
      throw new Error('Origem inválida.');
    }
    const url = new URL(input.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Endereço inválido.');
    if (!['GET', 'POST'].includes(input.method)) throw new Error('Método inválido.');
    if (input.method === 'POST' && url.origin !== 'https://PROJECT_ID.supabase.co') {
      throw new Error('Destino inválido.');
    }
    if (input.body && input.body.length > 8192) throw new Error('Pedido muito grande.');
    const response = await net.fetch(url.href, {
      method: input.method, headers: input.headers, body: input.body,
      signal: AbortSignal.timeout(20000),
    });
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 32 * 1024 * 1024) { await reader.cancel(); throw new Error('Resposta muito grande.'); }
      chunks.push(Buffer.from(part.value));
    }
    return { status: response.status, body: Buffer.concat(chunks).toString('utf8'),
      headers: [...response.headers], url: response.url };
  });
  mainWindow = new BrowserWindow({
    width: 1280, height: 760, minWidth: 960, minHeight: 600,
    title: 'CHPlayer', backgroundColor: '#0a0a0f', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false },
  });
  ipcMain.handle('chplayer-fullscreen', (event) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) throw new Error('Origem inválida.');
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  ipcMain.handle('chplayer-platform', (event) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) throw new Error('Origem inválida.');
    return process.platform === 'win32' ? 'windows' : 'linux';
  });
  ipcMain.handle('chplayer-version', (event) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) throw new Error('Origem inválida.');
    return require('./package.json').version;
  });
  ipcMain.handle('chplayer-update-page', (event) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) throw new Error('Origem inválida.');
    return shell.openExternal('https://chplayer.example.com/atualizar.html?platform=' + (process.platform === 'win32' ? 'windows' : 'linux'));
  });
  ipcMain.handle('chplayer-official-catalog', (event, url) => {
    if (event.sender !== mainWindow.webContents || !event.senderFrame.url.startsWith('chplayer-app://app/')) throw new Error('Origem inválida.');
    if (!['https://pluto.tv/br/', 'https://www.itauculturalplay.com.br/'].includes(url)) throw new Error('Catálogo inválido.');
    return shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('chplayer-app://app/')) event.preventDefault();
  });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      event.preventDefault(); mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      event.preventDefault(); mainWindow.setFullScreen(false);
    }
  });
  mainWindow.loadURL('chplayer-app://app/index.html');
});
app.on('window-all-closed', () => app.quit());
