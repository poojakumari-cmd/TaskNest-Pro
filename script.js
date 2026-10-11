// =============================================
// TASKNEST PRO
// Frontend connected to Express + MySQL API
// =============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const API_URL = "/api/tasks";
const SETTINGS_KEY = "tasknest_pro_settings_v1";

const taskForm = $("#taskForm");
const taskModal = $("#taskModal");
const taskInput = $("#taskInput");
const taskDescription = $("#taskDescription");
const taskPriority = $("#taskPriority");
const taskCategory = $("#taskCategory");
const taskDueDate = $("#taskDueDate");
const taskList = $("#taskList");
const emptyMessage = $("#emptyMessage");
const toast = $("#toast");

let tasks = [];
let activeView = "overview";
let activeFilter = "all";
let activePriority = "all";
let editingId = null;
let isLoading = false;
let toastTimeout;

let timerInterval = null;
let timerDuration = 25 * 60;
let timerRemaining = timerDuration;
let timerRunning = false;

const settings = {
    dark: false,
    ...readJSON(SETTINGS_KEY, {})
};


// =============================================
// STORAGE: SETTINGS ONLY
// Tasks are stored in MySQL, not localStorage.
// =============================================

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function saveSettings() {
    localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(settings)
    );
}


// =============================================
// API HELPERS
// =============================================

async function apiRequest(path, options = {}) {
    const config = {
        ...options,
        headers: {
            ...(options.body ? {
                "Content-Type": "application/json"
            } : {}),
            ...options.headers
        }
    };

    const response = await fetch(path, config);

    let data = {};

    try {
        data = await response.json();
    } catch {
        // The server did not return JSON.
    }

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || `Request failed (${response.status})`
        );
    }

    return data;
}


// =============================================
// NORMALIZE DATABASE TASKS
// =============================================

function normalizeTask(task) {
    let dueDate = "";

    if (task.dueDate) {
        if (task.dueDate instanceof Date) {
            dueDate = task.dueDate.toISOString().slice(0, 10);
        } else {
            dueDate = String(task.dueDate).slice(0, 10);
        }
    }

    let createdAt = Date.now();

    if (typeof task.createdAt === "number") {
        createdAt = task.createdAt;
    } else if (task.createdAt) {
        const parsed = Date.parse(task.createdAt);

        if (!Number.isNaN(parsed)) {
            createdAt = parsed;
        }
    }

    let completedAt = null;

    if (task.completedAt) {
        const parsed = Date.parse(task.completedAt);

        if (!Number.isNaN(parsed)) {
            completedAt = parsed;
        }
    }

    return {
        id: Number(task.id),
        title: String(task.title || ""),
        description: String(task.description || ""),
        category: String(task.category || "Study"),
        priority: ["Low", "Medium", "High"].includes(task.priority)
            ? task.priority
            : "Medium",
        dueDate,
        completed: Boolean(Number(task.completed)),
        createdAt,
        completedAt
    };
}


// =============================================
// LOAD TASKS FROM MYSQL
// =============================================

async function loadTasks() {
    isLoading = true;
    renderTasks();

    try {
        const data = await apiRequest(API_URL);

        tasks = Array.isArray(data.tasks)
            ? data.tasks.map(normalizeTask)
            : [];

        console.info(
            `Loaded ${tasks.length} tasks from MySQL.`
        );

        renderAll();

    } catch (error) {
        console.error("Load tasks error:", error);

        tasks = [];
        renderAll();

        showToast(
            "Could not load tasks. Check that the backend is running."
        );

    } finally {
        isLoading = false;
        renderAll();
    }
}


// =============================================
// UTILITIES
// =============================================

function localDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function startOfWeek(date = new Date()) {
    const result = new Date(date);
    const day = result.getDay();

    result.setDate(result.getDate() - ((day + 6) % 7));
    result.setHours(0, 0, 0, 0);

    return result;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(`${dateString}T12:00:00`);

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

function isOverdue(task) {
    return Boolean(
        task.dueDate &&
        task.dueDate < localDateString() &&
        !task.completed
    );
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


// =============================================
// WELCOME SECTION
// =============================================

function updateWelcome() {
    const now = new Date();

    $("#todayLabel").textContent =
        now.toLocaleDateString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long"
        }).toUpperCase();

    const hour = now.getHours();

    let greeting = "Make today";

    if (hour < 12) {
        greeting = "Make this morning";
    } else if (hour >= 17) {
        greeting = "Make this evening";
    }

    $(".welcome-copy h1").innerHTML =
        `${greeting}<br><em>count.</em>`;
}


// =============================================
// TASK MODAL
// =============================================

function openModal(task = null) {
    editingId = task ? task.id : null;

    taskForm.reset();

    taskPriority.value = task?.priority || "Medium";
    taskCategory.value = task?.category || "Study";

    taskInput.value = task?.title || "";
    taskDescription.value = task?.description || "";
    taskDueDate.value = task?.dueDate || "";

    $("#modalTitle").textContent = task
        ? "Edit your task"
        : "Create a task";

    $("#saveTaskButton").textContent = task
        ? "Save changes ↗"
        : "Create task ↗";

    taskModal.classList.add("open");
    taskModal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";

    setTimeout(() => taskInput.focus(), 100);
}

function closeModal() {
    taskModal.classList.remove("open");
    taskModal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";

    editingId = null;
}


// =============================================
// ADD / UPDATE TASK IN MYSQL
// =============================================

async function addOrUpdateTask(event) {
    event.preventDefault();

    const title = taskInput.value.trim();

    if (!title) {
        showToast("Please enter a task name.");
        taskInput.focus();
        return;
    }

    if (title.length > 150) {
        showToast("Task title cannot exceed 150 characters.");
        return;
    }

    const payload = {
        title,
        description: taskDescription.value.trim(),
        priority: taskPriority.value,
        category: taskCategory.value,
        dueDate: taskDueDate.value || null
    };

    if (payload.description.length > 500) {
        showToast("Description cannot exceed 500 characters.");
        return;
    }

    const saveButton = $("#saveTaskButton");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
        if (editingId !== null) {
            const existing = tasks.find(
                task => task.id === editingId
            );

            if (!existing) {
                showToast("Task not found. Reloading tasks.");
                await loadTasks();
                closeModal();
                return;
            }

            const data = await apiRequest(
                `${API_URL}/${editingId}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        ...payload,
                        completed: existing.completed
                    })
                }
            );

            const updated = normalizeTask(data.task);

            tasks = tasks.map(task =>
                task.id === editingId ? updated : task
            );

            showToast("Task updated successfully. ✨");

        } else {
            const data = await apiRequest(API_URL, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            tasks.unshift(normalizeTask(data.task));

            showToast("Your task has been saved to MySQL! 🤎");
        }

        closeModal();
        renderAll();

    } catch (error) {
        console.error("Save task error:", error);

        showToast(
            error.message || "Could not save task. Please try again."
        );

    } finally {
        saveButton.disabled = false;

        $("#saveTaskButton").textContent =
            editingId !== null
                ? "Save changes ↗"
                : "Create task ↗";
    }
}

taskForm.addEventListener("submit", addOrUpdateTask);


// =============================================
// OPEN / CLOSE MODAL BUTTONS
// =============================================

function openNewTask() {
    openModal();
}

[
    "#topAddButton",
    "#welcomeAddButton",
    "#emptyAddButton"
].forEach(selector => {
    const button = $(selector);

    if (button) {
        button.addEventListener("click", openNewTask);
    }
});

$("#closeModalButton").addEventListener("click", closeModal);
$("#cancelModalButton").addEventListener("click", closeModal);

taskModal.addEventListener("click", event => {
    if (event.target === taskModal) {
        closeModal();
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
        $("#sidebar").classList.remove("open");
    }

    if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
            document.activeElement.tagName
        )
    ) {
        event.preventDefault();
        $("#globalSearch").focus();
    }
});


// =============================================
// COMPLETE TASK IN MYSQL
// =============================================

async function toggleTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    const checkbox = taskList.querySelector(
        `.task-checkbox[data-id="${id}"]`
    );

    const newCompleted = !task.completed;

    if (checkbox) checkbox.disabled = true;

    try {
        const data = await apiRequest(`${API_URL}/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                title: task.title,
                description: task.description,
                category: task.category,
                priority: task.priority,
                dueDate: task.dueDate || null,
                completed: newCompleted
            })
        });

        const updated = normalizeTask(data.task);

        // Temporary client-side completion time.
        // Persistent completion history will be added in
        // the next database update.
        if (newCompleted) {
            updated.completedAt = Date.now();
        }

        tasks = tasks.map(item =>
            item.id === id ? updated : item
        );

        renderAll();

        showToast(
            newCompleted
                ? "Lovely work! Task completed. ✨"
                : "Task moved back to your list."
        );

    } catch (error) {
        console.error("Complete task error:", error);

        showToast("Could not update task. Please try again.");

        if (checkbox) checkbox.disabled = false;
    }
}


