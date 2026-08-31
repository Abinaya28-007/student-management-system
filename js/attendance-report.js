import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initLayout, currentUserData } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    renderSidebarNav(userData.role);
    await loadAttendanceReport(user.uid, userData);

    document.getElementById("generateReportBtn").addEventListener("click", () => {
        loadAttendanceReport(user.uid, userData);
    });
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
            <a href="attendance-report.html" class="nav-item active"><i class="ri-file-list-3-line nav-icon"></i> Attendance Report</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks Management</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Leave Requests</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item active"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

async function loadAttendanceReport(currentUid, userData) {
    const tableBody = document.getElementById("reportTableBody");
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted"><span class="loader"></span> Generating attendance report...</td></tr>`;

    try {
        const deptVal = document.getElementById("reportDept").value;
        const yearVal = document.getElementById("reportYear").value;
        const secVal = document.getElementById("reportSection").value;
        const subjVal = document.getElementById("reportSubject").value;
        const fromDate = document.getElementById("reportFromDate").value;
        const toDate = document.getElementById("reportToDate").value;

        // 1. Fetch Students
        const usersSnap = await get(ref(db, "users"));
        const studentsList = [];

        if (usersSnap.exists()) {
            const users = usersSnap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student") {
                    // If current user is student, restrict to own profile
                    if (userData.role === "student" && uid !== currentUid) return;

                    const matchDept = !deptVal || u.department === deptVal;
                    const matchYear = !yearVal || u.year === yearVal;
                    const matchSec = !secVal || u.section === secVal;

                    if (matchDept && matchYear && matchSec) {
                        studentsList.push({ uid, ...u });
                    }
                }
            });
        }

        studentsList.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        // 2. Fetch Attendance Records
        const attSnap = await get(ref(db, "attendance"));
        const statsMap = {}; // studentUid -> { total: 0, present: 0, absent: 0 }

        studentsList.forEach(s => {
            statsMap[s.uid] = { total: 0, present: 0, absent: 0 };
        });

        if (attSnap.exists()) {
            const attData = attSnap.val();
            Object.keys(attData).forEach(date => {
                if (fromDate && date < fromDate) return;
                if (toDate && date > toDate) return;

                const subjs = attData[date];
                Object.keys(subjs).forEach(subjKey => {
                    if (subjVal && subjKey !== subjVal) return;

                    const stMap = subjs[subjKey];
                    Object.keys(stMap).forEach(stUid => {
                        if (statsMap[stUid]) {
                            statsMap[stUid].total++;
                            if (stMap[stUid].status === "present") {
                                statsMap[stUid].present++;
                            } else {
                                statsMap[stUid].absent++;
                            }
                        }
                    });
                });
            });
        }

        tableBody.innerHTML = "";

        if (studentsList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No student attendance records match the selected filters.</td></tr>`;
            return;
        }

        studentsList.forEach(s => {
            const stat = statsMap[s.uid] || { total: 0, present: 0, absent: 0 };
            const pct = stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 100;
            const isLow = pct < 75;

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${s.rollNo || 'N/A'}</strong></td>
                    <td>${s.name}</td>
                    <td><span class="badge badge-primary">${s.department || 'N/A'}</span></td>
                    <td><strong>${stat.total}</strong></td>
                    <td style="color: var(--success-color); font-weight: 600;">${stat.present}</td>
                    <td style="color: var(--danger-color); font-weight: 600;">${stat.absent}</td>
                    <td>
                        <div class="flex items-center gap-2">
                            <span style="font-weight: 700; width: 40px; font-size: 0.85rem;">${pct}%</span>
                            <div class="progress-bar-container" style="flex: 1;">
                                <div class="progress-bar ${isLow ? 'danger' : 'success'}" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    </td>
                    <td>
                        ${isLow 
                            ? '<span class="badge badge-danger"><i class="ri-alert-line"></i> Below 75% Attendance</span>' 
                            : '<span class="badge badge-success"><i class="ri-checkbox-circle-line"></i> Satisfactory</span>'
                        }
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Attendance report error:", err);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error generating attendance report.</td></tr>`;
    }
}
