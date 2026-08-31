import { db } from "./firebase-config.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { 
    initLayout, 
    showToast, 
    showConfirm, 
    currentUser, 
    currentUserData,
    sendNotification 
} from "./common.js";

let leaveRequestsMap = {};
let currentStatusFilter = "Pending";

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    renderSidebarNav(userData.role);

    const isFaculty = userData.role === "faculty";
    const applyBtnWrapper = document.getElementById("studentApplyLeaveBtnWrapper");
    const facultyTabsCard = document.getElementById("facultyTabsCard");

    if (isFaculty) {
        if (applyBtnWrapper) applyBtnWrapper.style.display = "none";
        if (facultyTabsCard) facultyTabsCard.classList.remove("d-none");
    }

    // Default dates for student leave modal
    const todayStr = new Date().toISOString().split("T")[0];
    const fromInp = document.getElementById("fromDate");
    const toInp = document.getElementById("toDate");
    if (fromInp) fromInp.value = todayStr;
    if (toInp) toInp.value = todayStr;

    await loadLeaveRequests(user.uid, userData);

    // Faculty Tabs Event
    const tabBtns = document.querySelectorAll(".leave-tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => {
                b.classList.remove("btn-primary");
                b.classList.add("btn-secondary");
                b.classList.remove("active");
            });
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary", "active");

            currentStatusFilter = btn.getAttribute("data-status");
            renderLeaveTable(userData.role);
        });
    });

    // Student Apply Modal Events
    const applyModal = document.getElementById("applyLeaveModal");
    const applyBtn = document.getElementById("applyLeaveModalBtn");
    const closeApplyBtns = [document.getElementById("closeLeaveModal"), document.getElementById("cancelLeaveModal")];

    if (applyBtn && !isFaculty) {
        applyBtn.addEventListener("click", () => applyModal.classList.add("active"));
    }

    closeApplyBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => applyModal.classList.remove("active"));
    });

    // Submit Leave Action
    document.getElementById("submitLeaveBtn").addEventListener("click", async () => {
        const leaveType = document.getElementById("leaveType").value;
        const fromDate = document.getElementById("fromDate").value;
        const toDate = document.getElementById("toDate").value;
        const reason = document.getElementById("leaveReason").value.trim();
        const description = document.getElementById("leaveDesc").value.trim();

        if (!leaveType || !fromDate || !toDate || !reason) {
            showToast("Please fill in all required leave fields (*).", "error");
            return;
        }

        if (fromDate > toDate) {
            showToast("From Date cannot be after To Date.", "error");
            return;
        }

        const submitBtn = document.getElementById("submitLeaveBtn");
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="loader"></span> Submitting...';
        submitBtn.disabled = true;

        try {
            const newRef = push(ref(db, "leaveRequests"));
            const payload = {
                studentUid: user.uid,
                studentName: userData.name || "Student",
                rollNo: userData.rollNo || "N/A",
                department: userData.department || "Unassigned",
                year: userData.year || "N/A",
                section: userData.section || "N/A",
                leaveType,
                fromDate,
                toDate,
                reason,
                description,
                status: "Pending",
                facultyComment: "",
                appliedAt: new Date().getTime()
            };

            await set(newRef, payload);
            showToast("Leave request submitted successfully.", "success");
            applyModal.classList.remove("active");

            // Notify Faculty members
            const usersSnap = await get(ref(db, "users"));
            if (usersSnap.exists()) {
                const users = usersSnap.val();
                Object.keys(users).forEach(fuid => {
                    if (users[fuid].role === "faculty") {
                        sendNotification(fuid, "New Leave Application", `${userData.name} (${userData.rollNo||'N/A'}) applied for ${leaveType} leave.`, "leave");
                    }
                });
            }

            await loadLeaveRequests(user.uid, userData);
        } catch (err) {
            console.error("Submit leave error:", err);
            showToast("Failed to submit leave request.", "error");
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Faculty Review Modal Events
    const reviewModal = document.getElementById("reviewLeaveModal");
    const closeReviewBtns = [document.getElementById("closeReviewModal"), document.getElementById("cancelReviewModal")];
    closeReviewBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => reviewModal.classList.remove("active"));
    });

    document.getElementById("confirmReviewBtn").addEventListener("click", async () => {
        const lid = document.getElementById("reviewLeaveId").value;
        const actionType = document.getElementById("reviewActionType").value; // Approved | Rejected
        const comment = document.getElementById("facultyComment").value.trim();

        if (!lid || !actionType) return;

        const confirmBtn = document.getElementById("confirmReviewBtn");
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<span class="loader"></span> Processing...';
        confirmBtn.disabled = true;

        try {
            const leaveRecord = leaveRequestsMap[lid];

            await set(ref(db, `leaveRequests/${lid}/status`), actionType);
            await set(ref(db, `leaveRequests/${lid}/facultyComment`), comment);
            await set(ref(db, `leaveRequests/${lid}/reviewedBy`), user.uid);
            await set(ref(db, `leaveRequests/${lid}/reviewedAt`), new Date().getTime());

            showToast(`Leave application ${actionType.toLowerCase()} successfully.`, "success");
            reviewModal.classList.remove("active");

            // Send notification to Student
            if (leaveRecord && leaveRecord.studentUid) {
                sendNotification(
                    leaveRecord.studentUid,
                    `Leave ${actionType}`,
                    `Your leave request for ${leaveRecord.fromDate} to ${leaveRecord.toDate} has been ${actionType}. ${comment ? 'Remark: ' + comment : ''}`,
                    "leave"
                );
            }

            await loadLeaveRequests(user.uid, userData);
        } catch (err) {
            console.error("Review leave error:", err);
            showToast("Failed to update leave request.", "error");
        } finally {
            confirmBtn.innerHTML = originalText;
            confirmBtn.disabled = false;
        }
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
            <a href="attendance-report.html" class="nav-item"><i class="ri-file-list-3-line nav-icon"></i> Attendance Report</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks Management</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item active"><i class="ri-pass-valid-line nav-icon"></i> Leave Requests</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item active"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

async function loadLeaveRequests(currentUid, userData) {
    try {
        const snap = await get(ref(db, "leaveRequests"));
        leaveRequestsMap = {};

        if (snap.exists()) {
            const data = snap.val();
            Object.keys(data).forEach(id => {
                const l = data[id];
                if (userData.role === "student") {
                    if (l.studentUid === currentUid) {
                        leaveRequestsMap[id] = l;
                    }
                } else {
                    leaveRequestsMap[id] = l;
                }
            });
        }

        renderLeaveTable(userData.role);
    } catch (err) {
        console.error("Error loading leave requests:", err);
        showToast("Failed to load leave applications.", "error");
    }
}

function renderLeaveTable(role) {
    const tableBody = document.getElementById("leaveTableBody");
    tableBody.innerHTML = "";

    const keys = Object.keys(leaveRequestsMap);
    const list = [];

    keys.forEach(id => {
        const l = leaveRequestsMap[id];
        if (role === "faculty") {
            if (l.status === currentStatusFilter) {
                list.push({ id, ...l });
            }
        } else {
            list.push({ id, ...l });
        }
    });

    // Sort newest first
    list.sort((a, b) => (b.appliedAt || 0) - (a.appliedAt || 0));

    if (list.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No leave applications found.</td></tr>`;
        return;
    }

    list.forEach(l => {
        let badgeClass = "badge-warning";
        if (l.status === "Approved") badgeClass = "badge-success";
        if (l.status === "Rejected") badgeClass = "badge-danger";

        tableBody.innerHTML += `
            <tr>
                <td><strong>${l.studentName || 'Student'}</strong></td>
                <td>${l.rollNo || 'N/A'}</td>
                <td><span class="badge badge-primary">${l.leaveType}</span></td>
                <td>${l.fromDate}</td>
                <td>${l.toDate}</td>
                <td>
                    <div style="font-weight: 500;">${l.reason}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${l.description || ''}</div>
                </td>
                <td><span class="badge ${badgeClass}">${l.status}</span></td>
                <td style="text-align: right;">
                    ${role === "faculty" ? `
                        ${l.status === 'Pending' ? `
                            <div class="flex gap-2 justify-end" style="justify-content: flex-end;">
                                <button onclick="window.openReviewModal('${l.id}', 'Approved')" class="btn btn-secondary btn-icon" title="Approve"><i class="ri-check-line text-success"></i></button>
                                <button onclick="window.openReviewModal('${l.id}', 'Rejected')" class="btn btn-secondary btn-icon" title="Reject"><i class="ri-close-line text-danger"></i></button>
                            </div>
                        ` : `<span style="font-size: 0.8rem; color: var(--text-muted);">${l.facultyComment || 'Reviewed'}</span>`}
                    ` : `
                        <span style="font-size: 0.8rem; color: var(--text-muted);">${l.facultyComment || 'No remarks'}</span>
                    `}
                </td>
            </tr>
        `;
    });
}

window.openReviewModal = function(id, actionType) {
    const l = leaveRequestsMap[id];
    if (!l) return;

    document.getElementById("reviewLeaveId").value = id;
    document.getElementById("reviewActionType").value = actionType;
    document.getElementById("reviewModalTitle").innerText = `${actionType} Leave Request`;
    document.getElementById("facultyComment").value = "";

    document.getElementById("reviewStudentSummary").innerHTML = `
        <div><strong>Student:</strong> ${l.studentName} (${l.rollNo || 'N/A'})</div>
        <div><strong>Leave Dates:</strong> ${l.fromDate} to ${l.toDate}</div>
        <div><strong>Reason:</strong> ${l.reason}</div>
    `;

    const confirmBtn = document.getElementById("confirmReviewBtn");
    confirmBtn.className = `btn ${actionType === 'Approved' ? 'btn-primary' : 'btn-danger'}`;
    confirmBtn.innerText = `Confirm ${actionType}`;

    document.getElementById("reviewLeaveModal").classList.add("active");
};
