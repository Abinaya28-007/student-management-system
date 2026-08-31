import { db } from "./firebase-config.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initLayout, showToast } from "./common.js";

let currentUid = null;

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    currentUid = user.uid;
    renderSidebarNav(userData.role);
    populateProfileForm(userData);

    document.getElementById("saveProfileBtn").addEventListener("click", saveProfile);
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
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item active"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item active"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

function populateProfileForm(userData) {
    const initials = (userData.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    document.getElementById("profileBigAvatar").innerText = initials;
    document.getElementById("profileNameDisplay").innerText = userData.name || "User";
    document.getElementById("profileRoleBadge").innerText = (userData.role || "student").toUpperCase();
    document.getElementById("profileEmailDisplay").innerText = userData.email || "";

    document.getElementById("profileName").value = userData.name || "";
    document.getElementById("profileEmail").value = userData.email || "";
    document.getElementById("profilePhone").value = userData.phone || "";
    document.getElementById("profileRollNo").value = userData.rollNo || userData.facultyId || "";
    document.getElementById("profileDept").value = userData.department || "";
    document.getElementById("profileYear").value = userData.year || "";
    document.getElementById("profileSection").value = userData.section || "";
    document.getElementById("profileAddress").value = userData.address || "";

    if (userData.role === "faculty") {
        const yearGrp = document.getElementById("yearGroup");
        const secGrp = document.getElementById("secGroup");
        if (yearGrp) yearGrp.style.display = "none";
        if (secGrp) secGrp.style.display = "none";
    }
}

async function saveProfile() {
    const name = document.getElementById("profileName").value.trim();
    const phone = document.getElementById("profilePhone").value.trim();
    const rollNo = document.getElementById("profileRollNo").value.trim();
    const department = document.getElementById("profileDept").value;
    const year = document.getElementById("profileYear").value;
    const section = document.getElementById("profileSection").value;
    const address = document.getElementById("profileAddress").value.trim();

    if (!name) {
        showToast("Full Name is required.", "error");
        return;
    }

    const saveBtn = document.getElementById("saveProfileBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loader"></span> Saving...';
    saveBtn.disabled = true;

    try {
        const payload = {
            name,
            phone,
            rollNo,
            department,
            year,
            section,
            address,
            updatedAt: new Date().getTime()
        };

        await update(ref(db, `users/${currentUid}`), payload);
        showToast("Profile details updated successfully.", "success");

        // Update display
        document.getElementById("profileNameDisplay").innerText = name;
        document.getElementById("navUserName").innerText = name;
        const initials = name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
        document.getElementById("profileBigAvatar").innerText = initials;
        document.getElementById("navUserAvatar").innerText = initials;

    } catch (err) {
        console.error("Save profile error:", err);
        showToast("Failed to update profile details.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}
