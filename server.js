// ==========================================
// TASKNEST PRO - COMPLETE BACKEND SERVER
// Node.js + Express + MySQL
// ==========================================

const express = require("express");
const path = require("path");
require("dotenv").config();

const db = require("./config/database");
const taskRoutes = require("./routes/tasks");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// API ROUTES
// ==========================================

// Tasks API: Create, Read, Update, Delete
app.use("/api/tasks", taskRoutes);

// ==========================================
// FRONTEND FILES
// ==========================================

app.use(express.static(__dirname));

// Home page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// ==========================================
// SERVER HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "TaskNest Pro backend is running!",
        server: "Express.js",
        port: PORT
    });
});

// ==========================================
// DATABASE HEALTH CHECK
// ==========================================

app.get("/api/db-health", async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT DATABASE() AS databaseName, 1 AS connected"
        );

        res.status(200).json({
            success: true,
            message: "MySQL database connected successfully!",
            database: rows[0].databaseName,
            connected: rows[0].connected === 1
        });

    } catch (error) {
        console.error("MySQL connection error:", error.message);

        res.status(500).json({
            success: false,
            message: "MySQL database connection failed.",
            error: error.code || "DATABASE_ERROR"
        });
    }
});

// ==========================================
// UNKNOWN API ROUTES
// ==========================================

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found.",
        requestedPath: req.originalUrl
    });
});

// ==========================================
// GENERAL ERROR HANDLER
// ==========================================

app.use((err, req, res, next) => {
    console.error("Server error:", err.message);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.status === 400
            ? "Invalid request data."
            : "An unexpected server error occurred."
    });
});

// ==========================================
// START SERVER
// ==========================================

const server = app.listen(PORT, () => {
    console.log("");
    console.log("======================================");
    console.log("          TASKNEST PRO SERVER");
    console.log("======================================");
    console.log(`Website:     http://localhost:${PORT}`);
    console.log(`Health:      http://localhost:${PORT}/api/health`);
    console.log(`Database:    http://localhost:${PORT}/api/db-health`);
    console.log(`Tasks API:   http://localhost:${PORT}/api/tasks`);
    console.log("======================================");
    console.log("");
});

// ==========================================
// SERVER ERROR HANDLING
// ==========================================

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(
            `Port ${PORT} is already in use. Stop the other server first.`
        );
    } else {
        console.error("Server error:", error.message);
    }

    process.exitCode = 1;
});