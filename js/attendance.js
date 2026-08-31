import { db } from "./firebase-config.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { 
    initLayout, 
    showToast, 
    showConfirm, 
    currentUser, 
    getFilteredSubjects, 
    populateSelectOptions, 
    sendNotification 
} from "./common.js";

let loadedStudents = [];
let currentAttendanceState = {}; // studentUid -> "present" | "absent"

document.addEventListener("DOMContentLoaded", async () => {
    await initLayout("faculty");

    // Default to today's date
    const dateInput = document.getElementById("attDate");
    if (dateInput) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    // Dynamic subjects update on dept/year change
    const deptSelect = document.getElementById("attDept");
    const yearSelect = document.getElementById("attYear");
    const subjSelect = document.getElementById("attSubject");

    const updateSubjects = () => {
        const d = deptSelect.value;
        const y = yearSelect.value;
        const subjs = getFilteredSubjects(d, y);
        populateSelectOptions(subjSelect, subjs, "name", "Select Subject");
    };

    if (deptSelect) deptSelect.addEventListener("change", updateSubjects);
    if (yearSelect) yearSelect.addEventListener("change", updateSubjects);

    // Load Attendance List
    document.getElementById("loadAttendanceBtn").addEventListener("click", loadClassStudents);

    // Batch Actions
    document.getElementById("markAllPresentBtn").addEventListener("click", () => {
        setAllStatus("present");
    });
    document.getElementById("markAllAbsentBtn").addEventListener("click", () => {
        setAllStatus("absent");
    });

    // Save Attendance
    document.getElementById("saveAttendanceBtn").addEventListener("click", saveAttendance);

    // Delete Attendance
    document.getElementById("deleteAttendanceBtn").addEventListener("click", deleteAttendanceSession);
});

async function loadClassStudents() {
    const dept = document.getElementById("attDept").value;
    const year = document.getElementById("attYear").value;
    const sec = document.getElementById("attSection").value;
    const subj = document.getElementById("attSubject").value;
    const date = document.getElementById("attDate").value;

    if (!dept || !year || !sec || !subj || !date) {
        showToast("Please select Department, Year, Section, Subject and Date.", "warning");
        return;
    }

    const tableBody = document.getElementById("attendanceTableBody");
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted"><span class="loader"></span> Loading class students...</td></tr>`;

    try {
        // 1. Fetch Students
        const usersSnap = await get(ref(db, "users"));
        loadedStudents = [];
        currentAttendanceState = {};

        if (usersSnap.exists()) {
            const users = usersSnap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student" && u.department === dept && u.year === year && u.section === sec) {
                    loadedStudents.push({ uid, ...u });
                }
            });
        }

        loadedStudents.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        // 2. Fetch Existing Attendance for Date & Subject
        const attRefStr = `attendance/${date}/${subj}`;
        const attSnap = await get(ref(db, attRefStr));
        if (attSnap.exists()) {
            const savedAtt = attSnap.val();
            loadedStudents.forEach(s => {
                if (savedAtt[s.uid]) {
                    currentAttendanceState[s.uid] = savedAtt[s.uid].status || "present";
                } else {
                    currentAttendanceState[s.uid] = "present";
                }
            });
        } else {
            // Default all to present
            loadedStudents.forEach(s => {
                currentAttendanceState[s.uid] = "present";
            });
        }

        renderAttendanceTable();
    } catch (err) {
        console.error("Error loading class students:", err);
        showToast("Failed to load students for class.", "error");
    }
}

