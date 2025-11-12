// app.js
const express = require('express');
const si = require('systeminformation');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const UPDATE_INTERVAL_MS = 2000; // 2 seconds

app.use(express.static(path.join(__dirname, 'public')));

// SSE endpoint
app.get('/events', (req, res) => {
  // SSE headers
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  // send initial comment to establish stream
  res.write(': ok\n\n');

  const sendMetrics = async () => {
    if (closed) return;
    try {
      const [
        cpuLoad,           // load per core / overall
        mem,               // memory
        disk,              // fs size & use
        currentLoad,       // cpu %
        temp,              // temp sensors (maybe undefined on some devices)
        time               // time
      ] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.currentLoad(),  // systeminformation currentLoad gives detailed CPU %
        si.cpuTemperature(),
        si.time()
      ]);

      const metrics = {
        timestamp: new Date().toISOString(),
        cpu: {
          avgLoad1: cpuLoad.avgload,        // system load average
          currentLoad: Math.round(currentLoad.currentload * 100) / 100
        },
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
          usePercent: d.use   // percent
        })),
        temperature: {
          main: temp.main || null,
          cores: temp.cores || []
        },
        time
      };

      // SSE: send JSON as a message
      res.write(`data: ${JSON.stringify(metrics)}\n\n`);
    } catch (err) {
      // send error message via SSE (optional)
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }
  };

  // send immediately and then on interval
  sendMetrics();
  const id = setInterval(() => {
    if (closed) {
      clearInterval(id);
      return;
    }
    sendMetrics();
  }, UPDATE_INTERVAL_MS);
});

// simple health endpoint
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.listen(PORT, () => console.log(`pi-monitor running on port ${PORT}`));
