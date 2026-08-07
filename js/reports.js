import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = type === "error" ? "ri-error-warning-line" : "ri-check-line";
    toast.innerHTML = `<i class="${icon} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3500);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "faculty") {
            window.location.href = "index.html"; return;
        }
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

document.getElementById("generateReportBtn").addEventListener("click", async () => {
    const dept = document.getElementById("filterDept").value;
    const year = document.getElementById("filterYear").value;
    const section = document.getElementById("filterSection").value;
    const subjectFilter = document.getElementById("filterSubject").value.trim();

    const btn = document.getElementById("generateReportBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;"></span> Loading...';
    btn.disabled = true;

    try {
        // 1. Fetch matching students
        const usersSnap = await get(ref(db, "users"));
        const students = {}; // uid -> data
        if (usersSnap.exists()) {
            const data = usersSnap.val();
            for (let uid in data) {
                const u = data[uid];
                if (u.role === "student" && u.department === dept && u.year === year && u.section === section) {
                    students[uid] = u;
                }
            }
        }

        if (Object.keys(students).length === 0) {
            showToast("No students found for the selected class.", "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // 2. Fetch all attendance records
        const attSnap = await get(ref(db, "attendance"));
        
        // Build per-student tallies { uid: { present: 0, absent: 0 } }
        const tally = {};
        for (let uid in students) {
            tally[uid] = { present: 0, absent: 0 };
        }

        let totalClassDays = new Set(); // Track unique date+subject combos

        if (attSnap.exists()) {
            const attData = attSnap.val();
            for (let date in attData) {
                for (let sub in attData[date]) {
                    // Apply subject filter
                    if (subjectFilter && sub !== subjectFilter) continue;

                    const classKey = `${date}_${sub}`;
                    let classHasStudents = false;

                    for (let uid in students) {
                        if (attData[date][sub][uid]) {
                            classHasStudents = true;
                            if (attData[date][sub][uid].status === "present") {
                                tally[uid].present++;
                            } else {
                                tally[uid].absent++;
                            }
                        }
                    }
                    if (classHasStudents) totalClassDays.add(classKey);
                }
            }
        }

        const totalClasses = totalClassDays.size;

        // 3. Render summary cards
        document.getElementById("totalClasses").innerText = totalClasses;
        document.getElementById("totalStudentsInClass").innerText = Object.keys(students).length;
        
        let totalPct = 0;
        let belowThreshold = 0;
        
        // Sort students by roll no
        const studentArr = Object.entries(students)
            .map(([uid, data]) => ({ uid, ...data }))
            .sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        const tbody = document.getElementById("reportTableBody");
        tbody.innerHTML = "";

        studentArr.forEach(student => {
            const t = tally[student.uid];
            const total = t.present + t.absent;
            const pct = total === 0 ? 0 : Math.round((t.present / total) * 100);
            
            totalPct += pct;
            if (pct < 75) belowThreshold++;

            let statusBadge;
            if (pct >= 75) {
                statusBadge = `<span class="badge badge-success">Good</span>`;
            } else if (pct >= 60) {
                statusBadge = `<span class="badge badge-warning">Low</span>`;
            } else {
                statusBadge = `<span class="badge badge-danger">Critical</span>`;
            }

            const progressColor = pct >= 75 ? "success" : pct >= 60 ? "warning" : "danger";

            tbody.innerHTML += `
                <tr>
                    <td><strong>${student.rollNo || "N/A"}</strong></td>
                    <td>${student.name}</td>
                    <td style="color: var(--success-color); font-weight: 600;">${t.present}</td>
                    <td style="color: var(--danger-color); font-weight: 600;">${t.absent}</td>
                    <td>${total}</td>
                    <td>
                        <div class="flex items-center gap-2">
                            <div class="progress-bar-container" style="width: 80px;">
                                <div class="progress-bar ${progressColor}" style="width: ${pct}%;"></div>
                            </div>
                            <span style="font-weight: 600;">${pct}%</span>
                        </div>
                    </td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });

        const avgPct = studentArr.length > 0 ? Math.round(totalPct / studentArr.length) : 0;
        document.getElementById("avgAttendance").innerText = `${avgPct}%`;
        document.getElementById("belowThreshold").innerText = belowThreshold;

        // Show result sections, hide empty state
        document.getElementById("summaryStats").classList.remove("d-none");
        document.getElementById("reportTableCard").classList.remove("d-none");
        document.getElementById("emptyState").classList.add("d-none");

        showToast("Report generated successfully!", "success");

    } catch (e) {
        console.error(e);
        showToast("Error generating report.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
