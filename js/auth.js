import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { 
    ref, 
    set, 
    get 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

// Basic Toast implementation for auth (standalone)
function showToast(message, type = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ri-check-line";
    if (type === "error") icon = "ri-error-warning-line";
    if (type === "warning") icon = "ri-alert-line";
    
    toast.innerHTML = `
        <i class="${icon} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add("show"), 10);
    
    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

if (registerBtn) {
    registerBtn.addEventListener("click", async () => {
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const role = document.getElementById("role").value;
        
        const rollNo = document.getElementById("rollNo") ? document.getElementById("rollNo").value.trim() : "";
        const department = document.getElementById("department") ? document.getElementById("department").value : "";
        const year = document.getElementById("year") ? document.getElementById("year").value : "";
        const section = document.getElementById("section") ? document.getElementById("section").value : "";

        if (!name || !email || !password) {
            showToast("Please fill all required fields.", "error");
            return;
        }

        const originalText = registerBtn.innerHTML;
        registerBtn.innerHTML = '<span class="loader"></span> Registering...';
        registerBtn.disabled = true;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            const userData = {
                name: name,
                email: email,
                role: role,
                rollNo: rollNo,
                department: department,
                year: year,
                section: section,
                createdAt: new Date().getTime()
            };

            await set(ref(db, "users/" + user.uid), userData);

            showToast("Registration successful! Redirecting...", "success");

            setTimeout(() => {
                if (role === 'faculty') {
                    window.location.href = "faculty-dashboard.html";
                } else {
                    window.location.href = "student-dashboard.html";
                }
            }, 1500);

        } catch (error) {
            console.error(error);
            showToast(error.message, "error");
            registerBtn.innerHTML = originalText;
            registerBtn.disabled = false;
        }
    });
}

if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        if (!email || !password) {
            showToast("Please enter email and password.", "error");
            return;
        }

        const originalText = loginBtn.innerHTML;
        loginBtn.innerHTML = '<span class="loader"></span> Signing in...';
        loginBtn.disabled = true;

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Fetch user role
            const snapshot = await get(ref(db, "users/" + user.uid));
            if (snapshot.exists()) {
                const data = snapshot.val();
                showToast("Login successful!", "success");
                
                setTimeout(() => {
                    if (data.role === 'faculty') {
                        window.location.href = "faculty-dashboard.html";
                    } else {
                        window.location.href = "student-dashboard.html";
                    }
                }, 1000);
            } else {
                showToast("User record not found in database.", "error");
                loginBtn.innerHTML = originalText;
                loginBtn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showToast("Invalid credentials. Please try again.", "error");
            loginBtn.innerHTML = originalText;
            loginBtn.disabled = false;
        }
    });
}