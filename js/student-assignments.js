import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let studentData = null;
let assignmentsList = {};

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "student") {
            window.location.href = "index.html"; return;
        }
        studentData = snap.val();
        loadAssignments();
    } catch (e) {
        window.location.href = "index.html";
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});

// Modal
const modal = document.getElementById('viewAssignmentModal');
const closeBtns = document.querySelectorAll('.modal-close, .modal-close-btn');
closeBtns.forEach(btn => btn.addEventListener('click', () => modal.classList.remove('active')));

window.viewAssignment = function(id) {
    const rec = assignmentsList[id];
    document.getElementById('viewTitle').innerText = rec.title;
    document.getElementById('viewSubject').innerText = rec.subject;
    document.getElementById('viewDeadline').innerText = "Due: " + rec.deadline;
    document.getElementById('viewDesc').innerText = rec.description || 'No description provided.';
    modal.classList.add('active');
}

async function loadAssignments() {
    const container = document.getElementById("assignmentsContainer");
    try {
        const snap = await get(ref(db, "assignments"));
        container.innerHTML = "";
        
        if (snap.exists()) {
            assignmentsList = snap.val();
            let arr = [];
            
            for (const id in assignmentsList) {
                const rec = assignmentsList[id];
                // Filter assignments by student's dept and year, or 'All'
                const matchDept = rec.dept === 'All' || rec.dept === studentData.department;
                const matchYear = rec.year === 'All' || rec.year === studentData.year;
                
                if (matchDept && matchYear) {
                    arr.push({ id, ...rec });
                }
            }
            
            arr.sort((a,b) => new Date(a.deadline) - new Date(b.deadline));
            
            if (arr.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="ri-check-double-line empty-state-icon text-success"></i>
                        <h3>All Caught Up!</h3>
                        <p>You have no pending assignments for your class.</p>
                    </div>
                `;
                return;
            }

            // Grouping or simply listing them
            const ul = document.createElement("ul");
            ul.style.listStyle = "none";
            ul.style.padding = "0";
            ul.style.margin = "0";
            
            const today = new Date();
            today.setHours(0,0,0,0);

            arr.forEach(rec => {
                const deadlineDate = new Date(rec.deadline);
                const isPast = deadlineDate < today;
                
                let iconClass = isPast ? "ri-error-warning-line text-danger" : "ri-file-list-3-line text-primary";
                let badgeClass = isPast ? "badge-danger" : "badge-primary";
                let textStatus = isPast ? "Overdue" : "Pending";

                const li = document.createElement("li");
                li.style.padding = "1.5rem";
                li.style.borderBottom = "1px solid var(--border-color)";
                li.style.display = "flex";
                li.style.justifyContent = "space-between";
                li.style.alignItems = "center";
                
                li.innerHTML = `
                    <div class="flex gap-3 items-center">
                        <div style="font-size: 2rem; opacity: 0.8;"><i class="${iconClass}"></i></div>
                        <div>
                            <h4 style="margin: 0; font-size: 1.1rem; color: var(--secondary-color);">${rec.title}</h4>
                            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">${rec.subject}</p>
                            <span class="badge ${badgeClass} mt-1">${textStatus}: ${rec.deadline}</span>
                        </div>
                    </div>
                    <button class="btn btn-secondary" onclick="window.viewAssignment('${rec.id}')">View Details</button>
                `;
                ul.appendChild(li);
            });
            container.appendChild(ul);

        } else {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="ri-check-double-line empty-state-icon text-success"></i>
                    <h3>All Caught Up!</h3>
                    <p>You have no pending assignments.</p>
                </div>
            `;
        }
    } catch (e) {
        container.innerHTML = `<p class="text-danger" style="padding: 1.5rem;">Error loading assignments.</p>`;
    }
}