// =============================================
// EDIT TASK
// =============================================

function editTask(id) {
    const task = tasks.find(item => item.id === id);

    if (task) {
        openModal(task);
    }
}


// =============================================
// DELETE TASK FROM MYSQL
// =============================================

async function deleteTask(id) {
    const task = tasks.find(item => item.id === id);

    if (!task) return;

    if (!confirm(`Delete "${task.title}"?`)) {
        return;
    }

    try {
        await apiRequest(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        tasks = tasks.filter(item => item.id !== id);

        renderAll();

        showToast("Task deleted from the database.");

    } catch (error) {
        console.error("Delete task error:", error);

        showToast(
            error.message || "Could not delete task."
        );
    }
}


// =============================================
// TASK CARD
// =============================================

function createTaskElement(task) {
    const row = document.createElement("article");

    row.className = "task-item";

    if (task.completed) {
        row.classList.add("done");
    }

    row.innerHTML = `
        <input
            type="checkbox"
            class="task-checkbox"
            data-id="${task.id}"
            aria-label="Mark task as completed"
            ${task.completed ? "checked" : ""}
        >

        <div class="task-info">
            <div class="task-title">
                ${escapeHTML(task.title)}
            </div>

            ${
                task.description
                    ? `<p class="task-description">
                        ${escapeHTML(task.description)}
                       </p>`
                    : ""
            }

            <div class="task-meta">
                <span class="task-category">
                    ◈ ${escapeHTML(task.category)}
                </span>

                ${
                    task.dueDate
                        ? `<span class="task-due">
                            ${isOverdue(task) ? "Overdue · " : "Due "}
                            ${escapeHTML(formatDate(task.dueDate))}
                           </span>`
                        : ""
                }
            </div>
        </div>

        <span class="priority ${escapeHTML(task.priority)}">
            ${escapeHTML(task.priority)}
        </span>

        <div class="task-actions">
            <button
                class="task-action edit-action"
                aria-label="Edit task">
                Edit
            </button>

            <button
                class="task-action delete delete-action"
                aria-label="Delete task">
                ×
            </button>
        </div>
    `;

    row.querySelector(".task-checkbox").addEventListener(
        "change",
        () => toggleTask(task.id)
    );

    row.querySelector(".edit-action").addEventListener(
        "click",
        () => editTask(task.id)
    );

    row.querySelector(".delete-action").addEventListener(
        "click",
        () => deleteTask(task.id)
    );

    return row;
}


// =============================================
// SEARCH AND FILTER
// =============================================

function getVisibleTasks() {
    const query = $("#globalSearch").value.trim().toLowerCase();

    return tasks.filter(task => {
        const searchableText = [
            task.title,
            task.description,
            task.category,
            task.priority
        ].join(" ").toLowerCase();

        if (!searchableText.includes(query)) {
            return false;
        }

        if (
            activePriority !== "all" &&
            task.priority !== activePriority
        ) {
            return false;
        }

        if (activeFilter === "pending" && task.completed) {
            return false;
        }

        if (activeFilter === "completed" && !task.completed) {
            return false;
        }

        if (activeView === "today") {
            return (
                task.dueDate === localDateString() &&
                !task.completed
            );
        }

        if (activeView === "upcoming") {
            return (
                task.dueDate >= localDateString() &&
                !task.completed
            );
        }

        if (activeView === "completed") {
            return task.completed;
        }

        if (activeView.startsWith("category:")) {
            const category = activeView.slice(
                "category:".length
            );

            return task.category === category;
        }

        if (activeView === "overview") {
            return !task.completed;
        }

        return true;
    });
}


// =============================================
// RENDER TASK LIST
// =============================================

function renderTasks() {
    if (!taskList) return;

    const visibleTasks = getVisibleTasks();

    taskList.replaceChildren();

    visibleTasks.forEach(task => {
        taskList.appendChild(createTaskElement(task));
    });

    emptyMessage.style.display =
        visibleTasks.length ? "none" : "block";

    if (!visibleTasks.length) {
        const heading = emptyMessage.querySelector("h3");
        const paragraph = emptyMessage.querySelector("p");

        if (isLoading) {
            heading.textContent = "Loading your tasks...";
            paragraph.textContent =
                "Connecting to your workspace.";
        } else if (tasks.length === 0) {
            heading.textContent =
                "Your next little win starts here.";

            paragraph.textContent =
                "Create a task and take the first step.";
        } else {
            heading.textContent =
                "Nothing to show right now.";

            paragraph.textContent =
                "Try a different filter or create a new task.";
        }
    }

    $("#taskCountLabel").textContent =
        `${tasks.length} ${
            tasks.length === 1 ? "task" : "tasks"
        } in total`;

    $("#sidebarTaskCount").textContent =
        tasks.filter(task => !task.completed).length;
}


// =============================================
// SIDEBAR NAVIGATION
// =============================================

function activateView(view, category = null) {
    activeView = category
        ? `category:${category}`
        : view;

    $$(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            !category && button.dataset.view === view
        );
    });

    $$(".category-item").forEach(button => {
        button.classList.toggle(
            "active",
            Boolean(category) &&
            button.dataset.category === category
        );
    });

    const titles = {
        overview: "Overview",
        all: "All Tasks",
        today: "My Day",
        upcoming: "Upcoming",
        completed: "Completed"
    };

    const title = category || titles[view] || "Overview";

    $("#breadcrumbTitle").textContent = title;

    $("#taskHeading").textContent =
        category ? `${category} tasks` :
        view === "overview" ? "Your tasks" :
        view === "today" ? "Today's tasks" :
        view === "upcoming" ? "Upcoming tasks" :
        view === "completed" ? "Completed tasks" :
        "All tasks";

    $("#taskSubtitle").textContent =
        view === "today"
            ? "Your plans for today."
            : view === "upcoming"
            ? "Keep an eye on what's coming."
            : category
            ? `Everything in ${category}.`
            : "One thing at a time.";

    activeFilter = "all";
    activePriority = "all";

    $$(".filter-chip").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.filter === "all"
        );
    });

    $("#priorityFilter").value = "all";

    $("#sidebar").classList.remove("open");

    renderAll();
}

