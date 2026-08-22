"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();

const PORT = Number(process.env.PORT) || 10000;
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

// Only TXT files can be published as custom scripts.
const SCRIPT_EXTENSIONS = new Set(["txt"]);

/*
========================================================
DATABASE
========================================================

Render PostgreSQL supplies DATABASE_URL.

IMPORTANT:
The database stores the actual file bytes in BYTEA.

For a small/medium project this is acceptable.

For a large production file service, move the actual
file bytes to object storage and keep metadata in PostgreSQL.
========================================================
*/

if (!process.env.DATABASE_URL) {
    console.error("ERROR: DATABASE_URL is not configured.");
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
            ? {
                  rejectUnauthorized: false
              }
            : false,

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
});

/*
========================================================
EXPRESS
========================================================
*/

app.disable("x-powered-by");

app.use(
    express.json({
        limit: "2mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "2mb"
    })
);

/*
========================================================
MULTER
========================================================

Files are temporarily stored in RAM while being uploaded.

Maximum:
50 MB
========================================================
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
DATABASE INITIALIZATION
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

            uploaded_at TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            downloads BIGINT NOT NULL
                DEFAULT 0,

            is_script BOOLEAN NOT NULL
                DEFAULT FALSE,

            data BYTEA NOT NULL,

            delete_token_hash TEXT NOT NULL
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        files_uploaded_at_idx
        ON files(uploaded_at DESC);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        files_uploader_idx
        ON files(uploader);
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        files_extension_idx
        ON files(extension);
    `);

    console.log("Database initialized.");
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
    return crypto
        .randomBytes(32)
        .toString("hex");
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

        date: new Date(
            row.uploaded_at
        ).getTime(),

        downloads: Number(
            row.downloads
        ),

        script: row.is_script
    };
}

/*
========================================================
REAL-TIME CLIENTS
========================================================

Server-Sent Events (SSE).

When somebody uploads/deletes/downloads a file,
connected browsers are notified.

The frontend can then request the newest library.
========================================================
*/

const clients = new Set();

