import express from 'express';
import { spawn } from 'child_process';

const app = express();
let clients = [];
let pythonProcess = null;

// SSE stream for Python logs
app.get('/logs', (req, res) => {
    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();
    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(c => c !== res);
    });
});

function broadcastLog(message) {
    for (const c of clients) {
        c.write(`data: ${message}\n\n`);
    }
}

// Function to start the Python app
function startPythonApp() {
    if (pythonProcess) pythonProcess.kill();

    broadcastLog('\n--- Starting Python App ---\n');

    pythonProcess = spawn('python3', ['/home/pi/Desktop/automation/main.py']);

    pythonProcess.stdout.on('data', (data) => {
        broadcastLog(data.toString());
    });

    pythonProcess.stderr.on('data', (data) => {
        broadcastLog('[ERR] ' + data.toString());
    });

    pythonProcess.on('close', (code) => {
        broadcastLog(`Python app exited with code ${code}`);
        // Optional: auto-restart on crash
        // setTimeout(startPythonApp, 3000);
    });
}

// Trigger manually via frontend
app.get('/trigger-app', (req, res) => {
    startPythonApp();
    res.send('Restart command sent.');
});

// Start everything
app.listen(3000, () => {
    console.log('Dashboard running at http://localhost:3000');
    startPythonApp();
});
