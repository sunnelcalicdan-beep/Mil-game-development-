"use strict";

/*
========================================================
PROJECT FILE HUB
MIL PROJECT • GAME DEVELOPMENT

STACK
- Node.js
- Express 5
- PostgreSQL
- Multer

DELETE KEY
    username-mil-RANDOMCODE

Example:
    Sunnel-mil-X7K2P9Q4

IMPORTANT
- Delete keys are generated ONLY by the backend.
- Plain delete keys are NEVER stored in PostgreSQL.
- Only SHA-256 hashes are stored.
- The original key is returned once after publishing.
- Uploaded files are stored as BYTEA.
- Uploaded files are never executed by this server.
========================================================
*/

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

const app = express();

/*
========================================================
CONFIG
========================================================
*/

const PORT =
    Number(process.env.PORT) || 10000;

const MAX_FILE_SIZE =
    50 * 1024 * 1024;

const publicDirectory =
    path.join(__dirname, "public");

/*
========================================================
ALLOWED FILE TYPES
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

/*
Only TXT files are treated as custom scripts.
*/

const SCRIPT_EXTENSIONS = new Set([
    "txt"
]);

/*
========================================================
DATABASE
========================================================
*/

if (!process.env.DATABASE_URL) {

    console.error(
        "DATABASE_URL is missing."
    );
}

