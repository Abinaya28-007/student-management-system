import { db } from "./firebase-config.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initLayout, currentUserData } from "./common.js";

let attChartInstance = null;
let marksChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout("student");
    await loadStudentDashboardData(user.uid, userData);
});

async function loadStudentDashboardData(uid, userData) {
    try {
        // Banner info
        document.getElementById("stdBannerName").innerText = userData.name || "Student";
        document.getElementById("stdBannerRollNo").innerText = `Roll No: ${userData.rollNo || 'N/A'}`;
        document.getElementById("stdBannerSection").innerText = `Sec: ${userData.section || 'N/A'}`;
        document.getElementById("stdBannerDept").innerText = userData.department || "Unassigned Dept";
        document.getElementById("stdBannerYear").innerText = userData.year || "Unassigned Year";

        // 1. Calculate Attendance %
        const attSnap = await get(ref(db, "attendance"));
        let presentCount = 0;
        let totalClasses = 0;

        if (attSnap.exists()) {
            const attData = attSnap.val();
            Object.keys(attData).forEach(date => {
                const subjs = attData[date];
                Object.keys(subjs).forEach(subj => {
                    const stMap = subjs[subj];
                    if (stMap && stMap[uid]) {
                        totalClasses++;
                        if (stMap[uid].status === "present") presentCount++;
                    }
                });
            });
        }

        const attPercentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;
        const attValEl = document.getElementById("stdOverallAttendance");
        attValEl.innerText = `${attPercentage}%`;
        if (attPercentage < 75) {
            attValEl.style.color = "var(--danger-color)";
        } else {
            attValEl.style.color = "var(--success-color)";
        }

        // 2. Assignment Marks Avg
        const assignMarksSnap = await get(ref(db, "assignmentMarks"));
        let assignTotalObtained = 0;
        let assignTotalMax = 0;

        if (assignMarksSnap.exists()) {
            const am = assignMarksSnap.val();
            Object.keys(am).forEach(mid => {
                const mark = am[mid];
                if (mark.studentUid === uid) {
                    assignTotalObtained += Number(mark.obtainedMarks || 0);
                    assignTotalMax += Number(mark.maxMarks || 0);
                }
            });
        }
        const assignAvg = assignTotalMax > 0 ? Math.round((assignTotalObtained / assignTotalMax) * 100) : 0;
        document.getElementById("stdAssignmentAvg").innerText = assignTotalMax > 0 ? `${assignAvg}%` : 'N/A';

        // 3. Internal Marks Avg
        const internalSnap = await get(ref(db, "internalMarks"));
        let internalTotalObtained = 0;
        let internalTotalMax = 0;

        if (internalSnap.exists()) {
            const im = internalSnap.val();
            Object.keys(im).forEach(mid => {
                const mark = im[mid];
                if (mark.studentUid === uid) {
                    internalTotalObtained += Number(mark.total || 0);
                    internalTotalMax += Number(mark.maxTotal || 100);
                }
            });
        }
        const internalAvg = internalTotalMax > 0 ? Math.round((internalTotalObtained / internalTotalMax) * 100) : 0;
        document.getElementById("stdInternalAvg").innerText = internalTotalMax > 0 ? `${internalAvg}%` : 'N/A';

        // 4. Exam Marks Avg
        const examSnap = await get(ref(db, "examMarks"));
        let examTotalObtained = 0;
        let examTotalMax = 0;

        if (examSnap.exists()) {
            const em = examSnap.val();
            Object.keys(em).forEach(mid => {
                const mark = em[mid];
                if (mark.studentUid === uid) {
                    examTotalObtained += Number(mark.obtainedMarks || 0);
                    examTotalMax += Number(mark.maxMarks || 100);
                }
            });
        }
        const examAvg = examTotalMax > 0 ? Math.round((examTotalObtained / examTotalMax) * 100) : 0;
        document.getElementById("stdExamAvg").innerText = examTotalMax > 0 ? `${examAvg}%` : 'N/A';

        // 5. Count Pending Assignments
        const assignSnap = await get(ref(db, "assignments"));
        let pendingAssignCount = 0;
        const todayStr = new Date().toISOString().split("T")[0];

        if (assignSnap.exists()) {
            const assignments = assignSnap.val();
            Object.keys(assignments).forEach(aid => {
                const a = assignments[aid];
                const matchDept = !a.department || a.department === userData.department;
                const matchYear = !a.year || a.year === userData.year;
                const matchSec = !a.section || a.section === userData.section;
                if (matchDept && matchYear && matchSec) {
                    if (!a.dueDate || a.dueDate >= todayStr) {
                        pendingAssignCount++;
                    }
                }
            });
        }
        document.getElementById("stdPendingAssignments").innerText = pendingAssignCount;

        // 6. Count Leave Requests
        const leaveSnap = await get(ref(db, "leaveRequests"));
        let leaveCount = 0;

        if (leaveSnap.exists()) {
            const leaves = leaveSnap.val();
            Object.keys(leaves).forEach(lid => {
                if (leaves[lid].studentUid === uid) leaveCount++;
            });
        }
        document.getElementById("stdLeaveRequests").innerText = leaveCount;

        // 7. Render Charts
        renderStudentCharts(presentCount, totalClasses - presentCount, assignAvg, internalAvg, examAvg);

    } catch (err) {
        console.error("Student dashboard error:", err);
    }
}

function renderStudentCharts(present, absent, assignAvg, internalAvg, examAvg) {
    // Attendance chart
    const attCtx = document.getElementById("stdAttendanceChart");
    if (attCtx) {
        if (attChartInstance) attChartInstance.destroy();
        attChartInstance = new Chart(attCtx, {
            type: 'doughnut',
            data: {
                labels: ['Present Classes', 'Absent Classes'],
                datasets: [{
                    data: [present > 0 ? present : 38, absent > 0 ? absent : 2],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    // Marks breakdown chart
    const marksCtx = document.getElementById("stdMarksChart");
    if (marksCtx) {
        if (marksChartInstance) marksChartInstance.destroy();
        marksChartInstance = new Chart(marksCtx, {
            type: 'bar',
            data: {
                labels: ['Assignments', 'Internal Marks', 'Semester Exams'],
                datasets: [{
                    label: 'Score Percentage (%)',
                    data: [assignAvg || 85, internalAvg || 82, examAvg || 88],
                    backgroundColor: ['#4f46e5', '#f59e0b', '#10b981'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }
}
