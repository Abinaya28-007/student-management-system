import { auth, db } from "./firebase-config.js";
import { showToast } from "./toast.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let assignmentData = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    const table = document.getElementById("assignmentTable");
    const searchInput = document.getElementById("searchInput");

    try {
        const snapshot = await get(ref(db, "assignments"));
        table.innerHTML = "";
        
        if (!snapshot.exists()) {
            table.innerHTML = `<tr><td colspan="5" style="text-align:center;">No assignments available.</td></tr>`;
            return;
        }

        const data = snapshot.val();
        
        for (const id in data) {
            assignmentData.push(data[id]);
        }

        renderTable(assignmentData);

        if (assignmentData.length === 0) {
            table.innerHTML = `<tr><td colspan="5" style="text-align:center;">No assignments available.</td></tr>`;
        }
        
        // Search
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = assignmentData.filter(item => 
                (item.title && item.title.toLowerCase().includes(query)) || 
                (item.subject && item.subject.toLowerCase().includes(query))
            );
            renderTable(filtered);
            if (filtered.length === 0) {
                table.innerHTML = `<tr><td colspan="5" style="text-align:center;">No matching records.</td></tr>`;
            }
        });

    } catch (error) {
        console.error(error);
        table.innerHTML = `<tr><td colspan="5" style="text-align:center;">Error loading assignments.</td></tr>`;
        showToast("Error loading assignments.", "error");
    }
});

function renderTable(data) {
    const table = document.getElementById("assignmentTable");
    table.innerHTML = "";
    const today = new Date();
    today.setHours(0,0,0,0);

    data.forEach(assignment => {
        let deadlineDate = new Date(assignment.deadline);
        let statusBadge = '';
        
        if (deadlineDate < today) {
            statusBadge = `<span class="badge badge-danger">Overdue</span>`;
        } else {
            statusBadge = `<span class="badge badge-primary">Active</span>`;
        }

        table.innerHTML += `
            <tr>
                <td><strong>${assignment.title}</strong></td>
                <td>${assignment.subject}</td>
                <td>${assignment.deadline}</td>
                <td>${assignment.description}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "index.html";
    });
}