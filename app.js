(() => {
    'use strict';

    const STORAGE_KEY = 'mijn-taken-data';
    let tasks = [];
    let currentFilter = 'all';
    let currentCategory = 'all';

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

    function loadTasks() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            tasks = data ? JSON.parse(data) : [];
        } catch {
            tasks = [];
        }
    }

    function saveTasks() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function addTask() {
        const text = taskInput.value.trim();
        if (!text) return;

        tasks.unshift({
            id: generateId(),
            text: text,
            category: categorySelect.value || '',
            done: false,
            createdAt: Date.now()
        });

        taskInput.value = '';
        categorySelect.value = '';
        saveTasks();
        render();
        taskInput.focus();
    }

    function toggleTask(id) {
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.done = !task.done;
            saveTasks();
            render();
        }
    }

    function deleteTask(id) {
        const item = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
        if (item) {
            item.classList.add('removing');
            setTimeout(() => {
                tasks = tasks.filter(t => t.id !== id);
                saveTasks();
                render();
            }, 300);
        }
    }

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

    // Event listeners
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

    // Init
    loadTasks();
    render();
})();
