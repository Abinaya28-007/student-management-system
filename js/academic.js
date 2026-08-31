import { db } from "./firebase-config.js";
import { ref, get, set, remove, push } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { 
    initLayout, 
    showToast, 
    showConfirm, 
    fetchMasterData, 
    masterDataCache,
    populateSelectOptions 
} from "./common.js";
import { ref as dbRef, get as dbGet, set as dbSet, remove as dbRemove, push as dbPush } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

let currentCategory = "departments";

document.addEventListener("DOMContentLoaded", async () => {
    await initLayout("faculty");

    // Tab Switching
    const tabBtns = document.querySelectorAll(".master-tab-btn");
    const tabContents = document.querySelectorAll(".master-tab-content");

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            tabBtns.forEach(b => {
                b.classList.remove("btn-primary");
                b.classList.add("btn-secondary");
                b.classList.remove("active");
            });
            btn.classList.remove("btn-secondary");
            btn.classList.add("btn-primary", "active");

            const targetTab = btn.getAttribute("data-tab");
            tabContents.forEach(c => c.classList.add("d-none"));
            document.getElementById(targetTab).classList.remove("d-none");

            if (targetTab === "deptsTab") currentCategory = "departments";
            else if (targetTab === "yearsTab") currentCategory = "years";
            else if (targetTab === "sectionsTab") currentCategory = "sections";
            else if (targetTab === "subjectsTab") currentCategory = "subjects";
        });
    });

    // Render Master Data Tables
    await renderAllMasterTables();

    // Modal Control
    const modal = document.getElementById("masterModal");
    const addBtn = document.getElementById("addMasterItemBtn");
    const closeBtns = [document.getElementById("closeMasterModal"), document.getElementById("cancelMasterModal")];

    addBtn.addEventListener("click", () => {
        openMasterModal();
    });

    closeBtns.forEach(btn => {
        if (btn) btn.addEventListener("click", () => modal.classList.remove("active"));
    });

    // Save Master Item
    document.getElementById("saveMasterItemBtn").addEventListener("click", async () => {
        const key = document.getElementById("masterItemKey").value;
        const category = document.getElementById("masterItemCategory").value;
        const name = document.getElementById("masterItemName").value.trim();
        const code = document.getElementById("masterItemCode").value.trim();

        if (!name) {
            showToast("Title/Name is required.", "error");
            return;
        }

        const data = { name, code };
        if (category === "subjects") {
            data.department = document.getElementById("subjectDept").value;
            data.year = document.getElementById("subjectYear").value;
        }

        const saveBtn = document.getElementById("saveMasterItemBtn");
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="loader"></span> Saving...';
        saveBtn.disabled = true;

        try {
            if (key) {
                await dbSet(dbRef(db, `masterData/${category}/${key}`), data);
                showToast("Master data record updated successfully.", "success");
            } else {
                const newRef = dbPush(dbRef(db, `masterData/${category}`));
                await dbSet(newRef, data);
                showToast("New master data record added successfully.", "success");
            }

            modal.classList.remove("active");
            await renderAllMasterTables();
        } catch (err) {
            console.error("Save master error:", err);
            showToast("Failed to save master data.", "error");
        } finally {
            saveBtn.innerHTML = originalText;
            saveBtn.disabled = false;
        }
    });
});

