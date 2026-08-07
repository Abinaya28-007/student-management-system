/**
 * toast.js - Shared toast notification helper
 * Usage: import { showToast } from "./toast.js";
 */
export function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

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

    // Auto-remove
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
