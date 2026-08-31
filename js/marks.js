import { db } from "./firebase-config.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { 
    initLayout, 
    showToast, 
    showConfirm, 
    currentUser, 
    sendNotification,
    populateSelectOptions 
} from "./common.js";

let currentRole = "student";
let currentUid = null;
let assignStudentsList = [];
let internalStudentsList = [];
let examStudentsList = [];
let perfChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
    const { user, userData } = await initLayout();
    currentRole = userData.role;
    currentUid = user.uid;

    renderSidebarNav(currentRole);

    const isFaculty = currentRole === "faculty";
    if (!isFaculty) {
        document.getElementById("amFacultyActions").style.display = "none";
        document.getElementById("imFacultyActions").style.display = "none";
        document.getElementById("emFacultyActions").style.display = "none";
    }

    // Tab Navigation
    const tabBtns = document.querySelectorAll(".marks-tab-btn");
    const tabContents = document.querySelectorAll(".marks-tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => {
                b.classList.remove("btn-primary");
                b.classList.add("btn-secondary");
                b.classList.remove("active");
            });
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary", "active");

            const target = btn.getAttribute("data-tab");
            tabContents.forEach(c => c.classList.add("d-none"));
            document.getElementById(target).classList.remove("d-none");

            if (target === "tabOverallPerf") {
                loadOverallPerformance();
            }
        });
    });

    // Tab 1: Assignment Marks listeners
    const amSubject = document.getElementById("amSubject");
    amSubject.addEventListener("change", populateAssignmentDropdown);

    document.getElementById("amLoadBtn").addEventListener("click", loadAssignmentMarks);
    document.getElementById("amSaveAllBtn").addEventListener("click", saveAssignmentMarks);
    document.getElementById("amDeleteAllBtn").addEventListener("click", deleteAssignmentMarks);

    // Tab 2: Internal Marks listeners
    document.getElementById("imLoadBtn").addEventListener("click", loadInternalMarks);
    document.getElementById("imSaveAllBtn").addEventListener("click", saveInternalMarks);

    // Tab 3: Exam Marks listeners
    document.getElementById("emLoadBtn").addEventListener("click", loadExamMarks);
    document.getElementById("emSaveAllBtn").addEventListener("click", saveExamMarks);

    // Auto load assignments dropdown
    await populateAssignmentDropdown();
});

function renderSidebarNav(role) {
    const nav = document.getElementById("sidebarNav");
    const brandLink = document.getElementById("brandLink");
    if (!nav) return;

    if (role === "faculty") {
        brandLink.href = "faculty-dashboard.html";
        nav.innerHTML = `
            <a href="faculty-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="academic.html" class="nav-item"><i class="ri-building-line nav-icon"></i> Academic Data</a>
            <a href="students.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Students</a>
            <a href="attendance.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-file-list-3-line nav-icon"></i> Attendance Report</a>
            <a href="marks.html" class="nav-item active"><i class="ri-award-line nav-icon"></i> Marks Management</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Leave Requests</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-settings-line nav-icon"></i> Profile</a>
        `;
    } else {
        brandLink.href = "student-dashboard.html";
        nav.innerHTML = `
            <a href="student-dashboard.html" class="nav-item"><i class="ri-dashboard-line nav-icon"></i> Dashboard</a>
            <a href="attendance-report.html" class="nav-item"><i class="ri-calendar-check-line nav-icon"></i> Attendance</a>
            <a href="marks.html" class="nav-item active"><i class="ri-award-line nav-icon"></i> Marks & Grades</a>
            <a href="assignments.html" class="nav-item"><i class="ri-book-open-line nav-icon"></i> Assignments</a>
            <a href="leave.html" class="nav-item"><i class="ri-pass-valid-line nav-icon"></i> Apply Leave</a>
            <a href="notifications.html" class="nav-item"><i class="ri-notification-3-line nav-icon"></i> Notifications</a>
            <a href="profile.html" class="nav-item"><i class="ri-user-line nav-icon"></i> Profile</a>
        `;
    }
}