function broadcastLibraryUpdate() {
    const message =
        `event: library-update\n` +
        `data: ${JSON.stringify({
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
API: EVENTS
========================================================
*/

app.get("/api/events", (req, res) => {
    res.setHeader(
        "Content-Type",
        "text/event-stream"
    );

    res.setHeader(
        "Cache-Control",
        "no-cache"
    );

    res.setHeader(
        "Connection",
        "keep-alive"
    );

    res.setHeader(
        "X-Accel-Buffering",
        "no"
    );

    if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
    }

    res.write(
        `event: connected\n` +
        `data: ${JSON.stringify({
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
API: GET FILES
========================================================
*/

app.get("/api/files", async (req, res) => {
    try {
        const search = cleanText(
            req.query.search || "",
            100
        );

        const uploader = cleanText(
            req.query.uploader || "",
            100
        );

        const sort = String(
            req.query.sort || "newest"
        );

        const values = [];
        const conditions = [];

        if (search) {
            values.push(`%${search}%`);

            const parameter =
                `$${values.length}`;

            conditions.push(`
                (
                    name ILIKE ${parameter}
                    OR display_name ILIKE ${parameter}
                    OR uploader ILIKE ${parameter}
                    OR extension ILIKE ${parameter}
                )
            `);
        }

        if (uploader) {
            values.push(uploader);

            conditions.push(
                `uploader = $${values.length}`
            );
        }

        let orderBy = `
            uploaded_at DESC
        `;

        switch (sort) {
            case "oldest":
                orderBy = `
                    uploaded_at ASC
                `;
                break;

            case "name":
                orderBy = `
                    LOWER(display_name) ASC
                `;
                break;

            case "largest":
                orderBy = `
                    size DESC
                `;
                break;

            case "newest":
            default:
                orderBy = `
                    uploaded_at DESC
                `;
                break;
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

        const result =
            await pool.query(
                query,
                values
            );

        res.json({
            success: true,

            files: result.rows.map(
                safePublicFile
            )
        });

    } catch (error) {
        console.error(
            "GET FILES ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error:
                "Unable to load public files."
        });
    }
});

/*
========================================================
API: UPLOADERS
========================================================
*/

app.get(
    "/api/uploaders",
    async (req, res) => {
        try {
            const result =
                await pool.query(`
                    SELECT
                        DISTINCT uploader
                    FROM files
                    ORDER BY
                        LOWER(uploader) ASC
                `);

            res.json({
                success: true,

                uploaders:
                    result.rows.map(
                        row => row.uploader
                    )
            });

        } catch (error) {
            console.error(
                "UPLOADERS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Unable to load uploaders."
            });
        }
    }
);

/*
========================================================
API: STATISTICS
========================================================
*/

app.get("/api/stats", async (req, res) => {
    try {
        const result =
            await pool.query(`
                SELECT

                    COUNT(*)::BIGINT
                        AS files,

                    COUNT(*)
                        FILTER (
                            WHERE is_script = TRUE
                        )::BIGINT
                        AS scripts,

                    COALESCE(
                        SUM(size),
                        0
                    )::BIGINT
                        AS total_size,

                    COALESCE(
                        SUM(downloads),
                        0
                    )::BIGINT
                        AS downloads

                FROM files
            `);

        const row =
            result.rows[0];

        res.json({
            success: true,

            stats: {
                files:
                    Number(row.files),

                scripts:
                    Number(row.scripts),

                totalSize:
                    Number(row.total_size),

                downloads:
                    Number(row.downloads)
            }
        });

    } catch (error) {
        console.error(
            "STATS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error:
                "Unable to load statistics."
        });
    }
});

/*
========================================================
API: UPLOAD
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
                    error:
                        "Please select a file."
                });
            }

            const uploader =
                cleanText(
                    req.body.uploader,
                    80
                );

            const displayName =
                cleanText(
                    req.body.displayName,
                    100
                );

            const extension =
                getExtension(
                    req.file.originalname
                );

            /*
            ================================================
            VALIDATION
            ================================================
            */

            if (!uploader) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Please enter your uploader name."
                });
            }

            if (!displayName) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Display name is required."
                });
            }

            if (
                !ALLOWED_EXTENSIONS.has(
                    extension
                )
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "This file type is not allowed."
                });
            }

            if (
                req.file.size >
                MAX_FILE_SIZE
            ) {
                return res.status(413).json({
                    success: false,
                    error:
                        "File is too large. Maximum allowed size is 50 MB."
                });
            }

            const isScript =
                SCRIPT_EXTENSIONS.has(
                    extension
                );

            /*
            If frontend explicitly says this is
            a script, it MUST be TXT.
            */

            if (
                req.body.isScript === "true" &&
                !isScript
            ) {
                return res.status(400).json({
                    success: false,
                    error:
                        "Custom scripts must be .txt files."
                });
            }

            /*
            ================================================
            GENERATE IDENTIFIERS
            ================================================
            */

            const id =
                generateId();

            const deleteToken =
                generateDeleteToken();

            const deleteTokenHash =
                hashToken(
                    deleteToken
                );

            /*
            ================================================
            DATABASE INSERT
            ================================================
            */

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
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10
                )
                `,
                [
                    id,

                    req.file
                        .originalname,

                    displayName,

                    uploader,

                    extension,

                    req.file
                        .mimetype ||
                        "application/octet-stream",

                    req.file.size,

                    isScript,

                    req.file.buffer,

                    deleteTokenHash
                ]
            );

            /*
            Tell every connected browser
            that the library changed.
            */

            broadcastLibraryUpdate();

            res.status(201).json({
                success: true,

                file: {
                    id,

                    name:
                        req.file
                            .originalname,

                    displayName,

                    uploader,

                    extension,

                    type:
                        req.file.mimetype ||
                        "application/octet-stream",

                    size:
                        req.file.size,

                    script:
                        isScript
                },

                /*
                PRIVATE DELETE KEY

                The frontend should save this locally
                for the uploader.

                It is NOT stored directly in PostgreSQL.
                */

                deleteToken
            });

        } catch (error) {
            console.error(
                "UPLOAD ERROR:",
                error
            );

            if (
                error instanceof
                    multer.MulterError &&
                error.code ===
                    "LIMIT_FILE_SIZE"
            ) {
                return res.status(413).json({
                    success: false,
                    error:
                        "File is too large. Maximum allowed size is 50 MB."
                });
            }

            res.status(500).json({
                success: false,
                error:
                    "Upload failed."
            });
        }
    }
);

/*
========================================================
API: FILE DETAILS
========================================================
*/

app.get(
    "/api/files/:id",
    async (req, res) => {
        try {
            const result =
                await pool.query(
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
                        is_script
                    FROM files
                    WHERE id = $1
                    `,
                    [
                        req.params.id
                    ]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    error:
                        "File not found."
                });
            }

            res.json({
                success: true,

                file:
                    safePublicFile(
                        result.rows[0]
                    )
            });

        } catch (error) {
            console.error(
                "DETAILS ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Unable to load file."
            });
        }
    }
);

