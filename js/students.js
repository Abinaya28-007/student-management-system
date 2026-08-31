import { db } from "./firebase-config.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { initLayout, showToast, showConfirm, masterDataCache } from "./common.js";

let studentsMap = {};

document.addEventListener("DOMContentLoaded", async () => {
    await initLayout("faculty");
    await loadStudents();

    // Search and Filter Listeners
    document.getElementById("searchStudent").addEventListener("input", filterStudentsTable);
    document.getElementById("filterDept").addEventListener("change", filterStudentsTable);
    document.getElementById("filterYear").addEventListener("change", filterStudentsTable);
    document.getElementById("filterSection").addEventListener("change", filterStudentsTable);

    // Modal Listeners
    const modal = document.getElementById("studentModal");
    const addBtn = document.getElementById("addStudentBtn");
    const closeBtns = [document.getElementById("closeStudentModal"), document.getElementById("cancelStudentModal")];

    addBtn.addEventListener("click", () => {
        openStudentModal();
    });

    closeBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => modal.classList.remove("active"));
    });

    const viewModal = document.getElementById("viewStudentModal");
    const closeViewBtns = [document.getElementById("closeViewStudentModal"), document.getElementById("closeViewBtn")];
    closeViewBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => viewModal.classList.remove("active"));
    });

    // Save Student Action
    document.getElementById("saveStudentBtn").addEventListener("click", async () => {
        const id = document.getElementById("studentId").value;
        const name = document.getElementById("studentName").value.trim();
        const rollNo = document.getElementById("studentRollNo").value.trim();
        const email = document.getElementById("studentEmail").value.trim();
        const department = document.getElementById("studentDept").value;
        const year = document.getElementById("studentYear").value;
        const section = document.getElementById("studentSection").value;
        const phone = document.getElementById("studentPhone").value.trim();
        const dob = document.getElementById("studentDob").value;
        const gender = document.getElementById("studentGender").value;
        const address = document.getElementById("studentAddress").value.trim();

        if (!name || !rollNo || !email || !department || !year || !section) {
            showToast("Please fill all required student fields (*).", "error");
            return;
        }

        const saveBtn = document.getElementById("saveStudentBtn");
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="loader"></span> Saving...';
        saveBtn.disabled = true;

        try {
            const uid = id || ("std_" + new Date().getTime());
            const studentData = {
                name,
                rollNo,
                email,
                role: "student",
                department,
                year,
                section,
                phone,
                dob,
                gender,
                address,
                updatedAt: new Date().getTime()
            };

            await set(ref(db, `users/${uid}`), studentData);

            showToast(`Student profile for ${name} saved successfully.`, "success");
            modal.classList.remove("active");
            await loadStudents();
        } catch (err) {
            console.error("Error saving student:", err);
            showToast("Failed to save student record.", "error");
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
});

async function loadStudents() {
    const tableBody = document.getElementById("studentsTableBody");
    try {
        const snap = await get(ref(db, "users"));
        tableBody.innerHTML = "";
        studentsMap = {};

        if (snap.exists()) {
            const users = snap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student") {
                    studentsMap[uid] = u;
                }
            });
        }

        filterStudentsTable();
    } catch (err) {
        console.error("Error loading students:", err);
        showToast("Failed to fetch students list.", "error");
    }
}

