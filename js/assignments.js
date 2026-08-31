import { db } from "./firebase-config.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { 
    initLayout, 
    showToast, 
    showConfirm, 
    currentUser, 
    sendNotification, 
    masterDataCache 
} from "./common.js";

let assignmentsMap = {};

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    renderSidebarNav(userData.role);

    const isFaculty = userData.role === "faculty";
    const addBtnWrapper = document.getElementById("facultyAddAssignBtnWrapper");
    if (!isFaculty && addBtnWrapper) {
        addBtnWrapper.style.display = "none";
    }

    await loadAssignments(user.uid, userData);

    // Filters & Search
    document.getElementById("searchAssignment").addEventListener("input", filterAssignments);
    document.getElementById("filterSubject").addEventListener("change", filterAssignments);
    document.getElementById("filterDept").addEventListener("change", filterAssignments);

    // Modal Events
    const modal = document.getElementById("assignmentModal");
    const addBtn = document.getElementById("addAssignmentBtn");
    const closeBtns = [document.getElementById("closeAssignModal"), document.getElementById("cancelAssignModal")];

    if (addBtn && isFaculty) {
        addBtn.addEventListener("click", () => openAssignmentModal());
    }

    closeBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => modal.classList.remove("active"));
    });

    // Save Assignment Event
    const saveBtn = document.getElementById("saveAssignBtn");
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const id = document.getElementById("assignId").value;
            const title = document.getElementById("assignTitle").value.trim();
            const subject = document.getElementById("assignSubject").value;
            const maxMarks = Number(document.getElementById("assignMaxMarks").value || 10);
            const department = document.getElementById("assignDept").value;
            const year = document.getElementById("assignYear").value;
            const section = document.getElementById("assignSection").value;
            const assignedDate = document.getElementById("assignAssignedDate").value;
            const dueDate = document.getElementById("assignDueDate").value;
            const description = document.getElementById("assignDesc").value.trim();

            if (!title || !subject || !department || !year || !section || !dueDate) {
                showToast("Please fill in all required assignment fields (*).", "error");
                return;
            }

            const originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<span class="loader"></span> Saving...';
            saveBtn.disabled = true;

            try {
                const aid = id || push(ref(db, "assignments")).key;
                const assignData = {
                    title,
                    subject,
                    maxMarks,
                    department,
                    year,
                    section,
                    assignedDate: assignedDate || new Date().toISOString().split("T")[0],
                    dueDate,
                    description,
                    createdBy: user.uid,
                    createdAt: new Date().getTime()
                };

                await set(ref(db, `assignments/${aid}`), assignData);
                showToast("Assignment saved successfully.", "success");
                modal.classList.remove("active");

                // Send Realtime Notification to Students in this class
                const usersSnap = await get(ref(db, "users"));
                if (usersSnap.exists()) {
                    const users = usersSnap.val();
                    Object.keys(users).forEach(suid => {
                        const u = users[suid];
                        if (u.role === "student" && u.department === department && u.year === year && u.section === section) {
                            sendNotification(suid, "New Assignment Posted", `New assignment "${title}" for ${subject} due on ${dueDate}.`, "assignment");
                        }
                    });
                }

                await loadAssignments(user.uid, userData);
            } catch (err) {
                console.error("Save assignment error:", err);
                showToast("Failed to save assignment.", "error");
            } finally {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
        });
    }
});