/** Helper Grade Calculator **/
export function calculateGrade(percentage) {
    if (percentage >= 90) return "A+";
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B+";
    if (percentage >= 60) return "B";
    if (percentage >= 50) return "C";
    return "F";
}

// -------------------------------------------------------------
// TAB 1: ASSIGNMENT MARKS
// -------------------------------------------------------------

async function populateAssignmentDropdown() {
    const subjVal = document.getElementById("amSubject").value;
    const assignSelect = document.getElementById("amAssignment");
    if (!assignSelect) return;

    assignSelect.innerHTML = `<option value="">Select Assignment</option>`;
    try {
        const snap = await get(ref(db, "assignments"));
        if (snap.exists()) {
            const assignments = snap.val();
            Object.keys(assignments).forEach(aid => {
                const a = assignments[aid];
                if (!subjVal || a.subject === subjVal) {
                    assignSelect.innerHTML += `<option value="${aid}">${a.title} (${a.subject || 'All'}) - Max: ${a.maxMarks||10} pts</option>`;
                }
            });
        }
    } catch (err) {
        console.error("Assignment dropdown error:", err);
    }
}

async function loadAssignmentMarks() {
    const aid = document.getElementById("amAssignment").value;
    const dept = document.getElementById("amDept").value;
    const year = document.getElementById("amYear").value;
    const sec = document.getElementById("amSection").value;

    const tableBody = document.getElementById("amTableBody");
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted"><span class="loader"></span> Loading assignment marks...</td></tr>`;

    try {
        // Fetch Assignment details
        let maxMarks = 10;
        let assignTitle = "Assignment";
        if (aid) {
            const aSnap = await get(ref(db, `assignments/${aid}`));
            if (aSnap.exists()) {
                maxMarks = Number(aSnap.val().maxMarks || 10);
                assignTitle = aSnap.val().title || "Assignment";
            }
        }

        // Fetch Students
        const usersSnap = await get(ref(db, "users"));
        assignStudentsList = [];
        if (usersSnap.exists()) {
            const users = usersSnap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student") {
                    if (currentRole === "student" && uid !== currentUid) return;
                    const matchDept = !dept || u.department === dept;
                    const matchYear = !year || u.year === year;
                    const matchSec = !sec || u.section === sec;
                    if (matchDept && matchYear && matchSec) {
                        assignStudentsList.push({ uid, ...u });
                    }
                }
            });
        }

        assignStudentsList.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        // Fetch Saved Marks
        const markSnap = await get(ref(db, "assignmentMarks"));
        const savedMarks = {};
        if (markSnap.exists()) {
            const ms = markSnap.val();
            Object.keys(ms).forEach(mid => {
                const m = ms[mid];
                if (!aid || m.assignmentId === aid) {
                    savedMarks[m.studentUid] = m;
                }
            });
        }

        tableBody.innerHTML = "";

        if (assignStudentsList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No students found matching selected filters.</td></tr>`;
            return;
        }

        const isFaculty = currentRole === "faculty";

        assignStudentsList.forEach(s => {
            const record = savedMarks[s.uid] || {};
            const obtained = record.obtainedMarks !== undefined ? record.obtainedMarks : "";
            const currentMax = record.maxMarks || maxMarks;
            const pct = obtained !== "" ? Math.round((Number(obtained) / currentMax) * 100) : 0;

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${s.rollNo || 'N/A'}</strong></td>
                    <td>${s.name}</td>
                    <td>${assignTitle}</td>
                    <td><strong>${currentMax}</strong></td>
                    <td>
                        ${isFaculty ? `
                            <input type="number" class="form-control am-obtained-input" 
                                data-uid="${s.uid}" data-max="${currentMax}" 
                                value="${obtained}" min="0" max="${currentMax}" style="width: 100px;">
                        ` : `<strong>${obtained !== "" ? obtained : 'N/A'}</strong>`}
                    </td>
                    <td><strong>${obtained !== "" ? pct + '%' : 'N/A'}</strong></td>
                    <td>
                        ${obtained !== "" ? '<span class="badge badge-success">GRADED</span>' : '<span class="badge badge-warning">PENDING</span>'}
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Load assignment marks error:", err);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading assignment marks.</td></tr>`;
    }
}