const pool = new Pool({

    connectionString:
        process.env.DATABASE_URL,

    ssl:
        process.env.NODE_ENV === "production"
            ? {
                rejectUnauthorized: false
            }
            : false,

    max: 10,

    idleTimeoutMillis:
        30000,

    connectionTimeoutMillis:
        10000
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
*/

const upload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {

            fileSize:
                MAX_FILE_SIZE

        },

        fileFilter:
            (req, file, callback) => {

                const extension =
                    getExtension(
                        file.originalname
                    );

                if (
                    !ALLOWED_EXTENSIONS.has(
                        extension
                    )
                ) {

                    return callback(
                        new Error(
                            "This file type is not supported."
                        )
                    );
                }

                callback(
                    null,
                    true
                );
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

            uploaded_at
                TIMESTAMPTZ NOT NULL
                DEFAULT NOW(),

            downloads
                BIGINT NOT NULL
                DEFAULT 0,

            is_script
                BOOLEAN NOT NULL
                DEFAULT FALSE,

            data BYTEA NOT NULL,

            delete_token_hash
                TEXT NOT NULL

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

    await pool.query(`
        CREATE INDEX IF NOT EXISTS
        files_downloads_idx
        ON files(downloads DESC);
    `);

    console.log(
        "Database initialized."
    );
}

/*
========================================================
HELPERS
========================================================
*/

function generateId() {

    return crypto.randomUUID();
}

/*
========================================================
RANDOM DELETE KEY CODE
========================================================

Ambiguous characters removed:
0 O I 1
========================================================
*/

function generateRandomCode(
    length = 8
) {

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    while (
        code.length < length
    ) {

        const random =
            crypto.randomBytes(1)[0];

        const index =
            random %
            alphabet.length;

        code +=
            alphabet[index];
    }

    return code;
}

/*
========================================================
CLEAN USERNAME
========================================================
*/

function cleanUsernameForKey(
    username
) {

    let value =
        String(
            username || ""
        )
            .trim();

    value =
        value.replace(
            /[^a-zA-Z0-9_-]+/g,
            "-"
        );

    value =
        value.replace(
            /[-_]+/g,
            "-"
        );

    value =
        value.replace(
            /^-+|-+$/g,
            ""
        );

    if (!value) {

        value = "User";
    }

    return value.slice(
        0,
        40
    );
}

/*
========================================================
GENERATE DELETE TOKEN
========================================================
*/

function generateDeleteToken(
    username
) {

    const safeUsername =
        cleanUsernameForKey(
            username
        );

    const randomCode =
        generateRandomCode(8);

    return (
        `${safeUsername}-mil-${randomCode}`
    );
}

/*
========================================================
HASH TOKEN
========================================================
*/

function hashToken(
    token
) {

    return crypto
        .createHash("sha256")
        .update(
            token,
            "utf8"
        )
        .digest("hex");
}

/*
========================================================
SAFE TEXT
========================================================
*/

function cleanText(
    value,
    maxLength
) {

    if (
        typeof value !== "string"
    ) {

        return "";
    }

    return value
        .trim()
        .replace(/\s+/g, " ")
        .slice(
            0,
            maxLength
        );
}

/*
========================================================
FILE EXTENSION
========================================================
*/

function getExtension(
    filename
) {

    return path
        .extname(
            filename || ""
        )
        .slice(1)
        .toLowerCase();
}

/*
========================================================
PUBLIC FILE OBJECT
========================================================
*/

function safePublicFile(
    row
) {

    return {

        id:
            row.id,

        name:
            row.name,

        displayName:
            row.display_name,

        uploader:
            row.uploader,

        extension:
            row.extension,

        type:
            row.mime_type,

        size:
            Number(
                row.size
            ),

        date:
            new Date(
                row.uploaded_at
            ).getTime(),

        downloads:
            Number(
                row.downloads
            ),

        script:
            Boolean(
                row.is_script
            )
    };
}

/*
========================================================
REAL-TIME CLIENTS
========================================================
*/

const clients =
    new Set();

function broadcastLibraryUpdate() {

    const payload = {

        timestamp:
            Date.now()

    };

    const message =
        `event: library-update\n` +
        `data: ${JSON.stringify(
            payload
        )}\n\n`;

    for (
        const client of clients
    ) {

        try {

            client.write(
                message
            );

        }

        catch {

            clients.delete(
                client
            );
        }
    }
}

/*
========================================================
SERVER-SENT EVENTS
========================================================
*/

app.get(
    "/api/events",
    (req, res) => {

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache, no-transform"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        res.setHeader(
            "X-Accel-Buffering",
            "no"
        );

        res.flushHeaders();

        res.write(
            `event: connected\n` +
            `data: ${JSON.stringify({
                connected: true
            })}\n\n`
        );

        clients.add(
            res
        );

        const heartbeat =
            setInterval(
                () => {

                    try {

                        res.write(
                            ": heartbeat\n\n"
                        );

                    }

                    catch {

                        clearInterval(
                            heartbeat
                        );

                        clients.delete(
                            res
                        );
                    }

                },
                25000
            );

        req.on(
            "close",
            () => {

                clearInterval(
                    heartbeat
                );

                clients.delete(
                    res
                );
            }
        );
    }
);

/*
========================================================
GET FILES
========================================================
*/

app.get(
    "/api/files",
    async (req, res) => {

        try {

            const search =
                cleanText(
                    req.query.search,
                    100
                );

            const uploader =
                cleanText(
                    req.query.uploader,
                    100
                );

            const sort =
                String(
                    req.query.sort ||
                    "newest"
                );

            const values = [];
            const conditions = [];

            /*
            SEARCH
            */

            if (search) {

                values.push(
                    `%${search}%`
                );

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

            /*
            UPLOADER
            */

            if (uploader) {

                values.push(
                    uploader
                );

                conditions.push(
                    `uploader = $${values.length}`
                );
            }

            /*
            SORT
            */

            let orderBy =
                "uploaded_at DESC";

            if (
                sort === "oldest"
            ) {

                orderBy =
                    "uploaded_at ASC";

            }

            else if (
                sort === "name"
            ) {

                orderBy =
                    "LOWER(display_name) ASC";

            }

            else if (
                sort === "largest"
            ) {

                orderBy =
                    "size DESC";

            }

            else if (
                sort === "downloads"
            ) {

                orderBy =
                    "downloads DESC, uploaded_at DESC";
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
                        ? `WHERE ${conditions.join(
                            " AND "
                        )}`
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

                success:
                    true,

                files:
                    result.rows.map(
                        safePublicFile
                    )
            });

        }

        catch (error) {

            console.error(
                "GET FILES:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Unable to load public files."
            });
        }
    }
);

/*
========================================================
GET UPLOADERS
========================================================
*/

