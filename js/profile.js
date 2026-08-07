import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, update } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let userData = null;
let currentUid = null;

// ── Toast Helper ──────────────────────────────────────────────
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    const icons = { success: "ri-check-line", error: "ri-error-warning-line", warning: "ri-alert-line" };
    toast.innerHTML = `<i class="${icons[type] || icons.success} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3500);
}

// ── Auth Guard ────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "faculty") {
            window.location.href = "index.html"; return;
        }
        currentUid = user.uid;
        userData = snap.val();
        renderProfile();
    } catch (e) {
        console.error(e);
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// ── Render Profile (View Mode) ────────────────────────────────
function renderProfile() {
    const name = userData.name || "";
    const initials = name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

    document.getElementById("avatarInitials").innerText = initials || "?";
    document.getElementById("profileName").innerText = name;
    document.getElementById("profileDept").innerText = userData.department || "No Dept";

    document.getElementById("viewName").innerText = name;
    document.getElementById("viewEmail").innerText = userData.email || "--";
    document.getElementById("viewDepartment").innerText = userData.department || "--";
}

// ── Open / Close Edit Mode ────────────────────────────────────
function openEditMode() {
    document.getElementById("editName").value = userData.name || "";
    document.getElementById("editDept").value = userData.department || "Computer Science";
    document.getElementById("viewCard").classList.add("d-none");
    document.getElementById("editCard").classList.remove("d-none");
    document.getElementById("editName").focus();
}

function closeEditMode() {
    document.getElementById("editCard").classList.add("d-none");
    document.getElementById("viewCard").classList.remove("d-none");
}

document.getElementById("editProfileBtn").addEventListener("click", openEditMode);
document.getElementById("cancelEditBtn").addEventListener("click", closeEditMode);
document.getElementById("cancelEditBtn2").addEventListener("click", closeEditMode);

// ── Live avatar preview ───────────────────────────────────────
document.getElementById("editName").addEventListener("input", function () {
    const initials = this.value.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    document.getElementById("avatarInitials").innerText = initials || "?";
});

// ── Save Profile ──────────────────────────────────────────────
document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    const name = document.getElementById("editName").value.trim();
    const dept = document.getElementById("editDept").value;

    if (!name) {
        showToast("Full name cannot be empty.", "error");
        document.getElementById("editName").focus();
        return;
    }

    const btn = document.getElementById("saveProfileBtn");
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;"></span> Saving...';
    btn.disabled = true;

    try {
        await update(ref(db, "users/" + currentUid), { name, department: dept });
        userData.name = name;
        userData.department = dept;

        renderProfile();
        closeEditMode();
        showToast("Profile updated successfully! 🎉", "success");
    } catch (e) {
        console.error(e);
        showToast("Failed to save changes. Please try again.", "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});
