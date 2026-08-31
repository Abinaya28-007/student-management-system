import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, set, push, onValue } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Global Shared State
export let currentUser = null;
export let currentUserData = null;
export let masterDataCache = {
    departments: {},
    years: {},
    sections: {},
    subjects: {}
};

/**
 * Toast Notification Utility
 */
export function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    let icon = "ri-check-line";
    if (type === "error") icon = "ri-error-warning-line";
    if (type === "warning") icon = "ri-alert-line";
    if (type === "info") icon = "ri-information-line";

    toast.innerHTML = `
        <i class="${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

/**
 * Custom Confirmation Modal Utility
 */
export function showConfirm(message, title = "Confirm Action") {
    return new Promise((resolve) => {
        let overlay = document.getElementById("confirmModalOverlay");
        if (!overlay) {
            overlay = document.createElement("div");
            overlay.id = "confirmModalOverlay";
            overlay.className = "modal-overlay";
            overlay.innerHTML = `
                <div class="modal" style="max-width: 420px;">
                    <div class="modal-header">
                        <h3 class="modal-title" id="confirmTitle">${title}</h3>
                        <button class="modal-close" id="confirmCloseBtn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p id="confirmMessage">${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="confirmCancelBtn">Cancel</button>
                        <button class="btn btn-danger" id="confirmOkBtn">Confirm</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        document.getElementById("confirmTitle").innerText = title;
        document.getElementById("confirmMessage").innerText = message;

        const closeBtn = document.getElementById("confirmCloseBtn");
        const cancelBtn = document.getElementById("confirmCancelBtn");
        const okBtn = document.getElementById("confirmOkBtn");

        const cleanup = (result) => {
            overlay.classList.remove("active");
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        closeBtn.onclick = () => cleanup(false);

        setTimeout(() => overlay.classList.add("active"), 10);
    });
}

/**
 * Seed Default Master Data if empty in Firebase
 */
export async function seedMasterDataIfEmpty() {
    try {
        const snap = await get(ref(db, "masterData"));
        if (!snap.exists()) {
            const initialMasterData = {
                departments: {
                    dept_1: { name: "Computer Science", code: "CSE" },
                    dept_2: { name: "Information Technology", code: "IT" },
                    dept_3: { name: "Electronics & Communication", code: "ECE" },
                    dept_4: { name: "Mechanical Engineering", code: "MECH" },
                    dept_5: { name: "Civil Engineering", code: "CIVIL" }
                },
                years: {
                    year_1: { name: "1st Year", code: "Y1" },
                    year_2: { name: "2nd Year", code: "Y2" },
                    year_3: { name: "3rd Year", code: "Y3" },
                    year_4: { name: "4th Year", code: "Y4" }
                },
                sections: {
                    sec_1: { name: "Section A", code: "A" },
                    sec_2: { name: "Section B", code: "B" },
                    sec_3: { name: "Section C", code: "C" }
                },
                subjects: {
                    subj_1: { name: "Data Structures & Algorithms", code: "CS301", department: "Computer Science", year: "3rd Year" },
                    subj_2: { name: "Web Development", code: "CS302", department: "Computer Science", year: "3rd Year" },
                    subj_3: { name: "Database Management Systems", code: "CS303", department: "Computer Science", year: "3rd Year" },
                    subj_4: { name: "Computer Networks", code: "CS304", department: "Computer Science", year: "3rd Year" },
                    subj_5: { name: "Software Engineering", code: "IT301", department: "Information Technology", year: "3rd Year" }
                }
            };
            await set(ref(db, "masterData"), initialMasterData);
        }
    } catch (err) {
        console.error("Master data seeding error:", err);
    }
}

/**
 * Load Master Data from Firebase Realtime Database
 */
export async function fetchMasterData() {
    await seedMasterDataIfEmpty();
    try {
        const snap = await get(ref(db, "masterData"));
        if (snap.exists()) {
            const data = snap.val();
            masterDataCache.departments = data.departments || {};
            masterDataCache.years = data.years || {};
            masterDataCache.sections = data.sections || {};
            masterDataCache.subjects = data.subjects || {};
        }
    } catch (err) {
        console.error("Failed to load master data:", err);
    }
    return masterDataCache;
}

/**
 * Dynamic Dropdown Selector Helper
 */
export function populateSelectOptions(selectElement, itemsMap, valueKey = "name", placeholder = "Select Option") {
    if (!selectElement) return;
    const currentVal = selectElement.value;
    selectElement.innerHTML = `<option value="">${placeholder}</option>`;
    
    if (Array.isArray(itemsMap)) {
        itemsMap.forEach(item => {
            const val = typeof item === "object" ? item[valueKey] : item;
            const text = typeof item === "object" ? (item.name || item.title || val) : item;
            selectElement.innerHTML += `<option value="${val}">${text}</option>`;
        });
    } else if (typeof itemsMap === "object" && itemsMap !== null) {
        Object.keys(itemsMap).forEach(key => {
            const item = itemsMap[key];
            const val = typeof item === "object" ? (item[valueKey] || item.name || key) : item;
            const text = typeof item === "object" ? (item.name || val) : item;
            selectElement.innerHTML += `<option value="${val}">${text}</option>`;
        });
    }
    if (currentVal) selectElement.value = currentVal;
}

/**
 * Filter subjects based on selected Department and Year
 */
export function getFilteredSubjects(deptVal, yearVal) {
    const subjects = masterDataCache.subjects || {};
    const result = [];
    Object.keys(subjects).forEach(key => {
        const s = subjects[key];
        const matchDept = !deptVal || !s.department || s.department === deptVal;
        const matchYear = !yearVal || !s.year || s.year === yearVal;
        if (matchDept && matchYear) {
            result.push({ id: key, ...s });
        }
    });
    return result;
}