async function renderAllMasterTables() {
    await fetchMasterData();

    // Render Departments Table
    const deptsBody = document.getElementById("deptsTableBody");
    const depts = masterDataCache.departments || {};
    deptsBody.innerHTML = "";
    const deptKeys = Object.keys(depts);
    if (deptKeys.length === 0) {
        deptsBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No departments created.</td></tr>`;
    } else {
        deptKeys.forEach(k => {
            const d = depts[k];
            deptsBody.innerHTML += `
                <tr>
                    <td><span class="badge badge-primary">${d.code || 'N/A'}</span></td>
                    <td><strong>${d.name}</strong></td>
                    <td style="text-align: right;">
                        <button onclick="window.editMasterItem('departments', '${k}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                        <button onclick="window.deleteMasterItem('departments', '${k}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    // Render Years Table
    const yearsBody = document.getElementById("yearsTableBody");
    const years = masterDataCache.years || {};
    yearsBody.innerHTML = "";
    const yearKeys = Object.keys(years);
    if (yearKeys.length === 0) {
        yearsBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No academic years created.</td></tr>`;
    } else {
        yearKeys.forEach(k => {
            const y = years[k];
            yearsBody.innerHTML += `
                <tr>
                    <td><span class="badge badge-warning">${y.code || 'N/A'}</span></td>
                    <td><strong>${y.name}</strong></td>
                    <td style="text-align: right;">
                        <button onclick="window.editMasterItem('years', '${k}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                        <button onclick="window.deleteMasterItem('years', '${k}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    // Render Sections Table
    const secBody = document.getElementById("sectionsTableBody");
    const secs = masterDataCache.sections || {};
    secBody.innerHTML = "";
    const secKeys = Object.keys(secs);
    if (secKeys.length === 0) {
        secBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No sections created.</td></tr>`;
    } else {
        secKeys.forEach(k => {
            const s = secs[k];
            secBody.innerHTML += `
                <tr>
                    <td><span class="badge badge-success">${s.code || 'N/A'}</span></td>
                    <td><strong>${s.name}</strong></td>
                    <td style="text-align: right;">
                        <button onclick="window.editMasterItem('sections', '${k}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                        <button onclick="window.deleteMasterItem('sections', '${k}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                    </td>
                </tr>
            `;
        });
    }

    // Render Subjects Table
    const subjBody = document.getElementById("subjectsTableBody");
    const subjs = masterDataCache.subjects || {};
    subjBody.innerHTML = "";
    const subjKeys = Object.keys(subjs);
    if (subjKeys.length === 0) {
        subjBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No subjects created.</td></tr>`;
    } else {
        subjKeys.forEach(k => {
            const sj = subjs[k];
            subjBody.innerHTML += `
                <tr>
                    <td><span class="badge badge-primary">${sj.code || 'N/A'}</span></td>
                    <td><strong>${sj.name}</strong></td>
                    <td>${sj.department || 'All'}</td>
                    <td>${sj.year || 'All'}</td>
                    <td style="text-align: right;">
                        <button onclick="window.editMasterItem('subjects', '${k}')" class="btn btn-secondary btn-icon" title="Edit"><i class="ri-edit-line text-primary"></i></button>
                        <button onclick="window.deleteMasterItem('subjects', '${k}')" class="btn btn-secondary btn-icon" title="Delete"><i class="ri-delete-bin-line text-danger"></i></button>
                    </td>
                </tr>
            `;
        });
    }
}

function openMasterModal(category = currentCategory, itemKey = null) {
    document.getElementById("masterItemCategory").value = category;
    document.getElementById("masterItemKey").value = itemKey || "";
    document.getElementById("masterItemName").value = "";
    document.getElementById("masterItemCode").value = "";

    const titleEl = document.getElementById("masterModalTitle");
    const extraFields = document.getElementById("subjectExtraFields");

    if (category === "subjects") {
        extraFields.classList.remove("d-none");
        populateSelectOptions(document.getElementById("subjectDept"), masterDataCache.departments, "name", "Select Department");
        populateSelectOptions(document.getElementById("subjectYear"), masterDataCache.years, "name", "Select Academic Year");
    } else {
        extraFields.classList.add("d-none");
    }

    if (itemKey) {
        titleEl.innerText = `Edit Master Data (${category.toUpperCase()})`;
        const item = masterDataCache[category][itemKey];
        if (item) {
            document.getElementById("masterItemName").value = item.name || "";
            document.getElementById("masterItemCode").value = item.code || "";
            if (category === "subjects") {
                document.getElementById("subjectDept").value = item.department || "";
                document.getElementById("subjectYear").value = item.year || "";
            }
        }
    } else {
        titleEl.innerText = `Add Master Data (${category.toUpperCase()})`;
    }

    document.getElementById("masterModal").classList.add("active");
}

window.editMasterItem = function(category, key) {
    openMasterModal(category, key);
};

window.deleteMasterItem = async function(category, key) {
    const confirmed = await showConfirm(`Are you sure you want to delete this master data record? Any linked dropdowns will be updated.`, `Delete Master Record`);
    if (confirmed) {
        try {
            await dbRemove(dbRef(db, `masterData/${category}/${key}`));
            showToast("Record deleted successfully.", "success");
            await renderAllMasterTables();
        } catch (err) {
            console.error("Delete master error:", err);
            showToast("Failed to delete master record.", "error");
        }
    }
};
