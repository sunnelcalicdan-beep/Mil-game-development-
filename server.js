"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 10000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/*
========================================================
CONFIGURATION
========================================================
*/

const ALLOWED_EXTENSIONS = new Set([
    "txt",
    "json",
    "gd",
    "js",
    "css",
    "html",
    "glb",
    "gltf",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "wav",
    "mp3",
    "zip"
]);

const SCRIPT_EXTENSIONS = new Set(["txt"]);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : false
});

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

/*
========================================================
UPLOAD MEMORY STORAGE
========================================================

Files are temporarily held in server memory while being
validated and written to PostgreSQL.

For very large-scale production deployments, replace
this layer with object storage such as S3-compatible
storage while keeping the same API.
*/

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: MAX_FILE_SIZE
    },

    fileFilter: (req, file, callback) => {
        const extension = path
            .extname(file.originalname)
            .slice(1)
            .toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(extension)) {
            return callback(
                new Error(
                    "This file type is not supported."
                )
            );
        }

        callback(null, true);
    }
});

/*
========================================================
DATABASE / STORAGE
========================================================
*/

async function initializeDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS files (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            display_name TEXT NOT NULL,
            uploader TEXT NOT NULL,
            extension TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size BIGINT NOT NULL,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            downloads BIGINT NOT NULL DEFAULT 0,
            is_script BOOLEAN NOT NULL DEFAULT FALSE,
            data BYTEA NOT NULL,
            delete_token_hash TEXT NOT NULL
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS files_uploaded_at_idx
        ON files(uploaded_at DESC);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS files_uploader_idx
        ON files(uploader);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS files_extension_idx
        ON files(extension);
    `);
}

/*
========================================================
HELPERS
========================================================
*/

function generateId() {
    return crypto.randomUUID();
}

function generateDeleteToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function cleanText(value, maxLength) {
    if (typeof value !== "string") {
        return "";
    }

    return value
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxLength);
}

function getExtension(filename) {
    return path
        .extname(filename)
        .slice(1)
        .toLowerCase();
}

function safePublicFile(row) {
    return {
        id: row.id,
        name: row.name,
        displayName: row.display_name,
        uploader: row.uploader,
        extension: row.extension,
        type: row.mime_type,
        size: Number(row.size),
        date: new Date(row.uploaded_at).getTime(),
        downloads: Number(row.downloads),
        script: row.is_script
    };
}

/*
========================================================
REAL-TIME CLIENT CONNECTIONS
========================================================
*/

const clients = new Set();

function broadcastLibraryUpdate() {
    const message = `event: library-update\ndata: ${JSON.stringify({
        timestamp: Date.now()
    })}\n\n`;

    for (const client of clients) {
        try {
            client.write(message);
        } catch {
            clients.delete(client);
        }
    }
}

/*
========================================================
API: REAL-TIME EVENT STREAM
========================================================
*/

app.get("/api/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    res.write(
        `event: connected\ndata: ${JSON.stringify({
            connected: true
        })}\n\n`
    );

    clients.add(res);

    const heartbeat = setInterval(() => {
        try {
            res.write(": heartbeat\n\n");
        } catch {
            clearInterval(heartbeat);
            clients.delete(res);
        }
    }, 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        clients.delete(res);
    });
});

/*
========================================================
API: GET PUBLIC FILES
========================================================
*/

app.get("/api/files", async (req, res) => {
    try {
        const search = cleanText(req.query.search || "", 100);
        const uploader = cleanText(req.query.uploader || "", 100);
        const sort = req.query.sort || "newest";

        const values = [];
        const conditions = [];

        if (search) {
            values.push(`%${search}%`);

            conditions.push(`
                (
                    name ILIKE $${values.length}
                    OR display_name ILIKE $${values.length}
                    OR uploader ILIKE $${values.length}
                    OR extension ILIKE $${values.length}
                )
            `);
        }

        if (uploader) {
            values.push(uploader);
            conditions.push(
                `uploader = $${values.length}`
            );
        }

        let orderBy = "uploaded_at DESC";

        if (sort === "oldest") {
            orderBy = "uploaded_at ASC";
        }

        if (sort === "name") {
            orderBy = "LOWER(display_name) ASC";
        }

        if (sort === "largest") {
            orderBy = "size DESC";
        }

        const query = `
            SELECT
                id,
                name,
                display_name,
                uploader,
                extension,
                mime_type,
                size,
                uploaded_at,
                downloads,
                is_script
            FROM files
            ${
                conditions.length
                    ? `WHERE ${conditions.join(" AND ")}`
                    : ""
            }
            ORDER BY ${orderBy}
            LIMIT 500
        `;

        const result = await pool.query(query, values);

        res.json({
            success: true,
            files: result.rows.map(safePublicFile)
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Unable to load public files."
        });
    }
});

/*
========================================================
API: STATISTICS
========================================================
*/

app.get("/api/stats", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                COUNT(*)::BIGINT AS files,
                COUNT(*) FILTER (
                    WHERE is_script = TRUE
                )::BIGINT AS scripts,
                COALESCE(SUM(size), 0)::BIGINT AS total_size,
                COALESCE(SUM(downloads), 0)::BIGINT AS downloads
            FROM files
        `);

        const row = result.rows[0];

        res.json({
            success: true,
            stats: {
                files: Number(row.files),
                scripts: Number(row.scripts),
                totalSize: Number(row.total_size),
                downloads: Number(row.downloads)
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Unable to load statistics."
        });
    }
});