/**
 * Bind master data to standard document selects if present
 */
export async function bindMasterDataSelects() {
    await fetchMasterData();

    const deptSelects = document.querySelectorAll(".select-dept, #filterDept, #department, #studentDept");
    const yearSelects = document.querySelectorAll(".select-year, #filterYear, #year, #studentYear");
    const secSelects = document.querySelectorAll(".select-section, #filterSection, #section, #studentSection");
    const subjSelects = document.querySelectorAll(".select-subject, #filterSubject, #subject");

    deptSelects.forEach(sel => populateSelectOptions(sel, masterDataCache.departments, "name", "All Departments"));
    yearSelects.forEach(sel => populateSelectOptions(sel, masterDataCache.years, "name", "All Years"));
    secSelects.forEach(sel => populateSelectOptions(sel, masterDataCache.sections, "name", "All Sections"));
    subjSelects.forEach(sel => populateSelectOptions(sel, masterDataCache.subjects, "name", "All Subjects"));
}

/**
 * Initialize Layout Components (Mobile Sidebar Toggle, Topbar Profile, Notifications)
 */
export function initLayout(requiredRole = null) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = "index.html";
                return;
            }

            currentUser = user;
            try {
                const userSnap = await get(ref(db, `users/${user.uid}`));
                if (userSnap.exists()) {
                    currentUserData = userSnap.val();
                } else {
                    currentUserData = { name: user.email.split("@")[0], email: user.email, role: "student" };
                }

                // Check Role Permission
                if (requiredRole && currentUserData.role !== requiredRole) {
                    showToast("Unauthorized access for your account role.", "error");
                    setTimeout(() => {
                        window.location.href = currentUserData.role === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
                    }, 1000);
                    return;
                }

                // Bind Profile in Navbar
                const userNameEl = document.getElementById("navUserName");
                const userRoleEl = document.getElementById("navUserRole");
                const userAvatarEl = document.getElementById("navUserAvatar");

                if (userNameEl) userNameEl.innerText = currentUserData.name || "User";
                if (userRoleEl) userRoleEl.innerText = (currentUserData.role || "student").toUpperCase();
                if (userAvatarEl) {
                    const initials = (currentUserData.name || "U").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
                    userAvatarEl.innerText = initials;
                }

                // Mobile Drawer Toggle
                const mobileToggleBtn = document.getElementById("mobileToggle");
                const sidebar = document.querySelector(".sidebar");
                if (mobileToggleBtn && sidebar) {
                    mobileToggleBtn.addEventListener("click", () => {
                        sidebar.classList.toggle("open");
                    });
                }

                // Logout Button Event
                const logoutBtn = document.getElementById("logoutBtn");
                if (logoutBtn) {
                    logoutBtn.addEventListener("click", async (e) => {
                        e.preventDefault();
                        const confirmed = await showConfirm("Are you sure you want to sign out?", "Sign Out");
                        if (confirmed) {
                            await signOut(auth);
                            window.location.href = "index.html";
                        }
                    });
                }

                // Setup Realtime Notifications Listener
                setupNotificationsListener(user.uid);

                // Populate Master Data Dropdowns
                await bindMasterDataSelects();

                resolve({ user, userData: currentUserData });
            } catch (err) {
                console.error("Auth init error:", err);
                window.location.href = "index.html";
            }
        });
    });
}

/**
 * Setup Realtime Notifications Badge & Dropdown
 */
function setupNotificationsListener(uid) {
    const notifBadge = document.getElementById("notifBadge");
    const notifDropdown = document.getElementById("notifDropdown");
    const notifList = document.getElementById("notifList");

    if (!notifBadge && !notifList) return;

    onValue(ref(db, `notifications/${uid}`), (snapshot) => {
        let unreadCount = 0;
        const items = [];
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.keys(data).forEach(id => {
                const item = data[id];
                if (!item.read) unreadCount++;
                items.push({ id, ...item });
            });
        }

        // Sort latest first
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        if (notifBadge) {
            if (unreadCount > 0) {
                notifBadge.innerText = unreadCount > 99 ? "99+" : unreadCount;
                notifBadge.style.display = "inline-flex";
            } else {
                notifBadge.style.display = "none";
            }
        }

        if (notifList) {
            notifList.innerHTML = "";
            if (items.length === 0) {
                notifList.innerHTML = `<div class="p-3 text-center text-muted text-sm">No notifications</div>`;
            } else {
                items.slice(0, 5).forEach(n => {
                    const timeStr = n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    notifList.innerHTML += `
                        <div class="notif-item ${n.read ? 'read' : 'unread'}" style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
                            <div style="font-weight: 600; color: var(--secondary-color);">${n.title || 'Notification'}</div>
                            <div style="color: var(--text-muted); margin: 2px 0;">${n.message || ''}</div>
                            <div style="font-size: 0.75rem; color: var(--primary-color);">${timeStr}</div>
                        </div>
                    `;
                });
            }
        }
    });

    const notifBell = document.getElementById("notifBellBtn");
    if (notifBell && notifDropdown) {
        notifBell.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("show");
        });
        document.addEventListener("click", () => {
            notifDropdown.classList.remove("show");
        });
    }
}

/**
 * Send Notification to User in Firebase
 */
export async function sendNotification(userUid, title, message, type = "general") {
    try {
        const notifRef = push(ref(db, `notifications/${userUid}`));
        await set(notifRef, {
            title,
            message,
            type,
            timestamp: new Date().getTime(),
            read: false
        });
    } catch (err) {
        console.error("Failed to send notification:", err);
    }
}
