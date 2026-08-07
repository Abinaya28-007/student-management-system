import { initializeApp } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getAuth } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import { getDatabase } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDgq4jW5SmyNKi6VHnmx0Gq5gw0sYMBve4",
    authDomain: "student-management-syste-67eee.firebaseapp.com",
    databaseURL: "https://student-management-syste-67eee-default-rtdb.firebaseio.com/",
    projectId: "student-management-syste-67eee",
    storageBucket: "student-management-syste-67eee.firebasestorage.app",
    messagingSenderId: "612925138243",
    appId: "1:612925138243:web:ca7245688e7b4b59c5bbf6"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);