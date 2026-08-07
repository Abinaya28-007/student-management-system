import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let studentUid = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "student") {
            window.location.href = "index.html"; return;
        }
        studentUid = user.uid;
        loadMarks();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

async function loadMarks() {
    try {
        const snap = await get(ref(db, "marks"));
        if (!snap.exists()) {
            showEmpty();
            return;
        }

        const data = snap.val();
        let totalPct = 0;
        let count = 0;
        
        const subjectStats = {}; // { subName: { obtained: 0, max: 0 } }
        const details = [];

        for (let id in data) {
            const rec = data[id];
            if (rec.studentId === studentUid) {
                const mk = Number(rec.mark);
                const mx = Number(rec.maxMark || 100);
                const pct = (mk / mx) * 100;
                
                totalPct += pct;
                count++;
                
                if(!subjectStats[rec.subject]) subjectStats[rec.subject] = { obtained: 0, max: 0 };
                subjectStats[rec.subject].obtained += mk;
                subjectStats[rec.subject].max += mx;
                
                details.push(rec);
            }
        }

        if (count === 0) {
            showEmpty();
            return;
        }

        // Render Overall
        document.getElementById("overallAvg").innerText = `${Math.round(totalPct / count)}%`;
        
        // Render Subject Summary
        const subContainer = document.getElementById("subjectMarksContainer");
        subContainer.innerHTML = "";
        
        for (let sub in subjectStats) {
            const s = subjectStats[sub];
            const p = Math.round((s.obtained / s.max) * 100);
            
            let colorClass = "success";
            if (p < 75) colorClass = "warning";
            if (p < 50) colorClass = "danger";

            subContainer.innerHTML += `
                <div style="margin-bottom: 1.5rem;">
                    <div class="flex justify-between items-center mb-1">
                        <h4 style="margin: 0; font-size: 0.95rem;">${sub}</h4>
                        <span style="font-weight: 600; font-size: 0.9rem;">${s.obtained} / ${s.max} (${p}%)</span>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar ${colorClass}" style="width: ${p}%;"></div>
                    </div>
                </div>
            `;
        }

        // Render Details
        const tbody = document.getElementById("marksTableBody");
        tbody.innerHTML = "";
        
        // Sort by timestamp desc
        details.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0));
        
        details.forEach(d => {
            const pct = Math.round((Number(d.mark) / Number(d.maxMark || 100)) * 100);
            tbody.innerHTML += `
                <tr>
                    <td><strong>${d.subject}</strong></td>
                    <td>${d.exam}</td>
                    <td><span style="font-weight:600; color:var(--primary-color)">${d.mark}</span> / ${d.maxMark || 100}</td>
                    <td><span class="badge ${pct >= 50 ? 'badge-success' : 'badge-danger'}">${pct}%</span></td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        document.getElementById("subjectMarksContainer").innerHTML = `<p class="text-danger">Error loading marks.</p>`;
    }
}

function showEmpty() {
    document.getElementById("overallAvg").innerText = "N/A";
    document.getElementById("subjectMarksContainer").innerHTML = `<p class="text-muted">No marks recorded yet.</p>`;
    document.getElementById("marksTableBody").innerHTML = `<tr><td colspan="4" class="text-center text-muted">No records found.</td></tr>`;
}
