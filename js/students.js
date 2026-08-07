import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, set, remove } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let studentsList = {};

function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    let icon = "ri-check-line";
    if (type === "error") icon = "ri-error-warning-line";
    toast.innerHTML = `<i class="${icon} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 400); }, 3000);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "faculty") {
            window.location.href = "index.html"; return;
        }
        loadStudents();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// Modal Logic
const modal = document.getElementById('studentModal');
const closeBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));

document.getElementById('addStudentBtn').addEventListener('click', () => {
    document.getElementById('studentId').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('studentEmail').value = '';
    document.getElementById('studentRollNo').value = '';
    document.getElementById('studentModalTitle').innerText = 'Add Student Profile';
    modal.classList.add('active');
});

// Load Students
async function loadStudents() {
    const table = document.getElementById("studentsTableBody");
    try {
        const snap = await get(ref(db, "users"));
        table.innerHTML = "";
        studentsList = {};
        
        if (snap.exists()) {
            const data = snap.val();
            let arr = [];
            for (const id in data) {
                if (data[id].role === "student") {
                    studentsList[id] = data[id];
                    arr.push({ id, ...data[id] });
                }
            }
            
            // Sort by roll no
            arr.sort((a,b) => (a.rollNo||"").localeCompare(b.rollNo||""));
            
            if (arr.length === 0) {
                table.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No students found.</td></tr>`;
                return;
            }

            arr.forEach(student => {
                table.innerHTML += `
                    <tr>
                        <td><strong>${student.rollNo || 'N/A'}</strong></td>
                        <td>${student.name}</td>
                        <td>${student.email}</td>
                        <td>${student.department}</td>
                        <td>${student.year}</td>
                        <td>${student.section || 'N/A'}</td>
                        <td>
                            <div class="flex gap-2">
                                <button onclick="window.editStudent('${student.id}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                                <button onclick="window.deleteStudent('${student.id}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            table.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No students found.</td></tr>`;
        }
    } catch (e) {
        showToast("Failed to load students.", "error");
    }
}

// Search
document.getElementById('searchStudent').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#studentsTableBody tr');
    
    rows.forEach(row => {
        if(row.children.length > 1) {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        }
    });
});

window.editStudent = function(id) {
    const student = studentsList[id];
    document.getElementById('studentId').value = id;
    document.getElementById('studentName').value = student.name;
    document.getElementById('studentEmail').value = student.email;
    document.getElementById('studentRollNo').value = student.rollNo || '';
    document.getElementById('studentDept').value = student.department;
    document.getElementById('studentYear').value = student.year;
    document.getElementById('studentSection').value = student.section || 'A';
    document.getElementById('studentModalTitle').innerText = 'Edit Student Profile';
    modal.classList.add('active');
}

window.deleteStudent = async function(id) {
    if (confirm("Are you sure you want to delete this student profile? This will not delete their attendance or marks.")) {
        try {
            await remove(ref(db, "users/" + id));
            showToast("Student deleted successfully.", "success");
            loadStudents();
        } catch (e) {
            showToast("Failed to delete.", "error");
        }
    }
}

document.getElementById('saveStudentBtn').addEventListener('click', async () => {
    const id = document.getElementById('studentId').value;
    const uid = id || "std_" + new Date().getTime(); // Simulated UID if created manually
    
    const data = {
        name: document.getElementById('studentName').value.trim(),
        email: document.getElementById('studentEmail').value.trim(),
        rollNo: document.getElementById('studentRollNo').value.trim(),
        department: document.getElementById('studentDept').value,
        year: document.getElementById('studentYear').value,
        section: document.getElementById('studentSection').value,
        role: 'student'
    };
    
    if (!data.name || !data.email || !data.rollNo) {
        showToast("Name, Email, and Roll No are required.", "error");
        return;
    }
    
    const btn = document.getElementById("saveStudentBtn");
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;"></span> Saving...';
    btn.disabled = true;

    try {
        await set(ref(db, "users/" + uid), data);
        showToast("Student saved successfully.", "success");
        modal.classList.remove('active');
        loadStudents();
    } catch (e) {
        showToast("Failed to save student.", "error");
    } finally {
        btn.innerHTML = 'Save Student';
        btn.disabled = false;
    }
});
