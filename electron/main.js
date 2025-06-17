import { app, BrowserWindow } from 'electron';
import path from 'path';
import si from 'systeminformation';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import { promisify } from 'util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const isMac = process.platform === 'darwin';
const execAsync = promisify(exec);

let win;
let wss;

let lastMacDiskFetch = 0;
let cachedMacDiskStats = [];

async function getMacDisks() {
	const now = Date.now();
	if (now - lastMacDiskFetch < 10000 && cachedMacDiskStats.length > 0) {
		return cachedMacDiskStats;
	}

	const { stdout: dfOut } = await execAsync('df -kP'); // Note the -P flag
	const dfLines = dfOut.trim().split('\n').slice(1);
	const disks = [];

	for (const line of dfLines) {
		const match = line.match(/^(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+%)\s+(.+)$/);
		if (!match) continue;

		const [, fs, size, used, avail, percentStr, mount] = match;

		if (
			mount.startsWith('/System/Volumes') ||
			mount.startsWith('/dev') ||
			mount.startsWith('/private') ||
			mount === '/Volumes/Recovery' ||
			fs === 'devfs' ||
			fs.startsWith('map')
		) {
			continue;
		}

		const percent = parseInt(percentStr.replace('%', ''));

		disks.push({
			name: fs,
			mount,
			type: 'volume',
			size: parseInt(size) * 1024,
			used: parseInt(used) * 1024,
			available: parseInt(avail) * 1024,
			usePercent: isNaN(percent) ? 0 : percent,
		});
	}

	lastMacDiskFetch = now;
	cachedMacDiskStats = disks;
	console.log('✅ Disks:', disks);
	return disks;
}

function createWindow() {
	win = new BrowserWindow({
		width: 1200,
		height: 800,
		transparent: true,
		frame: isDev,
		backgroundColor: '#00000000',
		hasShadow: false,
		alwaysOnTop: true,
		focusable: false,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
		},
	});

	win.loadURL(
		isDev ? 'http://localhost:5173' : `file://${path.join(__dirname, '../dist/index.html')}`
	);

	win.setIgnoreMouseEvents(true, { forward: true });

	wss = new WebSocketServer({ port: 8123 });

	wss.on('connection', async (ws) => {
		console.log('Frontend connected via WebSocket');

		await si.currentLoad(); // warm up

		const interval = setInterval(async () => {
			try {
				const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);

				const avgCpu = Math.round(
					load.cpus.reduce((sum, core) => sum + core.load, 0) / load.cpus.length
				);

				let diskStats = [];

				if (isMac) {
					diskStats = await getMacDisks();
				} else {
					const fsInfo = await si.fsSize();
					diskStats = fsInfo.map((fs) => ({
						name: fs.fs,
						mount: fs.mount,
						type: fs.type || 'volume',
						size: fs.size,
						used: fs.used,
						available: fs.size - fs.used,
						usePercent: fs.use,
					}));
				}

				const primaryDisk = diskStats.reduce((a, b) => (a.size > b.size ? a : b), diskStats[0]);

				const memTotal = mem.total;
				const memFree = mem.available;
				const memUsed = memTotal - memFree;
				const memPercent = (memUsed / memTotal) * 100;

				const payload = {
					type: 'metrics',
					cpu: avgCpu,
					memory: {
						total: memTotal,
						used: memUsed,
						free: memFree,
						percent: parseFloat(memPercent.toFixed(2)),
					},
					disks: diskStats,
					primaryDisk,
				};

				ws.send(JSON.stringify(payload));
			} catch (e) {
				console.error('Failed to fetch system metrics:', e);
			}
		}, 1000);

		ws.on('close', () => clearInterval(interval));
	});
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
