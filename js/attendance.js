import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let facultyUid = null;
let currentLoadedStudents = [];

// Basic Toast implementation
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = "ri-check-line";
    if (type === "error") icon = "ri-error-warning-line";
    toast.innerHTML = `<i class="${icon} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3000);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "faculty") {
            window.location.href = "index.html";
            return;
        }
        facultyUid = user.uid;
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// Load Students Logic
document.getElementById("loadStudentsBtn").addEventListener("click", async () => {
    const dept = document.getElementById("filterDept").value;
    const year = document.getElementById("filterYear").value;
    const section = document.getElementById("filterSection").value;
    const subject = document.getElementById("filterSubject").value.trim();
    const date = document.getElementById("filterDate").value;

    if (!subject) {
        showToast("Please enter a subject code/name.", "error");
        return;
    }
    if (!date) {
        showToast("Please select a date.", "error");
        return;
    }

    const btn = document.getElementById("loadStudentsBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader" style="width: 16px; height: 16px; border-width: 2px;"></span>';
    btn.disabled = true;

    try {
        // 1. Fetch Students
        const studentsSnap = await get(ref(db, "users"));
        currentLoadedStudents = [];
        
        if (studentsSnap.exists()) {
            const users = studentsSnap.val();
            for (let uid in users) {
                const u = users[uid];
                if (u.role === 'student' && u.department === dept && u.year === year && u.section === section) {
                    currentLoadedStudents.push({
                        uid: uid,
                        name: u.name,
                        rollNo: u.rollNo || 'N/A'
                    });
                }
            }
        }

        // Sort by Roll No
        currentLoadedStudents.sort((a, b) => a.rollNo.localeCompare(b.rollNo));

        if (currentLoadedStudents.length === 0) {
            document.getElementById("emptyState").classList.remove("d-none");
            document.getElementById("emptyState").innerHTML = `
                <div class="empty-state">
                    <i class="ri-user-unfollow-line empty-state-icon"></i>
                    <h3>No Students Found</h3>
                    <p>No students match the selected Department, Year, and Section.</p>
                </div>
            `;
            document.getElementById("attendanceSection").classList.add("d-none");
        } else {
            document.getElementById("emptyState").classList.add("d-none");
            document.getElementById("attendanceSection").classList.remove("d-none");
            
            // 2. Fetch Existing Attendance for this Date & Subject
            let existingAtt = {};
            const attSnap = await get(ref(db, `attendance/${date}/${subject}`));
            if (attSnap.exists()) {
                existingAtt = attSnap.val();
            }

            // 3. Render Table
            const tbody = document.getElementById("attendanceTableBody");
            tbody.innerHTML = "";
            
            currentLoadedStudents.forEach(student => {
                const existingStatus = existingAtt[student.uid] ? existingAtt[student.uid].status : 'present'; // Default present
                
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td><strong>${student.rollNo}</strong></td>
                    <td>${student.name}</td>
                    <td>
                        <select class="form-select att-status-select" data-uid="${student.uid}" style="max-width: 150px; padding: 0.3rem 0.5rem; ${existingStatus === 'absent' ? 'border-color: var(--danger-color); color: var(--danger-color);' : 'border-color: var(--success-color); color: var(--success-color);'}">
                            <option value="present" ${existingStatus === 'present' ? 'selected' : ''}>Present</option>
                            <option value="absent" ${existingStatus === 'absent' ? 'selected' : ''}>Absent</option>
                        </select>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            // Add event listeners to selects for color change and recount
            document.querySelectorAll('.att-status-select').forEach(sel => {
                sel.addEventListener('change', (e) => {
                    updateSelectColor(e.target);
                    updateCounts();
                });
            });

            updateCounts();
            if(Object.keys(existingAtt).length > 0) {
                showToast("Loaded existing attendance for this date.", "success");
            }
        }
    } catch (e) {
        console.error(e);
        showToast("Error loading data.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});

function updateSelectColor(selectEl) {
    if (selectEl.value === 'present') {
        selectEl.style.borderColor = 'var(--success-color)';
        selectEl.style.color = 'var(--success-color)';
    } else {
        selectEl.style.borderColor = 'var(--danger-color)';
        selectEl.style.color = 'var(--danger-color)';
    }
}

function updateCounts() {
    let p = 0; let a = 0;
    document.querySelectorAll('.att-status-select').forEach(sel => {
        if(sel.value === 'present') p++;
        else a++;
    });
    document.getElementById("countPresent").innerText = p;
    document.getElementById("countAbsent").innerText = a;
}

document.getElementById("markAllPresentBtn").addEventListener("click", () => {
    document.querySelectorAll('.att-status-select').forEach(sel => {
        sel.value = 'present';
        updateSelectColor(sel);
    });
    updateCounts();
});

document.getElementById("markAllAbsentBtn").addEventListener("click", () => {
    document.querySelectorAll('.att-status-select').forEach(sel => {
        sel.value = 'absent';
        updateSelectColor(sel);
    });
    updateCounts();
});

document.getElementById("saveAttendanceBtn").addEventListener("click", async () => {
    const subject = document.getElementById("filterSubject").value.trim();
    const date = document.getElementById("filterDate").value;

    const btn = document.getElementById("saveAttendanceBtn");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader" style="width: 16px; height: 16px; border-width: 2px;"></span> Saving...';
    btn.disabled = true;

    try {
        const selects = document.querySelectorAll('.att-status-select');
        const updates = {};
        
        selects.forEach(sel => {
            const uid = sel.getAttribute('data-uid');
            updates[uid] = {
                status: sel.value,
                markedBy: facultyUid,
                timestamp: new Date().getTime()
            };
        });

        // Save to Firebase under attendance/YYYY-MM-DD/Subject/
        await set(ref(db, `attendance/${date}/${subject}`), updates);
        
        showToast("Attendance saved successfully!", "success");
    } catch (e) {
        console.error(e);
        showToast("Failed to save attendance.", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});