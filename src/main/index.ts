import { app, shell, dialog, BrowserWindow, nativeImage, protocol, net, Menu } from 'electron'
import { join, resolve, sep } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import os from 'node:os'
import { registerIpcHandlers } from './ipc'
import { getRootDir, initRootDir, setRootDir } from './projects'

/**
 * Ask the user for a project folder and keep asking until they choose or quit.
 * Returns the absolute path to use as the root dir, or null if the user quit.
 */
async function promptForRootDir(message: string): Promise<string | null> {
  while (true) {
    const result = await dialog.showOpenDialog({
      title: 'Choose where to store your projects',
      message,
      defaultPath: join(os.userInfo().homedir, 'Movies'),
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.filePaths.length > 0) return join(result.filePaths[0], 'Avatica')

    const { response } = await dialog.showMessageBox({
      type: 'warning',
      message: 'Avatica needs a folder to store projects. Would you like to choose one, or quit?',
      buttons: ['Choose Folder', 'Quit'],
      defaultId: 0,
    })
    if (response === 1) return null
  }
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Avatica',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 11 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: app.isPackaged,
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (/^https?:\/\//i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.setName('Avatica')

// Register custom protocols
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, supportFetchAPI: true, secure: true } },
  { scheme: 'project', privileges: { standard: true, supportFetchAPI: true, secure: true, stream: true } },
])

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.avatica')

  // Minimal menu — just the essentials
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Avatica',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(is.dev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Avatica',
          click: (): void => {
            BrowserWindow.getAllWindows()[0]?.webContents.send('show-about')
          }
        }
      ]
    }
  ]))

  // Resolve `sub` under `root` and confirm the result doesn't escape.
  // Uses `join` (not `resolve`) to concatenate so URL pathnames starting with `/`
  // don't get treated as absolute and discard `root`; then `resolve` normalizes any `..`.
  const safeJoin = (root: string, ...sub: string[]): string | null => {
    const base = resolve(root)
    const target = resolve(join(base, ...sub))
    return target === base || target.startsWith(base + sep) ? target : null
  }

  // Serve app:// URLs from the system apps directory
  protocol.handle('app', (request) => {
    const url = new URL(request.url)
    // app://fashion_studio/female/editorial.jpg
    const pathname = decodeURIComponent(url.pathname)
    const devRoot = join(__dirname, '../../src/renderer/src/apps/system')
    const prodRoot = join(process.resourcesPath, 'apps')
    const devPath = safeJoin(devRoot, url.hostname, pathname)
    const prodPath = safeJoin(prodRoot, url.hostname, pathname)
    const filePath = devPath && existsSync(devPath) ? devPath : (prodPath && existsSync(prodPath) ? prodPath : null)
    if (filePath) return net.fetch('file://' + filePath)
    return new Response('Not found', { status: 404 })
  })

  // Serve project:// URLs from the project directory
  protocol.handle('project', (request) => {
    const url = new URL(request.url)
    // project://my-project/image.jpg
    const filePath = safeJoin(getRootDir(), url.hostname, decodeURIComponent(url.pathname))
    if (filePath && existsSync(filePath)) return net.fetch('file://' + filePath)
    return new Response('Not found', { status: 404 })
  })

  // Set dock icon in dev mode
  if (is.dev && process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(join(__dirname, '../../resources/icon.png'))
    if (!icon.isEmpty()) app.dock?.setIcon(icon)
  }
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // Ensure we have a root dir the app can read/write. If the stored path
  // doesn't work (first MAS launch, TCC prompt denied, folder unplugged,
  // read-only disk), prompt the user to pick a new one.
  if (!initRootDir()) {
    const chosen = await promptForRootDir('Avatica needs a folder to store your projects.')
    if (!chosen) { app.quit(); return }
    setRootDir(chosen)
    if (!initRootDir()) {
      dialog.showErrorBox('Cannot access folder', `Avatica cannot write to:\n\n${chosen}\n\nPlease try a different location.`)
      app.quit()
      return
    }
  }

  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => app.quit())

// Handle .seq file opened from Finder/Explorer
let pendingOpenFile: string | null = null

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (filePath.endsWith('.seq')) {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      win.webContents.send('open-seq-file', filePath)
    } else {
      pendingOpenFile = filePath
    }
  }
})

// Single-instance lock — focus the existing window if a second instance is launched.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
}

// After window is created, check if there's a pending file to open
app.on('browser-window-created', (_event, win) => {
  if (pendingOpenFile) {
    const file = pendingOpenFile
    pendingOpenFile = null
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('open-seq-file', file)
    })
  }
})
