import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let studentUid = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "student") {
            window.location.href = "index.html";
            return;
        }
        studentUid = user.uid;
        loadAttendance();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

async function loadAttendance() {
    try {
        const attSnap = await get(ref(db, `attendance`));
        if (!attSnap.exists()) {
            showEmpty();
            return;
        }

        const data = attSnap.val();
        let totalClasses = 0;
        let totalPresent = 0;
        const subjectsData = {}; // { subName: { present: 0, total: 0 } }
        const history = [];

        // Loop through dates
        for (let date in data) {
            // Loop through subjects
            for (let sub in data[date]) {
                if (data[date][sub][studentUid]) {
                    const status = data[date][sub][studentUid].status;
                    
                    // Add to totals
                    totalClasses++;
                    if (status === 'present') totalPresent++;

                    // Add to subject-wise
                    if (!subjectsData[sub]) subjectsData[sub] = { present: 0, total: 0 };
                    subjectsData[sub].total++;
                    if (status === 'present') subjectsData[sub].present++;

                    // Add to history
                    history.push({
                        date: date,
                        subject: sub,
                        status: status,
                        timestamp: data[date][sub][studentUid].timestamp || 0
                    });
                }
            }
        }

        if (totalClasses === 0) {
            showEmpty();
            return;
        }

        // Render Overall
        const overallPct = Math.round((totalPresent / totalClasses) * 100);
        document.getElementById("overallPct").innerText = `${overallPct}%`;
        
        // Render Subject Cards
        const subContainer = document.getElementById("subjectCardsContainer");
        subContainer.innerHTML = "";
        
        for (let sub in subjectsData) {
            const sd = subjectsData[sub];
            const pct = Math.round((sd.present / sd.total) * 100);
            
            let colorClass = "success";
            if (pct < 75) colorClass = "warning";
            if (pct < 60) colorClass = "danger";

            subContainer.innerHTML += `
                <div style="margin-bottom: 1.5rem;">
                    <div class="flex justify-between items-center mb-1">
                        <h4 style="margin: 0; font-size: 0.95rem;">${sub}</h4>
                        <span style="font-weight: 600; font-size: 0.9rem;">${sd.present} / ${sd.total} (${pct}%)</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${colorClass}" style="width: ${pct}%;"></div>
                    </div>
                </div>
            `;
        }

        // Render History (Sort by date descending)
        history.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const histBody = document.getElementById("historyTableBody");
        histBody.innerHTML = "";
        
        // Only show last 20 records
        const recentHistory = history.slice(0, 20);
        
        recentHistory.forEach(record => {
            const badgeClass = record.status === 'present' ? 'badge-success' : 'badge-danger';
            const badgeText = record.status === 'present' ? 'Present' : 'Absent';
            
            histBody.innerHTML += `
                <tr>
                    <td>${record.date}</td>
                    <td><strong>${record.subject}</strong></td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        document.getElementById("subjectCardsContainer").innerHTML = `<p class="text-danger">Error loading attendance.</p>`;
    }
}

function showEmpty() {
    document.getElementById("overallPct").innerText = "0%";
    document.getElementById("subjectCardsContainer").innerHTML = `<p class="text-muted">No attendance records found yet.</p>`;
    document.getElementById("historyTableBody").innerHTML = `<tr><td colspan="3" class="text-center text-muted">No records found.</td></tr>`;
}
