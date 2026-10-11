const express = require("express");
const router = express.Router();
const db = require("../config/database");

// GET: Fetch all tasks
router.get("/", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                id,
                title,
                description,
                category,
                priority,
                due_date AS dueDate,
                completed,
                created_at AS createdAt
            FROM tasks
            ORDER BY id DESC
        `);

        res.json({
            success: true,
            tasks: rows
        });

    } catch (error) {
        console.error("Fetch tasks error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to fetch tasks."
        });
    }
});


// POST: Add a new task
router.post("/", async (req, res) => {
    try {
        const {
            title,
            description = "",
            category = "Study",
            priority = "Medium",
            dueDate = null
        } = req.body;

        const allowedCategories = [
            "Study", "Personal", "Work", "Projects"
        ];

        const allowedPriorities = [
            "Low", "Medium", "High"
        ];

        if (typeof title !== "string" || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Task title is required."
            });
        }

        if (
            typeof description !== "string" ||
            description.length > 500
        ) {
            return res.status(400).json({
                success: false,
                message: "Description must be under 500 characters."
            });
        }

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category."
            });
        }

        if (!allowedPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: "Invalid priority."
            });
        }

        if (
            dueDate !== null &&
            (
                typeof dueDate !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
                Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)) ||
                new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid due date."
            });
        }

        const [result] = await db.query(
            `INSERT INTO tasks
                (title, description, category, priority, due_date)
             VALUES (?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description.trim(),
                category,
                priority,
                dueDate
            ]
        );

        const [rows] = await db.query(
            `SELECT
                id,
                title,
                description,
                category,
                priority,
                due_date AS dueDate,
                completed,
                created_at AS createdAt
             FROM tasks
             WHERE id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            success: true,
            message: "Task created successfully.",
            task: rows[0]
        });

    } catch (error) {
        console.error("Create task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to create task."
        });
    }
});


// PUT: Update a task
router.put("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID."
            });
        }

        const {
            title,
            description = "",
            category = "Study",
            priority = "Medium",
            dueDate = null,
            completed = false
        } = req.body;

        const allowedCategories = [
            "Study", "Personal", "Work", "Projects"
        ];

        const allowedPriorities = [
            "Low", "Medium", "High"
        ];

        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.length > 150
        ) {
            return res.status(400).json({
                success: false,
                message: "A valid task title is required."
            });
        }

        if (
            typeof description !== "string" ||
            description.length > 500
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid description."
            });
        }

        if (!allowedCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                message: "Invalid category."
            });
        }

        if (!allowedPriorities.includes(priority)) {
            return res.status(400).json({
                success: false,
                message: "Invalid priority."
            });
        }

        if (typeof completed !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "Completed must be true or false."
            });
        }

        if (
            dueDate !== null &&
            (
                typeof dueDate !== "string" ||
                !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) ||
                Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`)) ||
                new Date(`${dueDate}T00:00:00Z`).toISOString().slice(0, 10) !== dueDate
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid due date."
            });
        }

        const [result] = await db.query(
            `UPDATE tasks
             SET title = ?,
                 description = ?,
                 category = ?,
                 priority = ?,
                 due_date = ?,
                 completed = ?
             WHERE id = ?`,
            [
                title.trim(),
                description.trim(),
                category,
                priority,
                dueDate,
                completed,
                id
            ]
        );

        if (result.affectedRows === 0) {
            const [existing] = await db.query(
                "SELECT id FROM tasks WHERE id = ?",
                [id]
            );

            if (!existing.length) {
                return res.status(404).json({
                    success: false,
                    message: "Task not found."
                });
            }
        }

        const [rows] = await db.query(
            `SELECT
                id,
                title,
                description,
                category,
                priority,
                due_date AS dueDate,
                completed,
                created_at AS createdAt
             FROM tasks
             WHERE id = ?`,
            [id]
        );

        res.json({
            success: true,
            message: "Task updated successfully.",
            task: rows[0]
        });

    } catch (error) {
        console.error("Update task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to update task."
        });
    }
});


// DELETE: Remove a task
router.delete("/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID."
            });
        }

        const [result] = await db.query(
            "DELETE FROM tasks WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Task not found."
            });
        }

        res.json({
            success: true,
            message: "Task deleted successfully."
        });

    } catch (error) {
        console.error("Delete task error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to delete task."
        });
    }
});

module.exports = router;