/*
========================================================
API: DOWNLOAD
========================================================
*/

app.get(
    "/api/files/:id/download",
    async (req, res) => {
        try {
            const result =
                await pool.query(
                    `
                    SELECT
                        name,
                        mime_type,
                        data
                    FROM files
                    WHERE id = $1
                    `,
                    [
                        req.params.id
                    ]
                );

            if (!result.rows.length) {
                return res.status(404).send(
                    "File not found."
                );
            }

            const file =
                result.rows[0];

            /*
            Increment download counter.
            */

            await pool.query(
                `
                UPDATE files

                SET downloads =
                    downloads + 1

                WHERE id = $1
                `,
                [
                    req.params.id
                ]
            );

            broadcastLibraryUpdate();

            /*
            Force browser download.
            */

            res.setHeader(
                "Content-Type",
                file.mime_type ||
                    "application/octet-stream"
            );

            res.setHeader(
                "Content-Disposition",
                `attachment; filename*=UTF-8''${encodeURIComponent(
                    file.name
                )}`
            );

            res.setHeader(
                "Content-Length",
                file.data.length
            );

            res.send(file.data);

        } catch (error) {
            console.error(
                "DOWNLOAD ERROR:",
                error
            );

            res.status(500).send(
                "Download failed."
            );
        }
    }
);

/*
========================================================
API: SCRIPT PREVIEW
========================================================
*/

app.get(
    "/api/files/:id/preview",
    async (req, res) => {
        try {
            const result =
                await pool.query(
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
                    [
                        req.params.id
                    ]
                );

            if (!result.rows.length) {
                return res.status(404).json({
                    success: false,
                    error:
                        "File not found."
                });
            }

            const file =
                result.rows[0];

            if (!file.is_script) {
                return res.status(400).json({
                    success: false,
                    error:
                        "This file is not a script."
                });
            }

            /*
            TXT is decoded as text.

            NEVER execute this content.

            The frontend must use:
                element.textContent = content;

            and NEVER:
                element.innerHTML = content;
            */

            const content =
                file.data.toString(
                    "utf8"
                );

            res.json({
                success: true,

                file: {
                    id: file.id,

                    name: file.name,

                    displayName:
                        file.display_name,

                    uploader:
                        file.uploader,

                    extension:
                        file.extension,

                    type:
                        file.mime_type,

                    size:
                        Number(file.size),

                    date:
                        new Date(
                            file.uploaded_at
                        ).getTime(),

                    downloads:
                        Number(
                            file.downloads
                        ),

                    script: true,

                    content
                }
            });

        } catch (error) {
            console.error(
                "PREVIEW ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Unable to preview script."
            });
        }
    }
);

/*
========================================================
API: DELETE
========================================================

Standalone public architecture:

Uploader receives a private delete token.

The token is hashed before being stored.

The actual token is never stored in plaintext.

Production systems should additionally use
authentication/authorization.
========================================================
*/

