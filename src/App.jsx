import { useEffect, useState } from 'react';

function App() {
	const [cpu, setCpu] = useState(0);
	const [ramPercent, setRamPercent] = useState(0);
	const [ramText, setRamText] = useState('');
	const [disks, setDisks] = useState([]);

	useEffect(() => {
		const ws = new WebSocket('ws://localhost:8123');

		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);

				if (data.type === 'metrics') {
					if (data.cpu !== undefined) setCpu(data.cpu);

					if (data.memory) {
						const gb = (bytes) => (bytes / 1073741824).toFixed(1);
						setRamPercent(data.memory.percent);
						setRamText(`${gb(data.memory.used)} / ${gb(data.memory.total)} GB`);
					}

					if (data.disks) {
						setDisks(data.disks);
					}
				}
			} catch (error) {
				console.error('Invalid WebSocket data:', error);
			}
		};

		ws.onerror = (e) => {
			console.error('WebSocket error:', e);
		};

		return () => ws.close();
	}, []);

	const gb = (bytes) => (bytes / 1073741824).toFixed(1);

	return (
		<div className="p-4 text-white font-mono space-y-4">
			<h1 className="text-2xl">🧠 CPU Usage: {cpu}%</h1>
			<h1 className="text-2xl">💾 RAM Usage: {ramPercent}%</h1>
			<p className="text-sm text-gray-400">{ramText}</p>

			<h2 className="text-xl mt-4">🗃️ Disk Usage</h2>
			{disks.map((disk, idx) => (
				<div
					key={idx}
					className="mb-2">
					<p className="text-sm text-gray-300">
						{disk.mount} ({disk.name}) – {gb(disk.used)} / {gb(disk.size)} GB (
						{disk.usePercent.toFixed(1)}%)
					</p>
					<div className="w-full bg-gray-700 rounded h-2 overflow-hidden">
						<div
							className="bg-blue-500 h-2"
							style={{ width: `${disk.usePercent}%` }}></div>
					</div>
				</div>
			))}
		</div>
	);
}

export default App;