function filterStudentsTable() {
    const searchTerm = (document.getElementById("searchStudent").value || "").toLowerCase();
    const deptVal = document.getElementById("filterDept").value;
    const yearVal = document.getElementById("filterYear").value;
    const secVal = document.getElementById("filterSection").value;

    const tableBody = document.getElementById("studentsTableBody");
    const countEl = document.getElementById("studentRecordCount");
    tableBody.innerHTML = "";

    const studentKeys = Object.keys(studentsMap);
    const filtered = [];

    studentKeys.forEach(uid => {
        const s = studentsMap[uid];
        const matchSearch = !searchTerm || 
            (s.name || "").toLowerCase().includes(searchTerm) || 
            (s.rollNo || "").toLowerCase().includes(searchTerm) || 
            (s.email || "").toLowerCase().includes(searchTerm);
        
        const matchDept = !deptVal || s.department === deptVal;
        const matchYear = !yearVal || s.year === yearVal;
        const matchSec = !secVal || s.section === secVal;

        if (matchSearch && matchDept && matchYear && matchSec) {
            filtered.push({ uid, ...s });
        }
    });

    // Sort by Roll No
    filtered.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

    if (countEl) countEl.innerText = filtered.length;

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No student profiles match your search criteria.</td></tr>`;
        return;
    }

    filtered.forEach(s => {
        tableBody.innerHTML += `
            <tr>
                <td><strong>${s.rollNo || 'N/A'}</strong></td>
                <td>
                    <div style="font-weight: 600; color: var(--secondary-color);">${s.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${s.phone || 'No phone'}</div>
                </td>
                <td><span class="badge badge-primary">${s.department || 'N/A'}</span></td>
                <td>${s.year || 'N/A'}</td>
                <td><span class="badge badge-warning">${s.section || 'N/A'}</span></td>
                <td>${s.email}</td>
                <td style="text-align: right;">
                    <div class="flex gap-2 justify-end" style="justify-content: flex-end;">
                        <button onclick="window.viewStudent('${s.uid}')" class="btn btn-secondary btn-icon" title="View Profile"><i class="ri-eye-line text-primary"></i></button>
                        <button onclick="window.editStudent('${s.uid}')" class="btn btn-secondary btn-icon" title="Edit Profile"><i class="ri-edit-line text-primary"></i></button>
                        <button onclick="window.deleteStudent('${s.uid}')" class="btn btn-secondary btn-icon" title="Delete Profile"><i class="ri-delete-bin-line text-danger"></i></button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function openStudentModal(uid = null) {
    document.getElementById("studentId").value = uid || "";
    const titleEl = document.getElementById("studentModalTitle");

    if (uid && studentsMap[uid]) {
        titleEl.innerText = "Edit Student Profile";
        const s = studentsMap[uid];
        document.getElementById("studentName").value = s.name || "";
        document.getElementById("studentRollNo").value = s.rollNo || "";
        document.getElementById("studentEmail").value = s.email || "";
        document.getElementById("studentDept").value = s.department || "";
        document.getElementById("studentYear").value = s.year || "";
        document.getElementById("studentSection").value = s.section || "";
        document.getElementById("studentPhone").value = s.phone || "";
        document.getElementById("studentDob").value = s.dob || "";
        document.getElementById("studentGender").value = s.gender || "Male";
        document.getElementById("studentAddress").value = s.address || "";
    } else {
        titleEl.innerText = "Add Student Profile";
        document.getElementById("studentName").value = "";
        document.getElementById("studentRollNo").value = "";
        document.getElementById("studentEmail").value = "";
        document.getElementById("studentDept").value = "";
        document.getElementById("studentYear").value = "";
        document.getElementById("studentSection").value = "";
        document.getElementById("studentPhone").value = "";
        document.getElementById("studentDob").value = "";
        document.getElementById("studentGender").value = "Male";
        document.getElementById("studentAddress").value = "";
    }

    document.getElementById("studentModal").classList.add("active");
}

window.editStudent = function(uid) {
    openStudentModal(uid);
};

window.viewStudent = function(uid) {
    const s = studentsMap[uid];
    if (!s) return;

    const content = document.getElementById("viewStudentContent");
    content.innerHTML = `
        <div class="flex items-center gap-3 mb-3 p-3" style="background-color: var(--bg-color); border-radius: var(--radius-md);">
            <div class="avatar" style="width: 50px; height: 50px; font-size: 1.25rem;">${(s.name||'S').substring(0,2).toUpperCase()}</div>
            <div>
                <h4 style="margin: 0; font-size: 1.1rem; color: var(--secondary-color);">${s.name}</h4>
                <div style="font-size: 0.85rem; color: var(--primary-color); font-weight: 600;">Roll No: ${s.rollNo || 'N/A'}</div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.875rem;">
            <div><strong>Email:</strong> ${s.email}</div>
            <div><strong>Phone:</strong> ${s.phone || 'N/A'}</div>
            <div><strong>Department:</strong> ${s.department || 'N/A'}</div>
            <div><strong>Year & Sec:</strong> ${s.year || 'N/A'} - ${s.section || 'N/A'}</div>
            <div><strong>Date of Birth:</strong> ${s.dob || 'N/A'}</div>
            <div><strong>Gender:</strong> ${s.gender || 'N/A'}</div>
        </div>
        <div class="mt-3" style="font-size: 0.875rem;">
            <strong>Address:</strong>
            <p style="color: var(--text-muted); margin-top: 2px;">${s.address || 'No address specified.'}</p>
        </div>
    `;

    document.getElementById("viewStudentModal").classList.add("active");
};

window.deleteStudent = async function(uid) {
    const s = studentsMap[uid];
    const name = s ? s.name : "this student";
    const confirmed = await showConfirm(`Are you sure you want to delete the student profile for ${name}?`, `Delete Student`);
    if (confirmed) {
        try {
            await remove(ref(db, `users/${uid}`));
            showToast("Student profile deleted successfully.", "success");
            await loadStudents();
        } catch (err) {
            console.error("Delete student error:", err);
            showToast("Failed to delete student profile.", "error");
        }
    }
};