app.get(
    "/api/uploaders",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT DISTINCT uploader

                    FROM files

                    ORDER BY
                        LOWER(uploader) ASC
                `);

            res.json({

                success:
                    true,

                uploaders:
                    result.rows.map(
                        row =>
                            row.uploader
                    )
            });

        }

        catch (error) {

            console.error(
                "GET UPLOADERS:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Unable to load uploaders."
            });
        }
    }
);

/*
========================================================
STATISTICS
========================================================
*/

app.get(
    "/api/stats",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT

                        COUNT(*)::BIGINT
                            AS files,

                        COUNT(*)
                            FILTER (
                                WHERE
                                    is_script = TRUE
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

                success:
                    true,

                stats: {

                    files:
                        Number(
                            row.files
                        ),

                    scripts:
                        Number(
                            row.scripts
                        ),

                    totalSize:
                        Number(
                            row.total_size
                        ),

                    downloads:
                        Number(
                            row.downloads
                        )
                }
            });

        }

        catch (error) {

            console.error(
                "GET STATS:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Unable to load statistics."
            });
        }
    }
);

/*
========================================================
PUBLISH FILE
========================================================

THIS IS THE IMPORTANT PART.

The frontend sends:

    username
    displayName
    file

The backend then:

1. Validates username.
2. Validates file.
3. Generates delete key.
4. Hashes delete key.
5. Stores only hash.
6. Stores file.
7. Returns original delete key once.
========================================================
*/

app.post(
    "/api/files",
    upload.single("file"),
    async (req, res) => {

        try {

            /*
            FILE REQUIRED
            */

            if (!req.file) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Please select a file."
                });
            }

            /*
            USERNAME
            */

            const uploader =
                cleanText(
                    req.body.uploader,
                    80
                );

            if (!uploader) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Username is required."
                });
            }

            /*
            DISPLAY NAME

            If empty, automatically use filename.
            */

            let displayName =
                cleanText(
                    req.body.displayName,
                    100
                );

            if (!displayName) {

                displayName =
                    path.basename(
                        req.file.originalname,
                        path.extname(
                            req.file.originalname
                        )
                    ).slice(
                        0,
                        100
                    );
            }

            /*
            EXTENSION
            */

            const extension =
                getExtension(
                    req.file.originalname
                );

            if (
                !ALLOWED_EXTENSIONS.has(
                    extension
                )
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "This file type is not allowed."
                });
            }

            /*
            SIZE
            */

            if (
                req.file.size >
                MAX_FILE_SIZE
            ) {

                return res.status(
                    413
                ).json({

                    success:
                        false,

                    error:
                        "File is too large. Maximum allowed size is 50 MB."
                });
            }

            /*
            SCRIPT
            */

            const isScript =
                SCRIPT_EXTENSIONS.has(
                    extension
                );

            /*
            FILE ID
            */

            const id =
                generateId();

            /*
            ====================================================
            GENERATE DELETE KEY
            ====================================================
            */

            const deleteToken =
                generateDeleteToken(
                    uploader
                );

            /*
            ====================================================
            HASH DELETE KEY
            ====================================================
            */

            const deleteTokenHash =
                hashToken(
                    deleteToken
                );

            /*
            ====================================================
            DATABASE INSERT
            ====================================================
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

                    req.file.originalname,

                    displayName,

                    uploader,

                    extension,

                    req.file.mimetype ||
                        "application/octet-stream",

                    req.file.size,

                    isScript,

                    req.file.buffer,

                    deleteTokenHash
                ]
            );

            /*
            UPDATE LIBRARY
            */

            broadcastLibraryUpdate();

            /*
            ====================================================
            SUCCESS RESPONSE
            ====================================================

            The deleteToken exists ONLY in this response.

            PostgreSQL contains only deleteTokenHash.
            */

            return res.status(
                201
            ).json({

                success:
                    true,

                file: {

                    id,

                    name:
                        req.file.originalname,

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

                deleteToken,

                deleteKey: {

                    format:
                        "username-mil-RANDOMCODE",

                    warning:
                        "Save this key. It cannot be recovered if lost."
                }
            });

        }

        catch (error) {

            console.error(
                "PUBLISH FILE:",
                error
            );

            return res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Upload failed."
            });
        }
    }
);

/*
========================================================
GET FILE
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

            if (
                !result.rows.length
            ) {

                return res.status(
                    404
                ).json({

                    success:
                        false,

                    error:
                        "File not found."
                });
            }

            res.json({

                success:
                    true,

                file:
                    safePublicFile(
                        result.rows[0]
                    )
            });

        }

        catch (error) {

            console.error(
                "GET FILE:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Unable to load file."
            });
        }
    }
);

/*
========================================================
DOWNLOAD
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

            if (
                !result.rows.length
            ) {

                return res.status(
                    404
                ).send(
                    "File not found."
                );
            }

            const file =
                result.rows[0];

            /*
            Increment downloads.
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

            return res.send(
                file.data
            );
        }

        catch (error) {

            console.error(
                "DOWNLOAD:",
                error
            );

            res.status(
                500
            ).send(
                "Download failed."
            );
        }
    }
);

/*
========================================================
SCRIPT PREVIEW
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

            if (
                !result.rows.length
            ) {

                return res.status(
                    404
                ).json({

                    success:
                        false,

                    error:
                        "File not found."
                });
            }

            const file =
                result.rows[0];

            if (
                !file.is_script
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "This file is not a script."
                });
            }

            const content =
                file.data.toString(
                    "utf8"
                );

            res.json({

                success:
                    true,

                file: {

                    id:
                        file.id,

                    name:
                        file.name,

                    displayName:
                        file.display_name,

                    uploader:
                        file.uploader,

                    extension:
                        file.extension,

                    type:
                        file.mime_type,

                    size:
                        Number(
                            file.size
                        ),

                    date:
                        new Date(
                            file.uploaded_at
                        ).getTime(),

                    downloads:
                        Number(
                            file.downloads
                        ),

                    script:
                        true,

                    content
                }
            });
        }

        catch (error) {

            console.error(
                "PREVIEW:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Unable to preview script."
            });
        }
    }
);

/*
========================================================
DELETE FILE
========================================================

The user submits:

    username-mil-RANDOMCODE

We hash that key and compare it against the
stored SHA-256 hash.

The actual key is never retrieved from the DB.
========================================================
*/

app.delete(
    "/api/files/:id",
    async (req, res) => {

        try {

            const token =
                typeof req.body?.deleteToken ===
                "string"
                    ? req.body.deleteToken.trim()
                    : "";

            if (!token) {

                return res.status(
                    401
                ).json({

                    success:
                        false,

                    error:
                        "Delete key required."
                });
            }

            const tokenHash =
                hashToken(
                    token
                );

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

            if (
                !result.rows.length
            ) {

                return res.status(
                    403
                ).json({

                    success:
                        false,

                    error:
                        "Invalid delete key. The file was not deleted."
                });
            }

            broadcastLibraryUpdate();

            return res.json({

                success:
                    true,

                message:
                    "File deleted successfully."
            });
        }

        catch (error) {

            console.error(
                "DELETE:",
                error
            );

            res.status(
                500
            ).json({

                success:
                    false,

                error:
                    "Delete failed."
            });
        }
    }
);

/*
========================================================
HEALTH
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

                success:
                    true,

                status:
                    "online",

                database:
                    "connected"
            });
        }

        catch (error) {

            res.status(
                503
            ).json({

                success:
                    false,

                status:
                    "offline",

                database:
                    "disconnected"
            });
        }
    }
);

/*
========================================================
STATIC FRONTEND
========================================================
*/

app.use(
    express.static(
        publicDirectory
    )
);

/*
========================================================
EXPRESS 5 SPA FALLBACK
========================================================
*/

app.get(
    "/{*splat}",
    (req, res) => {

        res.sendFile(
            path.join(
                publicDirectory,
                "index.html"
            ),
            error => {

                if (
                    error &&
                    !res.headersSent
                ) {

                    res.status(
                        404
                    ).send(
                        "Project File Hub frontend not found."
                    );
                }
            }
        );
    }
);

/*
========================================================
GLOBAL ERROR HANDLER
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

                return res.status(
                    413
                ).json({

                    success:
                        false,

                    error:
                        "File is too large. Maximum allowed size is 50 MB."
                });
            }

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    error.message
            });
        }

        if (
            error.message ===
            "This file type is not supported."
        ) {

            return res.status(
                400
            ).json({

                success:
                    false,

                error:
                    "This file type is not supported."
            });
        }

        if (
            res.headersSent
        ) {

            return next(
                error
            );
        }

        res.status(
            500
        ).json({

            success:
                false,

            error:
                "An unexpected server error occurred."
        });
    }
);

/*
========================================================
START
========================================================
*/

async function startServer() {

    try {

        await initializeDatabase();

        app.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "=========================================="
                );

                console.log(
                    "PROJECT FILE HUB"
                );

                console.log(
                    "MIL PROJECT • GAME DEVELOPMENT"
                );

                console.log(
                    "=========================================="
                );

                console.log(
                    `Server running on port ${PORT}`
                );

                console.log(
                    "Database connected"
                );

                console.log(
                    "Maximum upload: 50 MB"
                );

                console.log(
                    "Delete key: username-mil-RANDOMCODE"
                );
            }
        );

    }

    catch (error) {

        console.error(
            "SERVER START FAILED:"
        );

        console.error(
            error
        );

        process.exit(1);
    }
}

startServer();

/*
========================================================
GRACEFUL SHUTDOWN
========================================================
*/

async function shutdown(
    signal
) {

    console.log(
        `${signal} received.`
    );

    for (
        const client of clients
    ) {

        try {

            client.end();

        }
        catch {}
    }

    try {

        await pool.end();

    }
    catch {}

    process.exit(
        0
    );
}

process.on(
    "SIGTERM",
    () =>
        shutdown("SIGTERM")
);

process.on(
    "SIGINT",
    () =>
        shutdown("SIGINT")
);
