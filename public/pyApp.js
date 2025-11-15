document.addEventListener("DOMContentLoaded", () => {
    loadTodayCSV();
});

async function loadTodayCSV() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");

    const fileName = `${yyyy}-${mm}-${dd}.csv`;

    console.log("Loading hourly file:", fileName);

    try {
        const response = await fetch(`/logs/${fileName}`);
        if (!response.ok) {
            console.warn("No CSV found:", fileName);
            return;
        }
        const csvText = await response.text();
        parseAndApplyCSV(csvText);

    } catch (error) {
        console.error("Error:", error);
    }
}

function parseAndApplyCSV(csvText) {
    const lines = csvText.trim().split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Format: "12:02, 72"
        const [timeRaw] = trimmed.split(",");
        if (!timeRaw) continue;

        let [hh, mm] = timeRaw.split(":").map(x => x.trim());
        hh = parseInt(hh, 10);

        if (isNaN(hh)) {
            console.warn("Invalid hour:", timeRaw);
            continue;
        }

        // --- FIXED NOON LOGIC ---
        let period = "am";
        let hour12 = hh;

        if (hh === 0) {
            hour12 = 12;       // 00 → 12 AM
            period = "am";
        } else if (hh === 12) {
            hour12 = 12;       // 12 → 12 PM
            period = "pm";
        } else if (hh > 12) {
            hour12 = hh - 12;  // 13–23 → 1–11 PM
            period = "pm";
        }
        // else (1–11) stays AM naturally

        const checkboxId = `${period}-${hour12}`;

        const checkbox = document.querySelector(
            `.hour-checkbox[data-id="${checkboxId}"]`
        );

        if (checkbox) {
            checkbox.checked = true;
        }
    }
}
