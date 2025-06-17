import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

function createWindow() {
	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		transparent: true,
		frame: isDev, // removes OS window chrome (title bar, borders)
		backgroundColor: '#00000000',
		hasShadow: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	win.loadURL(
		isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`
	);
}

app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