app.delete(
    "/api/files/:id",
    async (req, res) => {
        try {
            const token =
                typeof req.body.deleteToken ===
                "string"
                    ? req.body.deleteToken.trim()
                    : "";

            if (!token) {
                return res.status(401).json({
                    success: false,
                    error:
                        "Delete key required."
                });
            }

            const tokenHash =
                hashToken(token);

            const result =
                await pool.query(
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
                    error:
                        "Invalid delete key."
                });
            }

            broadcastLibraryUpdate();

            res.json({
                success: true
            });

        } catch (error) {
            console.error(
                "DELETE ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error:
                    "Delete failed."
            });
        }
    }
);

/*
========================================================
API: HEALTH
========================================================
*/

app.get(
    "/api/health",
    async (req, res) => {
        try {
            await pool.query(
                "SELECT 1"
            );

            res.json({
                success: true,

                status: "online",

                database:
                    "connected"
            });

        } catch (error) {
            console.error(
                "HEALTH ERROR:",
                error
            );

            res.status(503).json({
                success: false,

                status: "offline",

                database:
                    "disconnected"
            });
        }
    }
);

/*
========================================================
FRONTEND
========================================================

Serve files from:

/public
========================================================
*/

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);

/*
========================================================
SPA FALLBACK
========================================================

IMPORTANT:

Express 5 does NOT accept:

    app.get("*", ...)

Instead we use the Express 5-compatible
named wildcard:

    /{*splat}

This was the cause of your Render error.
========================================================
*/

app.get(
    "/{*splat}",
    (req, res) => {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

/*
========================================================
ERROR HANDLER
========================================================
*/

app.use(
    (error, req, res, next) => {
        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error instanceof
                multer.MulterError
        ) {
            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {
                return res.status(413).json({
                    success: false,
                    error:
                        "File is too large. Maximum allowed size is 50 MB."
                });
            }

            return res.status(400).json({
                success: false,
                error:
                    "Upload error: " +
                    error.message
            });
        }

        if (
            error.message ===
            "This file type is not supported."
        ) {
            return res.status(400).json({
                success: false,
                error:
                    error.message
            });
        }

        res.status(500).json({
            success: false,
            error:
                "An unexpected server error occurred."
        });
    }
);

/*
========================================================
GRACEFUL SHUTDOWN
========================================================
*/

async function shutdown(signal) {
    console.log(
        `${signal} received. Shutting down...`
    );

    for (const client of clients) {
        try {
            client.end();
        } catch {}
    }

    try {
        await pool.end();
    } catch {}

    process.exit(0);
}

process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);

/*
========================================================
START SERVER
========================================================
*/

initializeDatabase()
    .then(() => {
        app.listen(
            PORT,
            "0.0.0.0",
            () => {
                console.log(
                    "========================================"
                );

                console.log(
                    "PROJECT FILE HUB"
                );

                console.log(
                    "MIL GAME DEVELOPMENT"
                );

                console.log(
                    `Server listening on port ${PORT}`
                );

                console.log(
                    "Database: connected"
                );

                console.log(
                    "Maximum file size: 50 MB"
                );

                console.log(
                    "========================================"
                );
            }
        );
    })
    .catch((error) => {
        console.error(
            "DATABASE INITIALIZATION FAILED:"
        );

        console.error(error);

        process.exit(1);
    });

/*
========================================================
ARCHITECTURE
========================================================

CURRENT:

Browser
   ↓
Express API
   ↓
PostgreSQL
   ↓
BYTEA file storage


REAL-TIME:

User A uploads
      ↓
Render API
      ↓
PostgreSQL
      ↓
SSE broadcast
      ↓
User B / User C browsers
      ↓
Refresh public library


FUTURE LARGE-SCALE ARCHITECTURE:

Browser
   ↓
Express API
   ↓
PostgreSQL
   └── metadata
   ↓
Object Storage
   └── actual files

The API structure is intentionally kept separate from
the storage implementation so object storage can be added
later without rebuilding the entire frontend.
========================================================
*/
