// app.js
const express = require('express');
const si = require('systeminformation');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL_MS = 2000; // 2 seconds

app.use(express.static(path.join(__dirname, 'public')));

// --- Helper: Fallback for CPU load if systeminformation fails ---
async function getCpuFallback() {
    try {
        const data = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
        const avg1 = parseFloat(data[0]);
        const cpuInfo = await si.cpu();
        const cores = cpuInfo.cores || 4;
        const currentLoad = (avg1 / cores) * 100;
        return { avgLoad1: avg1, currentLoad };
    } catch (err) {
        console.error('CPU Fallback Error:', err);
        return { avgLoad1: 0, currentLoad: 0 };
    }
}

// --- SSE endpoint ---
app.get('/events', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders();

    let closed = false;
    req.on('close', () => { closed = true; });

    res.write(': ok\n\n'); // Establish SSE stream

    const sendMetrics = async () => {
        if (closed) return;

        try {
            const [cpuLoad, mem, disk, temp, time] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize(),
                si.cpuTemperature(),
                si.time()
            ]);

            // If CPU load data missing, use fallback
            const cpuData = cpuLoad?.currentLoad > 0 ? {
                avgLoad1: cpuLoad.avgLoad ?? 0,
                currentLoad: cpuLoad.currentLoad ?? 0
            } : await getCpuFallback();

            const metrics = {
                timestamp: new Date().toISOString(),
                cpu: cpuData,
                memory: {
                    total: mem.total,
                    free: mem.available || mem.free,
                    used: mem.used,
                    usedPercent: Math.round((mem.used / mem.total) * 10000) / 100
                },
                disk: disk.map(d => ({
                    fs: d.fs,
                    mount: d.mount,
                    size: d.size,
                    used: d.used,
                    usePercent: d.use
                })),
                temperature: {
                    main: temp.main || null,
                    cores: temp.cores || []
                },
                time
            };

            res.write(`data: ${JSON.stringify(metrics)}\n\n`);
        } catch (err) {
            console.error('Metric error:', err);
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        }
    };

    // Send immediately and then periodically
    sendMetrics();
    const id = setInterval(() => {
        if (closed) {
            clearInterval(id);
            return;
        }
        sendMetrics();
    }, UPDATE_INTERVAL_MS);
});

// --- Simple health check ---
app.get('/health', (req, res) =>
    res.json({ ok: true, time: new Date().toISOString() })
);

app.listen(PORT, () => console.log(`pi-monitor running on port ${PORT}`));