/*
========================================================
API: UPLOAD FILE
========================================================
*/

app.post(
    "/api/files",
    upload.single("file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "Please select a file."
                });
            }

            const uploader = cleanText(
                req.body.uploader,
                80
            );

            const displayName = cleanText(
                req.body.displayName,
                100
            );

            const extension = getExtension(
                req.file.originalname
            );

            if (!uploader) {
                return res.status(400).json({
                    success: false,
                    error: "Please enter your uploader name."
                });
            }

            if (!displayName) {
                return res.status(400).json({
                    success: false,
                    error: "Display name is required."
                });
            }

            if (!ALLOWED_EXTENSIONS.has(extension)) {
                return res.status(400).json({
                    success: false,
                    error: "This file type is not allowed."
                });
            }

            if (req.file.size > MAX_FILE_SIZE) {
                return res.status(413).json({
                    success: false,
                    error: "File is too large. Maximum allowed size is 50 MB."
                });
            }

            const isScript = SCRIPT_EXTENSIONS.has(extension);

            /*
            Only .txt files can use the script endpoint
            behavior. Other code files are treated as normal
            downloadable files.
            */

            if (req.body.isScript === "true" && !isScript) {
                return res.status(400).json({
                    success: false,
                    error: "Custom scripts must be .txt files."
                });
            }

            const id = generateId();
            const deleteToken = generateDeleteToken();
            const deleteTokenHash = hashToken(deleteToken);

            await pool.query(
                `
                INSERT INTO files (
                    id,
                    name,
                    display_name,
                    uploader,
                    extension,
                    mime_type,
                    size,
                    is_script,
                    data,
                    delete_token_hash
                )
                VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
                )
                `,
                [
                    id,
                    req.file.originalname,
                    displayName,
                    uploader,
                    extension,
                    req.file.mimetype || "application/octet-stream",
                    req.file.size,
                    isScript,
                    req.file.buffer,
                    deleteTokenHash
                ]
            );

            broadcastLibraryUpdate();

            res.status(201).json({
                success: true,

                file: {
                    id,
                    name: req.file.originalname,
                    displayName,
                    uploader,
                    extension,
                    type: req.file.mimetype,
                    size: req.file.size,
                    script: isScript
                },

                /*
                The token is shown ONLY to the uploader.
                It should be saved somewhere private if they
                want to delete the file later.
                */

                deleteToken
            });

        } catch (error) {
            console.error(error);

            if (
                error.code === "LIMIT_FILE_SIZE"
            ) {
                return res.status(413).json({
                    success: false,
                    error: "File is too large. Maximum allowed size is 50 MB."
                });
            }

            res.status(500).json({
                success: false,
                error: "Upload failed."
            });
        }
    }
);

/*
========================================================
API: DOWNLOAD
========================================================
*/

