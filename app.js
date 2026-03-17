(() => {
    'use strict';

    // Firebase config
    const firebaseConfig = {
        apiKey: "AIzaSyBJ6XQZrQNkjawOmblaGbdXLlw9FyTlXZc",
        authDomain: "mytasks-8e57b.firebaseapp.com",
        projectId: "mytasks-8e57b",
        storageBucket: "mytasks-8e57b.firebasestorage.app",
        messagingSenderId: "618817580584",
        appId: "1:618817580584:web:e89d4a9c65a452023a8f1d"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    db.enablePersistence().catch(() => {});

    const STORAGE_KEY = 'mijn-taken-data';
    let tasks = [];
    let currentFilter = 'all';
    let currentCategory = 'all';
    let currentUser = null;
    let unsubFirestore = null;

    const CATEGORIES = {
        'werk': '💼 Werk',
        'prive': '🏠 Privé',
        'boodschappen': '🛒 Boodschappen',
        'gezondheid': '💪 Gezondheid',
        'studie': '📚 Studie'
    };

    const taskInput = document.getElementById('taskInput');
    const categorySelect = document.getElementById('categorySelect');
    const addBtn = document.getElementById('addBtn');
    const taskList = document.getElementById('taskList');
    const taskCount = document.getElementById('taskCount');
    const emptyState = document.getElementById('emptyState');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const catFilterBtns = document.querySelectorAll('.cat-filter-btn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authLoggedIn = document.getElementById('authLoggedIn');
    const authLoggedOut = document.getElementById('authLoggedOut');
    const userPhoto = document.getElementById('userPhoto');
    const userName = document.getElementById('userName');
    const syncStatus = document.getElementById('syncStatus');

    // --- Auth ---
    function updateAuthUI(user) {
        if (user) {
            authLoggedIn.classList.remove('hidden');
            authLoggedOut.classList.add('hidden');
            userPhoto.src = user.photoURL || '';
            userName.textContent = user.displayName || user.email;
            syncStatus.textContent = '☁️ Gesynchroniseerd';
        } else {
            authLoggedIn.classList.add('hidden');
            authLoggedOut.classList.remove('hidden');
            syncStatus.textContent = '📱 Alleen lokaal';
        }
    }

    loginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(err => {
            if (err.code === 'auth/popup-blocked') {
                auth.signInWithRedirect(provider);
            }
        });
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    auth.onAuthStateChanged(user => {
        currentUser = user;
        updateAuthUI(user);

        if (unsubFirestore) {
            unsubFirestore();
            unsubFirestore = null;
        }

        if (user) {
            subscribeFirestore(user.uid);
        } else {
            loadTasksLocal();
            render();
        }
    });

    // --- Firestore sync ---
    function userTasksRef(uid) {
        return db.collection('users').doc(uid).collection('tasks');
    }

    function subscribeFirestore(uid) {
        syncStatus.textContent = '🔄 Synchroniseren...';
        unsubFirestore = userTasksRef(uid)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                saveTasksLocal();
                syncStatus.textContent = '☁️ Gesynchroniseerd';
                render();
            }, () => {
                syncStatus.textContent = '⚠️ Offline modus';
                loadTasksLocal();
                render();
            });
    }

    async function addTaskToFirestore(task) {
        if (!currentUser) return;
        const { id, ...data } = task;
        await userTasksRef(currentUser.uid).doc(id).set(data);
    }

    async function updateTaskInFirestore(id, updates) {
        if (!currentUser) return;
        await userTasksRef(currentUser.uid).doc(id).update(updates);
    }

    async function deleteTaskFromFirestore(id) {
        if (!currentUser) return;
        await userTasksRef(currentUser.uid).doc(id).delete();
    }

    // --- Local storage ---
    function loadTasksLocal() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            tasks = data ? JSON.parse(data) : [];
        } catch {
            tasks = [];
        }
    }

    function saveTasksLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    // --- Task operations ---
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;

        const task = {
            id: generateId(),
            text: text,
            category: categorySelect.value || '',
            done: false,
            createdAt: Date.now()
        };

        tasks.unshift(task);
        taskInput.value = '';
        categorySelect.value = '';

        if (currentUser) {
            addTaskToFirestore(task);
        } else {
            saveTasksLocal();
        }
        render();
        taskInput.focus();
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.done = !task.done;
            if (currentUser) {
                updateTaskInFirestore(id, { done: task.done });
            } else {
                saveTasksLocal();
            }
            render();
        }
    }

    function deleteTask(id) {
        const item = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== id);
                if (currentUser) {
                    deleteTaskFromFirestore(id);
                } else {
                    saveTasksLocal();
                }
                render();
            }, 300);
        }
    }

    // --- Filtering & rendering ---
    function getFilteredTasks() {
        let filtered = tasks;
        switch (currentFilter) {
            case 'active': filtered = filtered.filter(t => !t.done); break;
            case 'completed': filtered = filtered.filter(t => t.done); break;
        }
        if (currentCategory !== 'all') {
            if (currentCategory === 'geen') {
                filtered = filtered.filter(t => !t.category);
            } else {
                filtered = filtered.filter(t => t.category === currentCategory);
            }
        }
        return filtered;
    }

    function render() {
        const filtered = getFilteredTasks();
        const activeTasks = tasks.filter(t => !t.done).length;

        taskCount.textContent = `${activeTasks} ${activeTasks === 1 ? 'taak' : 'taken'} open`;

        if (filtered.length === 0) {
            taskList.innerHTML = '';
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            taskList.innerHTML = filtered.map(task => `
                <li class="task-item ${task.done ? 'done' : ''}" data-id="${escapeAttr(task.id)}">
                    <div class="task-checkbox" role="checkbox" aria-checked="${task.done}" tabindex="0"></div>
                    <div class="task-content">
                        <span class="task-text">${escapeHtml(task.text)}</span>
                        ${task.category ? `<span class="task-category" data-cat="${escapeAttr(task.category)}">${escapeHtml(CATEGORIES[task.category] || task.category)}</span>` : ''}
                    </div>
                    <button class="task-delete" aria-label="Verwijder taak" title="Verwijderen">×</button>
                </li>
            `).join('');
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/[&"'<>]/g, c => ({
            '&': '&amp;', '"': '&quot;', "'": '&#39;', '<': '&lt;', '>': '&gt;'
        }[c]));
    }

    // --- Event listeners ---
    addBtn.addEventListener('click', addTask);

    taskInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addTask();
    });

    taskList.addEventListener('click', (e) => {
        const item = e.target.closest('.task-item');
        if (!item) return;
        const id = item.dataset.id;

        if (e.target.closest('.task-checkbox')) {
            toggleTask(id);
        } else if (e.target.closest('.task-delete')) {
            deleteTask(id);
        }
    });

    catFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            catFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;
            render();
        });
    });

    taskList.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const checkbox = e.target.closest('.task-checkbox');
            if (checkbox) {
                e.preventDefault();
                const item = checkbox.closest('.task-item');
                if (item) toggleTask(item.dataset.id);
            }
        }
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            render();
        });
    });

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }

    // Init (auth listener handles loading)
    loadTasksLocal();
    render();
})();
