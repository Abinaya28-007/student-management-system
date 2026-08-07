import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let assignmentsList = {};
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
        loadAssignments();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

const modal = document.getElementById('assignmentModal');
const closeBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));

document.getElementById('addAssignmentBtn').addEventListener('click', () => {
    document.getElementById('assignmentId').value = '';
    document.getElementById('assignTitle').value = '';
    document.getElementById('assignSubject').value = '';
    document.getElementById('assignDeadline').value = '';
    document.getElementById('assignDesc').value = '';
    document.getElementById('assignmentModalTitle').innerText = 'Create Assignment';
    modal.classList.add('active');
});

// Search
document.getElementById('searchAssignments').addEventListener('input', function(e) {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#assignmentsTableBody tr');
    
    rows.forEach(row => {
        if(row.children.length > 1) {
            const text = row.innerText.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        }
    });
});

async function loadAssignments() {
    const table = document.getElementById("assignmentsTableBody");
    try {
        const snap = await get(ref(db, "assignments"));
        table.innerHTML = "";
        
        if (snap.exists()) {
            assignmentsList = snap.val();
            let arr = [];
            for (const id in assignmentsList) {
                arr.push({ id, ...assignmentsList[id] });
            }
            
            arr.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0));
            
            arr.forEach(rec => {
                // Formatting date nicely
                const dateObj = new Date(rec.deadline);
                const isPast = dateObj < new Date(new Date().toDateString());
                
                table.innerHTML += `
                    <tr>
                        <td><strong>${rec.title}</strong></td>
                        <td>${rec.subject}</td>
                        <td>${rec.dept || 'All'} - ${rec.year || 'All'}</td>
                        <td><span class="badge ${isPast ? 'badge-danger' : 'badge-primary'}">${rec.deadline}</span></td>
                        <td>
                            <div class="flex gap-2">
                                <button onclick="window.editAssignment('${rec.id}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                                <button onclick="window.deleteAssignment('${rec.id}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            if(arr.length === 0) table.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No assignments found.</td></tr>`;
        } else {
            table.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No assignments found.</td></tr>`;
        }
    } catch (e) {
        showToast("Failed to load assignments.", "error");
    }
}

window.editAssignment = function(id) {
    const rec = assignmentsList[id];
    document.getElementById('assignmentId').value = id;
    document.getElementById('assignTitle').value = rec.title;
    document.getElementById('assignSubject').value = rec.subject;
    document.getElementById('assignDept').value = rec.dept || 'Computer Science';
    document.getElementById('assignYear').value = rec.year || 'I';
    document.getElementById('assignDeadline').value = rec.deadline;
    document.getElementById('assignDesc').value = rec.description;
    
    document.getElementById('assignmentModalTitle').innerText = 'Edit Assignment';
    modal.classList.add('active');
}

window.deleteAssignment = async function(id) {
    if (confirm("Delete this assignment?")) {
        try {
            await remove(ref(db, "assignments/" + id));
            showToast("Assignment deleted.", "success");
            loadAssignments();
        } catch (e) {
            showToast("Failed to delete.", "error");
        }
    }
}

document.getElementById('saveAssignmentBtn').addEventListener('click', async () => {
    let id = document.getElementById('assignmentId').value;
    const data = {
        title: document.getElementById('assignTitle').value.trim(),
        subject: document.getElementById('assignSubject').value.trim(),
        dept: document.getElementById('assignDept').value,
        year: document.getElementById('assignYear').value,
        deadline: document.getElementById('assignDeadline').value,
        description: document.getElementById('assignDesc').value.trim(),
        createdBy: facultyUid,
        createdAt: new Date().getTime()
    };
    
    if(!data.title || !data.subject || !data.deadline) {
        showToast("Title, Subject, and Deadline are required.", "error");
        return;
    }
    
    const btn = document.getElementById("saveAssignmentBtn");
    btn.innerHTML = '<span class="loader" style="width:16px;height:16px;border-width:2px;"></span> Saving...';
    btn.disabled = true;

    try {
        if(!id) id = push(ref(db, "assignments")).key;
        else {
            // retain original created at if editing
            data.createdAt = assignmentsList[id].createdAt || data.createdAt;
        }
        await set(ref(db, "assignments/" + id), data);
        showToast("Assignment saved successfully.", "success");
        modal.classList.remove('active');
        loadAssignments();
    } catch (e) {
        showToast("Failed to save assignment.", "error");
    } finally {
        btn.innerHTML = 'Save Assignment';
        btn.disabled = false;
    }
});