app.get("/api/files/:id/download", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                name,
                mime_type,
                data
            FROM files
            WHERE id = $1
            `,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).send(
                "File not found."
            );
        }

        const file = result.rows[0];

        await pool.query(
            `
            UPDATE files
            SET downloads = downloads + 1
            WHERE id = $1
            `,
            [req.params.id]
        );

        broadcastLibraryUpdate();

        res.setHeader(
            "Content-Type",
            file.mime_type || "application/octet-stream"
        );

        res.setHeader(
            "Content-Disposition",
            `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`
        );

        res.send(file.data);

    } catch (error) {
        console.error(error);

        res.status(500).send(
            "Download failed."
        );
    }
});

/*
========================================================
API: SCRIPT PREVIEW
========================================================
*/

app.get("/api/files/:id/preview", async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                name,
                display_name,
                uploader,
                extension,
                mime_type,
                size,
                uploaded_at,
                downloads,
                is_script,
                data
            FROM files
            WHERE id = $1
            `,
            [req.params.id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                error: "File not found."
            });
        }

        const file = result.rows[0];

        if (!file.is_script) {
            return res.status(400).json({
                success: false,
                error: "This file is not a script."
            });
        }

        const content = file.data.toString(
            "utf8"
        );

        /*
        JSON response transports the script as data.
        The frontend MUST use textContent, never innerHTML.
        */

        res.json({
            success: true,

            file: {
                id: file.id,
                name: file.name,
                displayName: file.display_name,
                uploader: file.uploader,
                extension: file.extension,
                type: file.mime_type,
                size: Number(file.size),
                date: new Date(
                    file.uploaded_at
                ).getTime(),
                downloads: Number(file.downloads),
                script: true,
                content
            }
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Unable to preview script."
        });
    }
});

/*
========================================================
API: DELETE
========================================================

Production deletion should be authenticated.

For this public project, each uploader receives a private
delete token when they upload a file.

Anyone knowing that private token can delete that file.
The token is NEVER stored in plaintext.
========================================================
*/

app.delete("/api/files/:id", async (req, res) => {
    try {
        const token = String(
            req.body.deleteToken || ""
        );

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Delete key required."
            });
        }

        const tokenHash = hashToken(token);

        const result = await pool.query(
            `
            DELETE FROM files
            WHERE id = $1
            AND delete_token_hash = $2
            RETURNING id
            `,
            [
                req.params.id,
                tokenHash
            ]
        );

        if (!result.rows.length) {
            return res.status(403).json({
                success: false,
                error: "Invalid delete key."
            });
        }

        broadcastLibraryUpdate();

        res.json({
            success: true
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            error: "Delete failed."
        });
    }
});

/*
========================================================
HEALTH CHECK
========================================================
*/

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            status: "online",
            database: "connected"
        });

    } catch {
        res.status(503).json({
            success: false,
            status: "offline",
            database: "disconnected"
        });
    }
});

/*
========================================================
FRONTEND
========================================================
*/

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

app.get("*", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

/*
========================================================
ERROR HANDLER
========================================================
*/

app.use((error, req, res, next) => {
    console.error(error);

    if (
        error instanceof multer.MulterError
    ) {
        if (
            error.code === "LIMIT_FILE_SIZE"
        ) {
            return res.status(413).json({
                success: false,
                error:
                    "File is too large. Maximum allowed size is 50 MB."
            });
        }
    }

    res.status(400).json({
        success: false,
        error:
            error.message ||
            "An unexpected error occurred."
    });
});

/*
========================================================
START
========================================================
*/

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(
                `PROJECT FILE HUB running on port ${PORT}`
            );
        });
    })
    .catch((error) => {
        console.error(
            "Database initialization failed:",
            error
        );

        process.exit(1);
    });

/*
========================================================
FUTURE PRODUCTION ARCHITECTURE
========================================================

Current:

Frontend
   ↓
Express API
   ↓
PostgreSQL
   └── file bytes stored as BYTEA

For a larger deployment:

Frontend
   ↓
Express API
   ↓
PostgreSQL
   └── metadata only
   ↓
Object/File Storage
   └── actual files

Recommended future endpoints:

POST   /api/files
GET    /api/files
GET    /api/files/:id/download
GET    /api/files/:id/preview
DELETE /api/files/:id

This means the frontend does not need to change
substantially when the storage system is upgraded.
========================================================
*/
