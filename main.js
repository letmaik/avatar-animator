const { app, shell, BrowserWindow, ipcMain } = require('electron')
const virtualcam = require('node-virtualcam')

const ratio = 9/16;
const windowWidth = 960;
const windowHeight = ratio * windowWidth;

const fps = 30
const delay = 0

let lastReceivedFrame = null;
let isQuitting = false;

function createWindow () {
    let mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true,
        // TODO not working, see https://github.com/electron/electron/issues/9567
        backgroundThrottling: false
      }
    })

    // https://github.com/electron/electron/issues/1344#issuecomment-392844066
    mainWindow.webContents.on('new-window', function(event, url){
      if (url.endsWith('editor.html'))
        return
      event.preventDefault();
      shell.openExternal(url);
    });
  
    mainWindow.loadFile('dist/camera.html')

    let width = 0
    let height = 0  
    let frameIdx = 0;  

    ipcMain.on('frame', (event, arg) => {
      lastReceivedFrame = arg.data;
      if (width === 0) {
        width = arg.width
        height = arg.height
        virtualcam.start(width, height, fps, delay)
        console.log(`virtual cam output started (${width}x${height} @ ${fps}fps)`);
        var timerId = setInterval(() => {
          if (isQuitting) {
            clearInterval(timerId)
          }
          virtualcam.send(frameIdx, lastReceivedFrame);
          frameIdx += 1;
        }, 1/fps * 1000);
      }
      if (width != arg.width || height != arg.height) {
        throw Error(`received frame with mismatching size: ${arg.width}x${arg.height}`)
      }
    })

    ipcMain.on('openEditor', (event, arg) => {
      const avatar = arg;
      let editorWindow = new BrowserWindow({
        width: windowWidth,
        height: windowHeight,
        x: mainWindow.getPosition()[0] + 50,
        y: mainWindow.getPosition()[1] + 50,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: true
        }
      })
      editorWindow.webContents.on('did-finish-load', () => {
        editorWindow.webContents.send('avatar', avatar);
      });
      editorWindow.loadFile('dist/editor.html')
    })

    // forward avatar from editor to main window
    ipcMain.on('avatar', (event, arg) => {
      mainWindow.webContents.send('avatar', arg)
    })
}
  
app.whenReady().then(createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit()
    }
})

app.on('will-quit', () => {
  isQuitting = true
  virtualcam.stop()
  console.log('virtual cam output stopped')
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
})