function renderSidebarNav(role) {
    const nav = document.getElementById("sidebarNav");
    const brandLink = document.getElementById("brandLink");
    if (!nav) return;

    if (role === "faculty") {
        brandLink.href = "faculty-dashboard.html";
        nav.innerHTML = `
            <a href="faculty-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="academic.html" class="nav-item"><i class="ri-building-line nav-icon"></i> Academic Data</a>
            <a href="students.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Students</a>
            <a href="attendance.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-file-list-3-line nav-icon"></i> Attendance Report</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks Management</a>
            <a href="assignments.html" class="nav-item active"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Leave Requests</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item active"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

async function loadAssignments(userUid, userData) {
    try {
        const snap = await get(ref(db, "assignments"));
        assignmentsMap = {};

        if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(id => {
                const a = data[id];
                if (userData.role === "student") {
                    const matchDept = !a.department || a.department === userData.department;
                    const matchYear = !a.year || a.year === userData.year;
                    const matchSec = !a.section || a.section === userData.section;
                    if (matchDept && matchYear && matchSec) {
                        assignmentsMap[id] = a;
                    }
                } else {
                    assignmentsMap[id] = a;
                }
            });
        }

        filterAssignments();
    } catch (err) {
        console.error("Error loading assignments:", err);
        showToast("Failed to load assignments.", "error");
    }
}

function filterAssignments() {
    const searchTerm = (document.getElementById("searchAssignment").value || "").toLowerCase();
    const subjVal = document.getElementById("filterSubject").value;
    const deptVal = document.getElementById("filterDept").value;

    const container = document.getElementById("assignmentsList");
    container.innerHTML = "";

    const keys = Object.keys(assignmentsMap);
    const filtered = [];

    keys.forEach(id => {
        const a = assignmentsMap[id];
        const matchSearch = !searchTerm || 
            (a.title || "").toLowerCase().includes(searchTerm) || 
            (a.subject || "").toLowerCase().includes(searchTerm) || 
            (a.description || "").toLowerCase().includes(searchTerm);
        
        const matchSubj = !subjVal || a.subject === subjVal;
        const matchDept = !deptVal || a.department === deptVal;

        if (matchSearch && matchSubj && matchDept) {
            filtered.push({ id, ...a });
        }
    });

    // Sort by due date
    filtered.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center text-muted p-4" style="grid-column: 1 / -1;">No course assignments found matching filters.</div>`;
        return;
    }

    const todayStr = new Date().toISOString().split("T")[0];

    filtered.forEach(a => {
        const isPastDue = a.dueDate && a.dueDate < todayStr;
        container.innerHTML += `
            <div class="card" style="margin-bottom: 0;">
                <div class="card-header" style="background-color: var(--bg-color);">
                    <div>
                        <span class="badge badge-primary" style="margin-bottom: 4px;">${a.subject}</span>
                        <h4 style="margin: 0; font-size: 1.1rem; color: var(--secondary-color);">${a.title}</h4>
                    </div>
                    <span class="badge ${isPastDue ? 'badge-danger' : 'badge-success'}">
                        ${isPastDue ? 'OVERDUE' : 'ACTIVE'}
                    </span>
                </div>
                <div class="card-body">
                    <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 1rem;">
                        ${a.description || 'No specific instructions provided.'}
                    </p>
                    <div style="font-size: 0.8rem; background-color: var(--bg-color); padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
                        <div><strong>Class:</strong> ${a.department || 'All'} - ${a.year || 'All'} (${a.section || 'All'})</div>
                        <div><strong>Due Date:</strong> <span style="color: ${isPastDue ? 'var(--danger-color)' : 'var(--primary-color)'}; font-weight: 600;">${a.dueDate || 'N/A'}</span></div>
                        <div><strong>Max Marks:</strong> ${a.maxMarks || 10} Points</div>
                    </div>
                    <div class="flex items-center justify-between">
                        <a href="marks.html" class="btn btn-secondary" style="font-size: 0.8rem;"><i class="ri-award-line"></i> View Marks</a>
                        ${window.currentUserRole === "faculty" ? `
                            <div class="flex gap-2">
                                <button onclick="window.editAssignment('${a.id}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                                <button onclick="window.deleteAssignment('${a.id}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
}

function openAssignmentModal(id = null) {
    document.getElementById("assignId").value = id || "";
    const titleEl = document.getElementById("assignModalTitle");

    const todayStr = new Date().toISOString().split("T")[0];
    document.getElementById("assignAssignedDate").value = todayStr;

    if (id && assignmentsMap[id]) {
        titleEl.innerText = "Edit Assignment";
        const a = assignmentsMap[id];
        document.getElementById("assignTitle").value = a.title || "";
        document.getElementById("assignSubject").value = a.subject || "";
        document.getElementById("assignMaxMarks").value = a.maxMarks || 10;
        document.getElementById("assignDept").value = a.department || "";
        document.getElementById("assignYear").value = a.year || "";
        document.getElementById("assignSection").value = a.section || "";
        document.getElementById("assignAssignedDate").value = a.assignedDate || todayStr;
        document.getElementById("assignDueDate").value = a.dueDate || "";
        document.getElementById("assignDesc").value = a.description || "";
    } else {
        titleEl.innerText = "Create Assignment";
        document.getElementById("assignTitle").value = "";
        document.getElementById("assignSubject").value = "";
        document.getElementById("assignMaxMarks").value = 10;
        document.getElementById("assignDept").value = "";
        document.getElementById("assignYear").value = "";
        document.getElementById("assignSection").value = "";
        document.getElementById("assignDueDate").value = "";
        document.getElementById("assignDesc").value = "";
    }

    document.getElementById("assignmentModal").classList.add("active");
}

window.editAssignment = function(id) {
    openAssignmentModal(id);
};

window.deleteAssignment = async function(id) {
    const a = assignmentsMap[id];
    const name = a ? a.title : "this assignment";
    const confirmed = await showConfirm(`Are you sure you want to delete "${name}"?`, `Delete Assignment`);
    if (confirmed) {
        try {
            await remove(ref(db, `assignments/${id}`));
            showToast("Assignment deleted.", "success");
            await loadAssignments(currentUser.uid, { role: "faculty" });
        } catch (err) {
            console.error("Delete assignment error:", err);
            showToast("Failed to delete assignment.", "error");
        }
    }
};
