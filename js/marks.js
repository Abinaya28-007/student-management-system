import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let studentsList = {};
let marksList = {};
let facultyUid = null;

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
        facultyUid = user.uid;
        await loadGlobalStudents();
        loadMarks();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// Modal Logic
const modal = document.getElementById('marksModal');
const closeBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));

document.getElementById('addMarkBtn').addEventListener('click', () => {
    document.getElementById('markId').value = '';
    document.getElementById('markSubject').value = '';
    document.getElementById('markExam').value = '';
    document.getElementById('markValue').value = '';
    document.getElementById('markMax').value = '100';
    document.getElementById('markStudent').innerHTML = '<option value="">-- Load students first --</option>';
    document.getElementById('marksModalTitle').innerText = 'Add Mark';
    modal.classList.add('active');
});

// Search
document.getElementById('searchMarks').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#marksTableBody tr');
    
    rows.forEach(row => {
        if(row.children.length > 1) {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        }
    });
});

async function loadGlobalStudents() {
    const snap = await get(ref(db, "users"));
    if (snap.exists()) {
        const data = snap.val();
        for (const id in data) {
            if (data[id].role === "student") {
                studentsList[id] = data[id];
            }
        }
    }
}

document.getElementById('loadStudentsBtn').addEventListener('click', () => {
    const dept = document.getElementById('filterDept').value;
    const year = document.getElementById('filterYear').value;
    const sec = document.getElementById('filterSection').value;
    
    const select = document.getElementById('markStudent');
    select.innerHTML = '<option value="">-- Select Student --</option>';
    
    let count = 0;
    for (let id in studentsList) {
        const s = studentsList[id];
        if (s.department === dept && s.year === year && s.section === sec) {
            select.innerHTML += `<option value="${id}">${s.rollNo} - ${s.name}</option>`;
            count++;
        }
    }
    if (count === 0) showToast("No students found for this class", "error");
    else showToast(`Loaded ${count} students`, "success");
});

async function loadMarks() {
    const table = document.getElementById("marksTableBody");
    try {
        const snap = await get(ref(db, "marks"));
        table.innerHTML = "";
        
        if (snap.exists()) {
            marksList = snap.val();
            let hasData = false;
            
            // Sort marks logically (by subject or student, will just output)
            for (const id in marksList) {
                hasData = true;
                const rec = marksList[id];
                const student = studentsList[rec.studentId] || { name: 'Unknown', rollNo: 'N/A' };
                
                table.innerHTML += `
                    <tr>
                        <td><strong>${student.rollNo}</strong></td>
                        <td>${student.name}</td>
                        <td>${rec.subject}</td>
                        <td>${rec.exam}</td>
                        <td><span style="font-weight:600; color:var(--primary-color)">${rec.mark}</span></td>
                        <td>${rec.maxMark || 100}</td>
                        <td>
                            <div class="flex gap-2">
                                <button onclick="window.editMark('${id}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                                <button onclick="window.deleteMark('${id}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            }
            if (!hasData) table.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No marks records found.</td></tr>`;
        } else {
            table.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No marks records found.</td></tr>`;
        }
    } catch (e) {
        showToast("Failed to load marks.", "error");
    }
}

window.editMark = function(id) {
    const rec = marksList[id];
    document.getElementById('markId').value = id;
    
    const select = document.getElementById('markStudent');
    const student = studentsList[rec.studentId];
    if (student) {
        select.innerHTML = `<option value="${rec.studentId}">${student.rollNo} - ${student.name}</option>`;
    } else {
        select.innerHTML = `<option value="${rec.studentId}">Unknown Student</option>`;
    }
    
    document.getElementById('markSubject').value = rec.subject;
    document.getElementById('markExam').value = rec.exam;
    document.getElementById('markValue').value = rec.mark;
    document.getElementById('markMax').value = rec.maxMark || 100;
    
    document.getElementById('marksModalTitle').innerText = 'Edit Mark';
    modal.classList.add('active');
}

window.deleteMark = async function(id) {
    if (confirm("Delete this mark?")) {
        try {
            await remove(ref(db, "marks/" + id));
            showToast("Mark deleted.", "success");
            loadMarks();
        } catch (e) {
            showToast("Failed to delete.", "error");
        }
    }
}

document.getElementById('saveMarkBtn').addEventListener('click', async () => {
    let id = document.getElementById('markId').value;
    const data = {
        studentId: document.getElementById('markStudent').value,
        subject: document.getElementById('markSubject').value.trim(),
        exam: document.getElementById('markExam').value.trim(),
        mark: document.getElementById('markValue').value,
        maxMark: document.getElementById('markMax').value,
        createdBy: facultyUid,
        timestamp: new Date().getTime()
    };
    
    if(!data.studentId || !data.subject || !data.exam || !data.mark) {
        showToast("Please fill all fields.", "error");
        return;
    }
    
    const btn = document.getElementById("saveMarkBtn");
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;"></span> Saving...';
    btn.disabled = true;

    try {
        if(!id) id = push(ref(db, "marks")).key;
        await set(ref(db, "marks/" + id), data);
        showToast("Mark saved successfully.", "success");
        modal.classList.remove('active');
        loadMarks();
    } catch (e) {
        showToast("Failed to save mark.", "error");
    } finally {
        btn.innerHTML = 'Save Mark';
        btn.disabled = false;
    }
});