function renderAttendanceTable() {
    const tableBody = document.getElementById("attendanceTableBody");
    const countEl = document.getElementById("attStudentCount");
    const summaryEl = document.getElementById("attClassSummary");

    const dept = document.getElementById("attDept").value;
    const year = document.getElementById("attYear").value;
    const sec = document.getElementById("attSection").value;
    const subj = document.getElementById("attSubject").value;
    const date = document.getElementById("attDate").value;

    if (countEl) countEl.innerText = loadedStudents.length;
    if (summaryEl) summaryEl.innerText = `${dept} | ${year} - ${sec} | Subject: ${subj} | Date: ${date}`;

    tableBody.innerHTML = "";

    if (loadedStudents.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No students found matching ${dept} - ${year} (${sec}). Please add students in Student Directory.</td></tr>`;
        return;
    }

    loadedStudents.forEach(s => {
        const isPresent = (currentAttendanceState[s.uid] || "present") === "present";
        tableBody.innerHTML += `
            <tr>
                <td><strong>${s.rollNo || 'N/A'}</strong></td>
                <td>${s.name}</td>
                <td>${s.email}</td>
                <td id="statusBadge_${s.uid}">
                    ${isPresent ? '<span class="badge badge-success">PRESENT</span>' : '<span class="badge badge-danger">ABSENT</span>'}
                </td>
                <td style="text-align: right;">
                    <button onclick="window.toggleAttendance('${s.uid}')" class="btn ${isPresent ? 'btn-secondary' : 'btn-primary'}" id="toggleBtn_${s.uid}">
                        <i class="${isPresent ? 'ri-close-line text-danger' : 'ri-check-line text-success'}"></i> Mark ${isPresent ? 'Absent' : 'Present'}
                    </button>
                </td>
            </tr>
        `;
    });
}

window.toggleAttendance = function(uid) {
    const current = currentAttendanceState[uid] || "present";
    const next = current === "present" ? "absent" : "present";
    currentAttendanceState[uid] = next;

    const badgeCell = document.getElementById(`statusBadge_${uid}`);
    const toggleBtn = document.getElementById(`toggleBtn_${uid}`);

    if (badgeCell) {
        badgeCell.innerHTML = next === "present" ? '<span class="badge badge-success">PRESENT</span>' : '<span class="badge badge-danger">ABSENT</span>';
    }
    if (toggleBtn) {
        toggleBtn.className = `btn ${next === "present" ? 'btn-secondary' : 'btn-primary'}`;
        toggleBtn.innerHTML = `<i class="${next === "present" ? 'ri-close-line text-danger' : 'ri-check-line text-success'}"></i> Mark ${next === "present" ? 'Absent' : 'Present'}`;
    }
};

function setAllStatus(status) {
    loadedStudents.forEach(s => {
        currentAttendanceState[s.uid] = status;
    });
    renderAttendanceTable();
    showToast(`Marked all students as ${status.toUpperCase()}.`, "info");
}

async function saveAttendance() {
    const subj = document.getElementById("attSubject").value;
    const date = document.getElementById("attDate").value;

    if (!subj || !date || loadedStudents.length === 0) {
        showToast("No active class loaded to save.", "warning");
        return;
    }

    const saveBtn = document.getElementById("saveAttendanceBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loader"></span> Saving...';
    saveBtn.disabled = true;

    try {
        const payload = {};
        loadedStudents.forEach(s => {
            payload[s.uid] = {
                status: currentAttendanceState[s.uid] || "present",
                markedBy: currentUser ? currentUser.uid : "faculty",
                timestamp: new Date().getTime()
            };

            // Send notification to student
            sendNotification(
                s.uid,
                "Attendance Update",
                `Your attendance for ${subj} on ${date} was marked as ${(currentAttendanceState[s.uid] || 'present').toUpperCase()}.`,
                "attendance"
            );
        });

        await set(ref(db, `attendance/${date}/${subj}`), payload);
        showToast(`Attendance saved successfully for ${date}.`, "success");
    } catch (err) {
        console.error("Save attendance error:", err);
        showToast("Failed to save attendance.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteAttendanceSession() {
    const subj = document.getElementById("attSubject").value;
    const date = document.getElementById("attDate").value;

    if (!subj || !date) {
        showToast("Select class and date to delete session.", "warning");
        return;
    }

    const confirmed = await showConfirm(`Are you sure you want to delete attendance record for subject "${subj}" on ${date}?`, `Delete Attendance Session`);
    if (confirmed) {
        try {
            await remove(ref(db, `attendance/${date}/${subj}`));
            showToast("Attendance session deleted.", "success");
            currentAttendanceState = {};
            await loadClassStudents();
        } catch (err) {
            console.error("Delete attendance error:", err);
            showToast("Failed to delete attendance session.", "error");
        }
    }
}