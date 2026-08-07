import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "faculty") {
            window.location.href = "index.html";
            return;
        }
        
        const userData = snap.val();
        document.getElementById("userName").innerText = userData.name;
        document.getElementById("welcomeName").innerText = userData.name;
        
        loadDashboardStats();
    } catch (e) {
        console.error(e);
        window.location.href = "index.html";
    }
});

async function loadDashboardStats() {
    try {
        // Load Students
        const studentsSnap = await get(ref(db, "users"));
        let studentCount = 0;
        if (studentsSnap.exists()) {
            const users = studentsSnap.val();
            for (let id in users) {
                if (users[id].role === 'student') studentCount++;
            }
        }
        document.getElementById("totalStudents").innerText = studentCount;

        // Load Assignments
        const assignmentsSnap = await get(ref(db, "assignments"));
        let assignCount = 0;
        if (assignmentsSnap.exists()) {
            assignCount = Object.keys(assignmentsSnap.val()).length;
        }
        document.getElementById("totalAssignments").innerText = assignCount;

        // Load Marks
        const marksSnap = await get(ref(db, "marks"));
        let marksCount = 0;
        if (marksSnap.exists()) {
            marksCount = Object.keys(marksSnap.val()).length;
        }
        document.getElementById("totalMarks").innerText = marksCount;
        
        // Calculate Today's Attendance (Simplified for Dashboard)
        const today = new Date().toISOString().split('T')[0];
        const attSnap = await get(ref(db, `attendance/${today}`));
        if (attSnap.exists()) {
            let present = 0;
            let total = 0;
            const subjects = attSnap.val();
            for (let sub in subjects) {
                for (let studentId in subjects[sub]) {
                    total++;
                    if(subjects[sub][studentId].status === 'present') present++;
                }
            }
            const pct = total === 0 ? 0 : Math.round((present / total) * 100);
            document.getElementById("todayAttendance").innerText = `${pct}%`;
        } else {
            document.getElementById("todayAttendance").innerText = "0%";
        }

    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});
