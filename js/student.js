import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let currentStudent = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }
    
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "student") {
            window.location.href = "index.html";
            return;
        }
        
        currentStudent = snap.val();
        currentStudent.uid = user.uid;
        
        document.getElementById("userName").innerText = currentStudent.name;
        document.getElementById("userDept").innerText = `${currentStudent.department} (Yr ${currentStudent.year} - Sec ${currentStudent.section})`;
        document.getElementById("welcomeName").innerText = currentStudent.name.split(' ')[0];
        document.getElementById("welcomeDetails").innerText = `Roll No: ${currentStudent.rollNo} | ${currentStudent.department}`;
        
        loadDashboardStats();
    } catch (e) {
        console.error(e);
        window.location.href = "index.html";
    }
});

async function loadDashboardStats() {
    try {
        // Load Assignments
        const assignmentsSnap = await get(ref(db, "assignments"));
        let assignCount = 0;
        if (assignmentsSnap.exists()) {
            assignCount = Object.keys(assignmentsSnap.val()).length;
        }
        document.getElementById("pendingAssignments").innerText = assignCount;

        // Load Marks
        const marksSnap = await get(ref(db, "marks"));
        if (marksSnap.exists()) {
            let totalMarks = 0;
            let count = 0;
            const marksData = marksSnap.val();
            for (let id in marksData) {
                if (marksData[id].studentId === currentStudent.uid) {
                    totalMarks += Number(marksData[id].mark);
                    count++;
                }
            }
            if (count > 0) {
                document.getElementById("avgMarks").innerText = `${Math.round(totalMarks / count)}%`;
            } else {
                document.getElementById("avgMarks").innerText = "N/A";
            }
        } else {
            document.getElementById("avgMarks").innerText = "N/A";
        }
        
        // Load Overall Attendance
        const attSnap = await get(ref(db, `attendance`));
        if (attSnap.exists()) {
            let present = 0;
            let total = 0;
            const attData = attSnap.val();
            
            // Loop through dates
            for (let date in attData) {
                // Loop through subjects
                for (let sub in attData[date]) {
                    if (attData[date][sub][currentStudent.uid]) {
                        total++;
                        if (attData[date][sub][currentStudent.uid].status === 'present') {
                            present++;
                        }
                    }
                }
            }
            
            const pct = total === 0 ? 0 : Math.round((present / total) * 100);
            document.getElementById("overallAttendance").innerText = `${pct}%`;
        } else {
            document.getElementById("overallAttendance").innerText = "0%";
        }

    } catch (e) {
        console.error("Error loading stats:", e);
    }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});