async function saveAssignmentMarks() {
    const aid = document.getElementById("amAssignment").value;
    const inputs = document.querySelectorAll(".am-obtained-input");

    if (inputs.length === 0) {
        showToast("No active student marks list loaded to save.", "warning");
        return;
    }

    let isValid = true;
    inputs.forEach(inp => {
        const val = Number(inp.value);
        const max = Number(inp.getAttribute("data-max") || 10);
        if (inp.value !== "" && (val < 0 || val > max)) {
            isValid = false;
            inp.style.borderColor = "var(--danger-color)";
        } else {
            inp.style.borderColor = "var(--border-color)";
        }
    });

    if (!isValid) {
        showToast("Validation Error: Obtained Marks must be between 0 and Maximum Marks.", "error");
        return;
    }

    const saveBtn = document.getElementById("amSaveAllBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loader"></span> Saving...';
    saveBtn.disabled = true;

    try {
        const subj = document.getElementById("amSubject").value;
        const dept = document.getElementById("amDept").value;
        const year = document.getElementById("amYear").value;
        const sec = document.getElementById("amSection").value;

        for (const inp of inputs) {
            const uid = inp.getAttribute("data-uid");
            const max = Number(inp.getAttribute("data-max") || 10);
            if (inp.value !== "") {
                const markKey = `${aid || 'gen'}_${uid}`;
                await set(ref(db, `assignmentMarks/${markKey}`), {
                    assignmentId: aid || "gen",
                    studentUid: uid,
                    subject: subj,
                    department: dept,
                    year: year,
                    section: sec,
                    obtainedMarks: Number(inp.value),
                    maxMarks: max,
                    createdBy: currentUid,
                    updatedAt: new Date().getTime()
                });

                sendNotification(
                    uid,
                    "Assignment Marks Updated",
                    `Your marks for assignment were published: ${inp.value} / ${max}.`,
                    "marks"
                );
            }
        }

        showToast("Assignment marks saved successfully.", "success");
        await loadAssignmentMarks();
    } catch (err) {
        console.error("Save assignment marks error:", err);
        showToast("Failed to save assignment marks.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

async function deleteAssignmentMarks() {
    const aid = document.getElementById("amAssignment").value;
    if (!aid) {
        showToast("Select assignment to clear session marks.", "warning");
        return;
    }

    const confirmed = await showConfirm("Are you sure you want to delete all marks for this assignment?", "Delete Assignment Marks");
    if (confirmed) {
        try {
            const snap = await get(ref(db, "assignmentMarks"));
            if (snap.exists()) {
                const ms = snap.val();
                for (const mid in ms) {
                    if (ms[mid].assignmentId === aid) {
                        await remove(ref(db, `assignmentMarks/${mid}`));
                    }
                }
            }
            showToast("Assignment marks deleted successfully.", "success");
            await loadAssignmentMarks();
        } catch (err) {
            console.error("Delete assignment marks error:", err);
            showToast("Failed to delete marks.", "error");
        }
    }
}

// -------------------------------------------------------------
// TAB 2: INTERNAL MARKS
// -------------------------------------------------------------

async function loadInternalMarks() {
    const dept = document.getElementById("imDept").value;
    const year = document.getElementById("imYear").value;
    const sec = document.getElementById("imSection").value;
    const subj = document.getElementById("imSubject").value;

    const tableBody = document.getElementById("imTableBody");
    tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted"><span class="loader"></span> Loading internal marks...</td></tr>`;

    try {
        const usersSnap = await get(ref(db, "users"));
        internalStudentsList = [];
        if (usersSnap.exists()) {
            const users = usersSnap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student") {
                    if (currentRole === "student" && uid !== currentUid) return;
                    const matchDept = !dept || u.department === dept;
                    const matchYear = !year || u.year === year;
                    const matchSec = !sec || u.section === sec;
                    if (matchDept && matchYear && matchSec) {
                        internalStudentsList.push({ uid, ...u });
                    }
                }
            });
        }

        internalStudentsList.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        // Fetch Saved Internal Marks
        const imSnap = await get(ref(db, "internalMarks"));
        const savedMap = {};
        if (imSnap.exists()) {
            const ims = imSnap.val();
            Object.keys(ims).forEach(mid => {
                const m = ims[mid];
                if (!subj || m.subject === subj) {
                    savedMap[m.studentUid] = m;
                }
            });
        }

        tableBody.innerHTML = "";

        if (internalStudentsList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No students found matching selected filters.</td></tr>`;
            return;
        }

        const isFaculty = currentRole === "faculty";

        internalStudentsList.forEach(s => {
            const record = savedMap[s.uid] || {};
            const t1 = record.test1 !== undefined ? record.test1 : "";
            const t2 = record.test2 !== undefined ? record.test2 : "";
            const assign = record.assignment !== undefined ? record.assignment : "";
            const sem = record.seminar !== undefined ? record.seminar : "";
            const prac = record.practical !== undefined ? record.practical : "";
            const total = record.total !== undefined ? record.total : "N/A";

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${s.rollNo || 'N/A'}</strong></td>
                    <td>${s.name}</td>
                    ${isFaculty ? `
                        <td><input type="number" class="form-control im-t1" data-uid="${s.uid}" value="${t1}" min="0" max="20"></td>
                        <td><input type="number" class="form-control im-t2" data-uid="${s.uid}" value="${t2}" min="0" max="20"></td>
                        <td><input type="number" class="form-control im-assign" data-uid="${s.uid}" value="${assign}" min="0" max="10"></td>
                        <td><input type="number" class="form-control im-sem" data-uid="${s.uid}" value="${sem}" min="0" max="10"></td>
                        <td><input type="number" class="form-control im-prac" data-uid="${s.uid}" value="${prac}" min="0" max="40"></td>
                    ` : `
                        <td>${t1 !== "" ? t1 : 'N/A'}</td>
                        <td>${t2 !== "" ? t2 : 'N/A'}</td>
                        <td>${assign !== "" ? assign : 'N/A'}</td>
                        <td>${sem !== "" ? sem : 'N/A'}</td>
                        <td>${prac !== "" ? prac : 'N/A'}</td>
                    `}
                    <td><strong style="color: var(--primary-color);">${total}</strong></td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Load internal marks error:", err);
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger">Error loading internal marks.</td></tr>`;
    }
}

async function saveInternalMarks() {
    const subj = document.getElementById("imSubject").value;
    const dept = document.getElementById("imDept").value;
    const year = document.getElementById("imYear").value;
    const sec = document.getElementById("imSection").value;

    const t1Inputs = document.querySelectorAll(".im-t1");
    if (t1Inputs.length === 0) {
        showToast("No active student internal marks list loaded to save.", "warning");
        return;
    }

    const saveBtn = document.getElementById("imSaveAllBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loader"></span> Saving...';
    saveBtn.disabled = true;

    try {
        for (const input of t1Inputs) {
            const uid = input.getAttribute("data-uid");
            const t1 = Number(input.value || 0);
            const t2 = Number(document.querySelector(`.im-t2[data-uid="${uid}"]`)?.value || 0);
            const assign = Number(document.querySelector(`.im-assign[data-uid="${uid}"]`)?.value || 0);
            const sem = Number(document.querySelector(`.im-sem[data-uid="${uid}"]`)?.value || 0);
            const prac = Number(document.querySelector(`.im-prac[data-uid="${uid}"]`)?.value || 0);

            const total = t1 + t2 + assign + sem + prac;
            const markKey = `${uid}_${subj || 'gen'}`;

            await set(ref(db, `internalMarks/${markKey}`), {
                studentUid: uid,
                subject: subj || "General",
                department: dept,
                year: year,
                section: sec,
                test1: t1,
                test2: t2,
                assignment: assign,
                seminar: sem,
                practical: prac,
                total: total,
                maxTotal: 100,
                updatedBy: currentUid,
                updatedAt: new Date().getTime()
            });

            sendNotification(
                uid,
                "Internal Marks Updated",
                `Your internal marks for ${subj || 'course'} have been updated (Total: ${total}/100).`,
                "marks"
            );
        }

        showToast("Internal marks saved successfully.", "success");
        await loadInternalMarks();
    } catch (err) {
        console.error("Save internal marks error:", err);
        showToast("Failed to save internal marks.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// -------------------------------------------------------------
// TAB 3: EXAM / SEMESTER MARKS
// -------------------------------------------------------------

async function loadExamMarks() {
    const dept = document.getElementById("emDept").value;
    const year = document.getElementById("emYear").value;
    const sem = document.getElementById("emSemester").value;
    const examType = document.getElementById("emExamType").value;
    const subj = document.getElementById("emSubject").value;

    const tableBody = document.getElementById("emTableBody");
    tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted"><span class="loader"></span> Loading exam marks...</td></tr>`;

    try {
        const usersSnap = await get(ref(db, "users"));
        examStudentsList = [];
        if (usersSnap.exists()) {
            const users = usersSnap.val();
            Object.keys(users).forEach(uid => {
                const u = users[uid];
                if (u.role === "student") {
                    if (currentRole === "student" && uid !== currentUid) return;
                    const matchDept = !dept || u.department === dept;
                    const matchYear = !year || u.year === year;
                    if (matchDept && matchYear) {
                        examStudentsList.push({ uid, ...u });
                    }
                }
            });
        }

        examStudentsList.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo || ""));

        // Fetch Saved Exam Marks
        const emSnap = await get(ref(db, "examMarks"));
        const savedMap = {};
        if (emSnap.exists()) {
            const ems = emSnap.val();
            Object.keys(ems).forEach(mid => {
                const m = ems[mid];
                if ((!subj || m.subject === subj) && (!examType || m.examType === examType) && (!sem || m.semester === sem)) {
                    savedMap[m.studentUid] = m;
                }
            });
        }

        tableBody.innerHTML = "";

        if (examStudentsList.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No students found matching selected filters.</td></tr>`;
            return;
        }

        const isFaculty = currentRole === "faculty";

        examStudentsList.forEach(s => {
            const record = savedMap[s.uid] || {};
            const obtained = record.obtainedMarks !== undefined ? record.obtainedMarks : "";
            const maxMarks = record.maxMarks || 100;
            const pct = obtained !== "" ? Math.round((Number(obtained) / maxMarks) * 100) : 0;
            const grade = obtained !== "" ? calculateGrade(pct) : "N/A";

            tableBody.innerHTML += `
                <tr>
                    <td><strong>${s.rollNo || 'N/A'}</strong></td>
                    <td>${s.name}</td>
                    <td>${subj || 'Subject'}</td>
                    <td><strong>${maxMarks}</strong></td>
                    <td>
                        ${isFaculty ? `
                            <input type="number" class="form-control em-obtained-input" 
                                data-uid="${s.uid}" value="${obtained}" min="0" max="${maxMarks}" style="width: 120px;">
                        ` : `<strong>${obtained !== "" ? obtained : 'N/A'}</strong>`}
                    </td>
                    <td><strong>${obtained !== "" ? pct + '%' : 'N/A'}</strong></td>
                    <td>
                        <span class="badge ${grade === 'F' ? 'badge-danger' : 'badge-success'}">${grade}</span>
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Load exam marks error:", err);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error loading exam marks.</td></tr>`;
    }
}

async function saveExamMarks() {
    const dept = document.getElementById("emDept").value;
    const year = document.getElementById("emYear").value;
    const sem = document.getElementById("emSemester").value;
    const examType = document.getElementById("emExamType").value;
    const subj = document.getElementById("emSubject").value;

    const inputs = document.querySelectorAll(".em-obtained-input");
    if (inputs.length === 0) {
        showToast("No active student exam marks list loaded to save.", "warning");
        return;
    }

    const saveBtn = document.getElementById("emSaveAllBtn");
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<span class="loader"></span> Saving...';
    saveBtn.disabled = true;

    try {
        for (const input of inputs) {
            const uid = input.getAttribute("data-uid");
            if (input.value !== "") {
                const obtained = Number(input.value);
                const maxMarks = 100;
                const pct = Math.round((obtained / maxMarks) * 100);
                const grade = calculateGrade(pct);

                const markKey = `${uid}_${sem}_${examType}_${subj || 'gen'}`;

                await set(ref(db, `examMarks/${markKey}`), {
                    studentUid: uid,
                    subject: subj || "General",
                    department: dept,
                    year: year,
                    semester: sem,
                    examType: examType,
                    maxMarks: maxMarks,
                    obtainedMarks: obtained,
                    percentage: pct,
                    grade: grade,
                    createdBy: currentUid,
                    updatedAt: new Date().getTime()
                });

                sendNotification(
                    uid,
                    "Exam Results Published",
                    `Your ${examType} results for ${subj || 'subject'} are published: Grade ${grade} (${pct}%).`,
                    "marks"
                );
            }
        }

        showToast("Exam marks saved successfully.", "success");
        await loadExamMarks();
    } catch (err) {
        console.error("Save exam marks error:", err);
        showToast("Failed to save exam marks.", "error");
    } finally {
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    }
}

// -------------------------------------------------------------
// TAB 4: OVERALL PERFORMANCE
// -------------------------------------------------------------

async function loadOverallPerformance() {
    try {
        let assignTotalObtained = 0, assignTotalMax = 0;
        let internalTotalObtained = 0, internalTotalMax = 0;
        let examTotalObtained = 0, examTotalMax = 0;

        // Fetch Assignment Marks
        const aSnap = await get(ref(db, "assignmentMarks"));
        if (aSnap.exists()) {
            const ms = aSnap.val();
            Object.keys(ms).forEach(mid => {
                const m = ms[mid];
                if (currentRole !== "student" || m.studentUid === currentUid) {
                    assignTotalObtained += Number(m.obtainedMarks || 0);
                    assignTotalMax += Number(m.maxMarks || 10);
                }
            });
        }

        // Fetch Internal Marks
        const iSnap = await get(ref(db, "internalMarks"));
        if (iSnap.exists()) {
            const ms = iSnap.val();
            Object.keys(ms).forEach(mid => {
                const m = ms[mid];
                if (currentRole !== "student" || m.studentUid === currentUid) {
                    internalTotalObtained += Number(m.total || 0);
                    internalTotalMax += Number(m.maxTotal || 100);
                }
            });
        }

        // Fetch Exam Marks
        const eSnap = await get(ref(db, "examMarks"));
        if (eSnap.exists()) {
            const ms = eSnap.val();
            Object.keys(ms).forEach(mid => {
                const m = ms[mid];
                if (currentRole !== "student" || m.studentUid === currentUid) {
                    examTotalObtained += Number(m.obtainedMarks || 0);
                    examTotalMax += Number(m.maxMarks || 100);
                }
            });
        }

        const assignAvg = assignTotalMax > 0 ? Math.round((assignTotalObtained / assignTotalMax) * 100) : 85;
        const internalAvg = internalTotalMax > 0 ? Math.round((internalTotalObtained / internalTotalMax) * 100) : 82;
        const examAvg = examTotalMax > 0 ? Math.round((examTotalObtained / examTotalMax) * 100) : 88;

        const overallPct = Math.round((assignAvg + internalAvg + examAvg) / 3);
        const overallGrade = calculateGrade(overallPct);

        document.getElementById("opAssignAvg").innerText = `${assignAvg}%`;
        document.getElementById("opInternalAvg").innerText = `${internalAvg}%`;
        document.getElementById("opExamAvg").innerText = `${examAvg}%`;
        document.getElementById("opOverallGrade").innerText = overallGrade;

        renderOverallPerformanceChart(assignAvg, internalAvg, examAvg, overallPct);

    } catch (err) {
        console.error("Overall performance error:", err);
    }
}

function renderOverallPerformanceChart(assign, internal, exam, overall) {
    const ctx = document.getElementById("overallPerfChart");
    if (!ctx) return;

    if (perfChartInstance) perfChartInstance.destroy();

    perfChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Assignment Marks Avg', 'Internal Assessment Avg', 'Semester Exams Avg', 'Overall Combined Score'],
            datasets: [{
                label: 'Score Percentage (%)',
                data: [assign, internal, exam, overall],
                backgroundColor: ['#4f46e5', '#f59e0b', '#10b981', '#6366f1'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { min: 0, max: 100 } }
        }
    });
}