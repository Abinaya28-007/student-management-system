import { db } from "./firebase-config.js";
import { ref, onValue, set, remove, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initLayout, showToast, showConfirm } from "./common.js";

let currentUid = null;
let notifMap = {};

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    currentUid = user.uid;
    renderSidebarNav(userData.role);

    // Listen to notifications
    onValue(ref(db, `notifications/${currentUid}`), (snapshot) => {
        notifMap = {};
        if (snapshot.exists()) {
            notifMap = snapshot.val();
        }
        renderNotificationsList();
    });

    document.getElementById("markAllReadBtn").addEventListener("click", markAllRead);
    document.getElementById("clearAllNotifBtn").addEventListener("click", clearAllNotifications);
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
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Leave Requests</a>
            <a href="notifications.html" class="nav-item active"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item active"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

function renderNotificationsList() {
    const listEl = document.getElementById("fullNotifList");
    listEl.innerHTML = "";

    const keys = Object.keys(notifMap);
    const items = [];

    keys.forEach(id => {
        items.push({ id, ...notifMap[id] });
    });

    items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (items.length === 0) {
        listEl.innerHTML = `<div class="text-center text-muted p-4">No notifications present.</div>`;
        return;
    }

    items.forEach(n => {
        const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleString() : '';
        let iconClass = "ri-notification-3-line text-primary";
        if (n.type === "attendance") iconClass = "ri-calendar-check-line text-success";
        if (n.type === "marks") iconClass = "ri-award-line text-warning";
        if (n.type === "assignment") iconClass = "ri-book-open-line text-primary";
        if (n.type === "leave") iconClass = "ri-pass-valid-line text-danger";

        listEl.innerHTML += `
            <div class="flex items-center justify-between p-3" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); background-color: ${n.read ? 'var(--surface-color)' : 'var(--primary-light)'};">
                <div class="flex items-center gap-3">
                    <div style="font-size: 1.5rem;"><i class="${iconClass}"></i></div>
                    <div>
                        <div style="font-weight: 600; color: var(--secondary-color); font-size: 0.95rem;">${n.title || 'Notification'}</div>
                        <div style="color: var(--text-main); font-size: 0.875rem; margin: 2px 0;">${n.message || ''}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${timeStr}</div>
                    </div>
                </div>
                <div class="flex gap-2">
                    ${!n.read ? `<button onclick="window.markSingleRead('${n.id}')" class="btn btn-secondary btn-icon" title="Mark as Read"><i class="ri-check-line"></i></button>` : ''}
                    <button onclick="window.deleteSingleNotif('${n.id}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                </div>
            </div>
        `;
    });
}

window.markSingleRead = async function(id) {
    try {
        await update(ref(db, `notifications/${currentUid}/${id}`), { read: true });
        showToast("Marked as read.", "success");
    } catch (err) {
        console.error("Mark read error:", err);
    }
};

window.deleteSingleNotif = async function(id) {
    try {
        await remove(ref(db, `notifications/${currentUid}/${id}`));
        showToast("Notification removed.", "success");
    } catch (err) {
        console.error("Delete notification error:", err);
    }
};

async function markAllRead() {
    const keys = Object.keys(notifMap);
    if (keys.length === 0) return;

    try {
        const updates = {};
        keys.forEach(id => {
            updates[`${id}/read`] = true;
        });
        await update(ref(db, `notifications/${currentUid}`), updates);
        showToast("All notifications marked as read.", "success");
    } catch (err) {
        console.error("Mark all read error:", err);
    }
}

async function clearAllNotifications() {
    const keys = Object.keys(notifMap);
    if (keys.length === 0) return;

    const confirmed = await showConfirm("Are you sure you want to clear all notifications?", "Clear Notifications");
    if (confirmed) {
        try {
            await remove(ref(db, `notifications/${currentUid}`));
            showToast("All notifications cleared.", "success");
        } catch (err) {
            console.error("Clear notifications error:", err);
        }
    }
}
