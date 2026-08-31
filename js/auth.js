import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { 
    ref, 
    set, 
    get 
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";
import { showToast, bindMasterDataSelects } from "./common.js";

document.addEventListener("DOMContentLoaded", async () => {
    // Password toggle
    const togglePasswordBtn = document.getElementById("togglePassword");
    const passwordInput = document.getElementById("password");
    if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            togglePasswordBtn.querySelector("i").className = isPassword ? "ri-eye-line" : "ri-eye-off-line";
        });
    }

    // Role toggle on register page
    const roleSelect = document.getElementById("role");
    const studentFields = document.getElementById("studentFieldsSection");
    const facultyFields = document.getElementById("facultyFieldsSection");
    if (roleSelect) {
        const handleRoleChange = () => {
            if (roleSelect.value === "faculty") {
                if (studentFields) studentFields.classList.add("d-none");
                if (facultyFields) facultyFields.classList.remove("d-none");
            } else {
                if (studentFields) studentFields.classList.remove("d-none");
                if (facultyFields) facultyFields.classList.add("d-none");
            }
        };
        roleSelect.addEventListener("change", handleRoleChange);
        handleRoleChange();

        // Populate dropdowns from Master Data
        await bindMasterDataSelects();
    }

    // Login page remember me feature
    const emailInput = document.getElementById("email");
    const rememberCheckbox = document.getElementById("rememberLogin");
    if (emailInput && rememberCheckbox) {
        const savedEmail = localStorage.getItem("eduERP_rememberedEmail");
        if (savedEmail) {
            emailInput.value = savedEmail;
            rememberCheckbox.checked = true;
        }
    }

    // Login Form Action
    const loginBtn = document.getElementById("loginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const email = emailInput ? emailInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";

            if (!email || !password) {
                showToast("Please enter both email and password.", "error");
                return;
            }

            if (rememberCheckbox && rememberCheckbox.checked) {
                localStorage.setItem("eduERP_rememberedEmail", email);
            } else {
                localStorage.removeItem("eduERP_rememberedEmail");
            }

            const originalHtml = loginBtn.innerHTML;
            loginBtn.innerHTML = '<span class="loader"></span> Signing in...';
            loginBtn.disabled = true;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const snapshot = await get(ref(db, `users/${user.uid}`));
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    showToast(`Welcome back, ${data.name || 'User'}! Redirecting...`, "success");
                    setTimeout(() => {
                        window.location.href = data.role === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
                    }, 800);
                } else {
                    showToast("User profile record not found in system.", "error");
                    loginBtn.innerHTML = originalHtml;
                    loginBtn.disabled = false;
                }
            } catch (error) {
                console.error("Login error:", error);
                let friendlyMsg = "Invalid email or password. Please check your credentials.";
                if (error.code === "auth/user-not-found") friendlyMsg = "No account found with this email.";
                if (error.code === "auth/wrong-password") friendlyMsg = "Incorrect password. Please try again.";
                showToast(friendlyMsg, "error");
                loginBtn.innerHTML = originalHtml;
                loginBtn.disabled = false;
            }
        });
    }

    // Register Form Action
    const registerBtn = document.getElementById("registerBtn");
    if (registerBtn) {
        registerBtn.addEventListener("click", async () => {
            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const password = passwordInput ? passwordInput.value : "";
            const role = roleSelect ? roleSelect.value : "student";

            if (!name || !email || !password) {
                showToast("Please fill in all required fields.", "error");
                return;
            }

            const originalHtml = registerBtn.innerHTML;
            registerBtn.innerHTML = '<span class="loader"></span> Creating Account...';
            registerBtn.disabled = true;

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                let userData = {
                    name,
                    email,
                    role,
                    createdAt: new Date().getTime()
                };

                if (role === "student") {
                    userData.rollNo = document.getElementById("rollNo") ? document.getElementById("rollNo").value.trim() : "";
                    userData.department = document.getElementById("department") ? document.getElementById("department").value : "";
                    userData.year = document.getElementById("year") ? document.getElementById("year").value : "";
                    userData.section = document.getElementById("section") ? document.getElementById("section").value : "";
                } else {
                    userData.department = document.getElementById("facultyDept") ? document.getElementById("facultyDept").value : "";
                }

                await set(ref(db, `users/${user.uid}`), userData);

                showToast("Account created successfully! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = role === "faculty" ? "faculty-dashboard.html" : "student-dashboard.html";
                }, 1000);
            } catch (error) {
                console.error("Register error:", error);
                let friendlyMsg = error.message;
                if (error.code === "auth/email-already-in-use") friendlyMsg = "An account with this email already exists.";
                if (error.code === "auth/weak-password") friendlyMsg = "Password should be at least 6 characters long.";
                showToast(friendlyMsg, "error");
                registerBtn.innerHTML = originalHtml;
                registerBtn.disabled = false;
            }
        });
    }
});