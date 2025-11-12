// ============================
// Chart.js Contexts
// ============================
const cpuCtx  = document.getElementById('cpuChart').getContext('2d');
const memCtx  = document.getElementById('memChart').getContext('2d');
const diskCtx = document.getElementById('diskChart').getContext('2d');
const tempCtx = document.getElementById('tempChart').getContext('2d');

// ============================
// Dark Mode Utilities
// ============================

// Check if dark mode is active
function isDarkMode() {
    return document.documentElement.classList.contains('dark');
}

// Lighten a hex color by a given percentage
function lightenColor(color, percent) {
    const num = parseInt(color.replace("#",""),16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt,
        G = (num >> 8 & 0x00FF) + amt,
        B = (num & 0x0000FF) + amt;

    return "#" + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
    ).toString(16).slice(1);
}

// Get chart colors depending on dark mode
function getColors(baseColor) {
    if (isDarkMode()) {
        return [lightenColor(baseColor, 40), '#374151']; // lighten main, darker gray for remaining
    } else {
        return [baseColor, '#e5e7eb']; // base + Tailwind gray-200
    }
}

// ============================
// Create Chart Dials
// ============================
function createDial(ctx, baseColor) {
    const colors = getColors(baseColor);
    return new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [0, 100],
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            cutout: '75%',
            rotation: -90,
            circumference: 180,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            responsive: false
        }
    });
}

// Initialize dials
let cpuDial  = createDial(cpuCtx, '#3b82f6');   // blue
let memDial  = createDial(memCtx, '#10b981');   // green
let diskDial = createDial(diskCtx, '#f59e0b');  // orange
let tempDial = createDial(tempCtx, '#ef4444');  // red

// Update chart colors on dark mode toggle
function updateChartColors() {
    cpuDial.data.datasets[0].backgroundColor  = getColors('#3b82f6');
    memDial.data.datasets[0].backgroundColor  = getColors('#10b981');
    diskDial.data.datasets[0].backgroundColor = getColors('#f59e0b');
    tempDial.data.datasets[0].backgroundColor = getColors('#ef4444');

    cpuDial.update('none');
    memDial.update('none');
    diskDial.update('none');
    tempDial.update('none');
}

// ============================
// SSE (Server-Sent Events) Connection
// ============================
const evtSrc = new EventSource('/events');

evtSrc.onmessage = (e) => {
    try {
        const m = JSON.parse(e.data);
        document.getElementById('raw').textContent = JSON.stringify(m, null, 2);

        const cpu  = m.cpu?.currentLoad ?? 0;
        const mem  = m.memory ? (m.memory.used / m.memory.total) * 100 : 0;
        const disk = m.disk && m.disk.length ? m.disk[0].usePercent : 0;
        const temp = m.temperature?.main ?? 0;

        // Update text metrics
        document.getElementById('cpuUsage').textContent  = cpu.toFixed(1) + '%';
        document.getElementById('cpuLoad').textContent   = `load: ${m.cpu?.avgLoad1?.toFixed(2) ?? '—'}`;
        document.getElementById('memUsage').textContent  = mem.toFixed(1) + '%';
        document.getElementById('memDetail').textContent = `${Math.round((m.memory?.used ?? 0)/1024/1024)} MB / ${Math.round((m.memory?.total ?? 1)/1024/1024)} MB`;
        document.getElementById('diskUsage').textContent = disk.toFixed(1) + '%';
        document.getElementById('diskDetail').textContent = `${((m.disk?.[0]?.used ?? 0)/1e9).toFixed(1)} GB / ${((m.disk?.[0]?.size ?? 1)/1e9).toFixed(1)} GB`;
        document.getElementById('tempMain').textContent = temp.toFixed(1) + '°C';
        document.getElementById('tempDetail').textContent = m.temperature?.cores?.length ? `cores: ${m.temperature.cores.join(', ')}` : '';

        // Update chart dials
        cpuDial.data.datasets[0].data  = [cpu, 100 - cpu];
        memDial.data.datasets[0].data  = [mem, 100 - mem];
        diskDial.data.datasets[0].data = [disk, 100 - disk];
        tempDial.data.datasets[0].data = [temp, 100 - temp];

        cpuDial.update('none');
        memDial.update('none');
        diskDial.update('none');
        tempDial.update('none');

    } catch(err) {
        console.error(err);
    }
};

// ============================
// Raw Metrics Toggle
// ============================
const toggleBtn    = document.getElementById('toggleRawBtn');
const rawContainer = document.getElementById('rawContainer');

toggleBtn.addEventListener('click', () => {
    if (rawContainer.classList.contains('max-h-0')) {
        rawContainer.classList.remove('max-h-0');
        rawContainer.classList.add('max-h-96');
        toggleBtn.textContent = 'Hide Raw Metrics';
    } else {
        rawContainer.classList.add('max-h-0');
        rawContainer.classList.remove('max-h-96');
        toggleBtn.textContent = 'Show Raw Metrics';
    }
});

// ============================
// Dark Mode Toggle
// ============================
const darkToggle = document.getElementById('darkModeToggle');

darkToggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    updateChartColors();
});