$$(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        activateView(button.dataset.view);
    });
});

function bindCategoryButtons() {
    $$(".category-item").forEach(button => {
        button.onclick = () => {
            activateView(
                "all",
                button.dataset.category
            );
        };
    });
}

bindCategoryButtons();

$$(".filter-chip").forEach(button => {
    button.addEventListener("click", () => {
        activeFilter = button.dataset.filter;

        $$(".filter-chip").forEach(chip => {
            chip.classList.toggle("active", chip === button);
        });

        renderAll();
    });
});

$("#priorityFilter").addEventListener("change", event => {
    activePriority = event.target.value;
    renderAll();
});

$("#globalSearch").addEventListener("input", renderAll);

$("#viewAllButton").addEventListener("click", () => {
    activateView("all");

    $("#taskSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

$("#upcomingViewButton").addEventListener("click", () => {
    activateView("upcoming");

    $("#taskSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});


// =============================================
// CUSTOM CATEGORY BUTTON
// Built-in categories are supported by the API.
// =============================================

$("#addCategoryBtn").addEventListener("click", () => {
    showToast(
        "Custom categories will be enabled in the next update."
    );
});


// =============================================
// DASHBOARD STATISTICS
// =============================================

function renderStats() {
    const completed = tasks.filter(
        task => task.completed
    ).length;

    const pending = tasks.length - completed;

    const overdue = tasks.filter(isOverdue).length;

    $("#totalTasks").textContent = tasks.length;
    $("#pendingTasks").textContent = pending;
    $("#completedTasks").textContent = completed;
    $("#overdueTasks").textContent = overdue;

    const percentage = tasks.length
        ? Math.round(completed / tasks.length * 100)
        : 0;

    $("#progressPercentage").textContent = `${percentage}%`;

    const circumference = 2 * Math.PI * 72;

    $("#progressRing").style.strokeDasharray =
        circumference;

    $("#progressRing").style.strokeDashoffset =
        circumference * (1 - percentage / 100);

    $("#legendCompleted").textContent = completed;
    $("#legendRemaining").textContent = pending;

    $("#progressMessage").textContent =
        tasks.length === 0
            ? "Start with one small task. You've got this."
            : percentage === 100
            ? "Amazing! Every task on your list is complete."
            : `${pending} more ${
                pending === 1 ? "task" : "tasks"
            } to keep moving forward.`;
}


// =============================================
// WEEKLY PRODUCTIVITY
// Uses completion timestamps returned by API.
// Persistent completion history needs a DB update.
// =============================================

function renderWeeklyChart() {
    const today = new Date();
    const monday = startOfWeek(today);

    const days = [];

    for (let i = 0; i < 7; i++) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);

        const dateString = localDateString(date);

        const count = tasks.filter(task =>
            task.completedAt &&
            localDateString(
                new Date(task.completedAt)
            ) === dateString
        ).length;

        days.push({
            date,
            dateString,
            count,
            label: date.toLocaleDateString("en-IN", {
                weekday: "short"
            })
        });
    }

    const completedThisWeek = tasks.filter(task => {
        if (!task.completedAt) return false;

        const completedDate = new Date(task.completedAt);

        return completedDate >= monday &&
            completedDate <= new Date(
                today.getTime() + 86400000
            );
    }).length;

    $("#weeklyCompleted").textContent =
        completedThisWeek;

    const totalCompleted = tasks.filter(
        task => task.completed
    ).length;

    const rate = totalCompleted
        ? Math.round(
            completedThisWeek / totalCompleted * 100
        )
        : 0;

    $("#weeklyRate").textContent = `${rate}%`;
    $("#weeklyProgress").style.width = `${rate}%`;

    const maxCount = Math.max(
        1,
        ...days.map(day => day.count)
    );

    $("#weeklyChart").innerHTML = days.map(day => {
        const height = day.count
            ? Math.max(8, day.count / maxCount * 100)
            : 4;

        const isToday =
            day.dateString === localDateString();

        return `
            <div class="chart-day ${isToday ? "today" : ""}">
                <span class="chart-value">${day.count}</span>

                <div class="chart-track">
                    <div class="chart-bar"
                         style="height:${height}%"></div>
                </div>

                <span>${escapeHTML(day.label)}</span>
            </div>
        `;
    }).join("");
}


// =============================================
// UPCOMING DEADLINES
// =============================================

function renderUpcoming() {
    const upcoming = tasks
        .filter(task =>
            task.dueDate &&
            !task.completed &&
            task.dueDate >= localDateString()
        )
        .sort((a, b) =>
            a.dueDate.localeCompare(b.dueDate)
        )
        .slice(0, 4);

    const container = $("#upcomingList");

    if (!upcoming.length) {
        container.innerHTML = `
            <div class="upcoming-empty">
                No upcoming deadlines yet.<br>
                Add a due date to one of your tasks.
            </div>
        `;

        return;
    }

    container.innerHTML = upcoming.map(task => {
        const date = new Date(
            `${task.dueDate}T12:00:00`
        );

        const day = date.toLocaleDateString(
            "en-IN",
            { day: "numeric" }
        );

        const month = date.toLocaleDateString(
            "en-IN",
            { month: "short" }
        );

        return `
            <div class="upcoming-item">
                <div class="upcoming-date">
                    <strong>${day}</strong>
                    <span>${month}</span>
                </div>

                <div class="upcoming-info">
                    <strong>${escapeHTML(task.title)}</strong>

                    <span>
                        ${escapeHTML(task.category)}
                        ·
                        ${escapeHTML(task.priority)} priority
                    </span>
                </div>
            </div>
        `;
    }).join("");
}


// =============================================
// DARK MODE
// =============================================

function applyTheme() {
    document.body.classList.toggle(
        "dark",
        Boolean(settings.dark)
    );

    $("#themeButton").textContent =
        settings.dark ? "☀" : "☾";

    $("#themeButton").title =
        settings.dark
            ? "Switch to light mode"
            : "Switch to dark mode";
}

$("#themeButton").addEventListener("click", () => {
    settings.dark = !settings.dark;

    saveSettings();
    applyTheme();
});


// =============================================
// MOBILE SIDEBAR
// =============================================

$("#menuButton").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
});

document.addEventListener("click", event => {
    const sidebar = $("#sidebar");

    if (
        window.innerWidth <= 760 &&
        sidebar.classList.contains("open") &&
        !sidebar.contains(event.target) &&
        !$("#menuButton").contains(event.target)
    ) {
        sidebar.classList.remove("open");
    }
});


// =============================================
// FOCUS TIMER
// =============================================

function updateTimerDisplay() {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;

    $("#timerDisplay").textContent =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(seconds).padStart(2, "0")}`;

    $("#timerStatus").textContent =
        timerRunning ? "FOCUSING" : "READY";

    $("#startTimer").textContent =
        timerRunning ? "Ⅱ Pause focus" : "▶ Start focus";
}

function stopTimer() {
    clearInterval(timerInterval);

    timerInterval = null;
    timerRunning = false;

    updateTimerDisplay();
}

function startTimer() {
    if (timerRunning) {
        stopTimer();
        return;
    }

    if (timerRemaining <= 0) {
        timerRemaining = timerDuration;
    }

    timerRunning = true;
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timerRemaining -= 1;

        if (timerRemaining <= 0) {
            timerRemaining = 0;
            stopTimer();

            showToast(
                "Focus session complete! Take a little break. ✨"
            );
        }

        updateTimerDisplay();
    }, 1000);
}

$("#startTimer").addEventListener("click", startTimer);

$("#resetTimer").addEventListener("click", () => {
    stopTimer();

    timerRemaining = timerDuration;
    updateTimerDisplay();
});

$$(".timer-preset").forEach(button => {
    button.addEventListener("click", () => {
        stopTimer();

        timerDuration =
            Number(button.dataset.minutes) * 60;

        timerRemaining = timerDuration;

        $$(".timer-preset").forEach(preset => {
            preset.classList.toggle(
                "active",
                preset === button
            );
        });

        updateTimerDisplay();
    });
});


// =============================================
// REFRESH ALL DASHBOARD SECTIONS
// =============================================

function renderAll() {
    renderTasks();
    renderStats();
    renderWeeklyChart();
    renderUpcoming();
}


// =============================================
// START APPLICATION
// =============================================

applyTheme();
updateWelcome();
updateTimerDisplay();

loadTasks();

console.info("TaskNest Pro frontend initialized.");