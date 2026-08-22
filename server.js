"use strict";

/*
========================================================
PROJECT FILE HUB
MIL PROJECT • GAME DEVELOPMENT
========================================================

Backend:
    Node.js
    Express 5
    PostgreSQL
    Multer

DELETE KEY FORMAT:

    username-mil-RANDOMCODE

Example:

    Sunnel-mil-X7K2P9Q4

IMPORTANT:
- No parentheses.
- Delete keys are generated server-side.
- Only the SHA-256 hash is stored in PostgreSQL.
- The original delete key is returned only after upload.
- Uploaded files are NEVER executed by this server.
========================================================
*/

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const { Pool } = require("pg");

/*
========================================================
CONFIGURATION
========================================================
*/

const app = express();

const PORT =
    Number(process.env.PORT) || 10000;

const MAX_FILE_SIZE =
    50 * 1024 * 1024;

/*
========================================================
ALLOWED FILE EXTENSIONS
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
Only TXT files can be published as custom scripts.
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

    console.warn(
        "WARNING: DATABASE_URL is not configured."
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

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000

});

/*
========================================================
EXPRESS CONFIGURATION
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
UPLOAD STORAGE
========================================================
*/

const upload = multer({

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

    console.log(
        "Database initialized successfully."
    );
}

/*
========================================================
HELPERS
========================================================
*/

/*
Generate UUID.
*/

function generateId() {

    return crypto.randomUUID();
}

/*
========================================================
DELETE KEY GENERATION
========================================================

Format:

    username-mil-RANDOMCODE

Example:

    Sunnel-mil-X7K2P9Q4

The random portion uses cryptographically secure
random bytes.

We use uppercase letters and numbers while avoiding
ambiguous characters such as:

    0
    O
    I
    1
========================================================
*/

function generateRandomCode(length = 8) {

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code = "";

    while (
        code.length < length
    ) {

        const randomByte =
            crypto.randomBytes(1)[0];

        const index =
            randomByte %
            alphabet.length;

        code +=
            alphabet[index];
    }

    return code;
}

/*
========================================================
USERNAME FOR DELETE KEY
========================================================

Only safe characters are allowed in the key.

Spaces and symbols are converted into hyphens.

Example:

    "John Doe"
        ↓
    "John-Doe"

    "john_123"
        ↓
    "john-123"
========================================================
*/

function cleanUsernameForKey(
    username
) {

    let value =
        String(username || "")
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

    /*
    Prevent an empty username from creating
    a malformed delete key.
    */

    if (!value) {

        value = "User";
    }

    /*
    Keep the generated key reasonably sized.
    */

    return value.slice(0, 40);
}

/*
========================================================
CREATE DELETE KEY
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

    return `${safeUsername}-mil-${randomCode}`;
}

/*
========================================================
HASH DELETE KEY
========================================================
*/

function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

/*
========================================================
CLEAN TEXT
========================================================
*/

function cleanText(
    value,
    maxLength
) {

    if (
        typeof value !==
        "string"
    ) {

        return "";
    }

    return value
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maxLength);
}

/*
========================================================
GET FILE EXTENSION
========================================================
*/

function getExtension(
    filename
) {

    return path
        .extname(filename || "")
        .slice(1)
        .toLowerCase();
}

/*
========================================================
PUBLIC FILE OBJECT
========================================================
*/

function safePublicFile(row) {

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
            Number(row.size),

        date:
            new Date(
                row.uploaded_at
            ).getTime(),

        downloads:
            Number(row.downloads),

        script:
            row.is_script

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
REAL-TIME EVENTS
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

        clients.add(res);

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
GET PUBLIC FILES
========================================================
*/

app.get(
    "/api/files",
    async (req, res) => {

        try {

            const search =
                cleanText(
                    req.query.search || "",
                    100
                );

            const uploader =
                cleanText(
                    req.query.uploader || "",
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
            Search filename,
            display name,
            uploader and extension.
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
            Exact uploader filter.
            */

            if (uploader) {

                values.push(
                    uploader
                );

                conditions.push(
                    `uploader = $${values.length}`
                );
            }

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
                "GET /api/files:",
                error
            );

            res.status(500).json({

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
GET UPLOADER LIST
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
                "GET /api/uploaders:",
                error
            );

            res.status(500).json({

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
                "GET /api/stats:",
                error
            );

            res.status(500).json({

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
UPLOAD FILE
========================================================
*/

app.post(
    "/api/files",
    upload.single("file"),
    async (req, res) => {

        try {

            /*
            Make sure a file exists.
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
            Get uploader name.
            */

            const uploader =
                cleanText(
                    req.body.uploader,
                    80
                );

            /*
            Get display name.
            */

            const displayName =
                cleanText(
                    req.body.displayName,
                    100
                );

            /*
            Get extension.
            */

            const extension =
                getExtension(
                    req.file.originalname
                );

            /*
            Uploader required.
            */

            if (!uploader) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Please enter your uploader name."

                });
            }

            /*
            Display name required.
            */

            if (!displayName) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Display name is required."

                });
            }

            /*
            File extension check.
            */

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
            File size check.
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
            Determine whether this is
            a custom script.
            */

            const isScript =
                SCRIPT_EXTENSIONS.has(
                    extension
                );

            /*
            If frontend explicitly says
            this is a script, it must be TXT.
            */

            if (
                req.body.isScript === "true" &&
                !isScript
            ) {

                return res.status(
                    400
                ).json({

                    success:
                        false,

                    error:
                        "Custom scripts must be .txt files."

                });
            }

            /*
            Generate file UUID.
            */

            const id =
                generateId();

            /*
            ========================================================
            GENERATE DELETE KEY
            ========================================================

            Example:

                Sunnel-mil-X7K2P9Q4
            */

            const deleteToken =
                generateDeleteToken(
                    uploader
                );

            /*
            Hash the key before database storage.
            */

            const deleteTokenHash =
                hashToken(
                    deleteToken
                );

            /*
            Insert file.
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
            Notify connected clients.
            */

            broadcastLibraryUpdate();

            /*
            ========================================================
            IMPORTANT
            ========================================================

            The deleteToken is intentionally returned
            here.

            It should be displayed by the frontend
            in the "Keep this key safe" popup.

            It is NOT stored in plain text in PostgreSQL.
            */

            res.status(
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

                /*
                Helpful frontend metadata.
                */

                deleteKey: {

                    format:
                        "username-mil-RANDOMCODE",

                    warning:
                        "Keep this delete key safe. You need it to delete your uploaded file. It cannot be recovered if lost."

                }

            });

        }

        catch (error) {

            console.error(
                "POST /api/files:",
                error
            );

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

            res.status(
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
GET FILE DETAILS
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
                "GET /api/files/:id:",
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
DOWNLOAD FILE
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

            res.send(
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
                "SCRIPT PREVIEW:",
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

Required key:

    username-mil-RANDOMCODE

Example:

    Sunnel-mil-X7K2P9Q4

The server hashes the supplied key and compares
it with the stored hash.

The actual delete key is never stored.
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

            /*
            Delete key required.
            */

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

            /*
            Hash supplied delete key.
            */

            const tokenHash =
                hashToken(
                    token
                );

            /*
            Delete only if both ID and
            delete-key hash match.
            */

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

            /*
            Invalid key.
            */

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

            /*
            Successful deletion.
            */

            broadcastLibraryUpdate();

            res.json({

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
HEALTH CHECK
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

            console.error(
                "HEALTH CHECK:",
                error
            );

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
FRONTEND STATIC FILES
========================================================
*/

const publicDirectory =
    path.join(
        __dirname,
        "public"
    );

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
            (error) => {

                if (error) {

                    console.error(
                        "Frontend error:",
                        error
                    );

                    if (
                        !res.headersSent
                    ) {

                        res.status(
                            404
                        ).send(
                            "PROJECT FILE HUB frontend not found. Make sure public/index.html exists."
                        );
                    }
                }
            }
        );
    }
);

/*
========================================================
MULTER / GLOBAL ERROR HANDLER
========================================================
*/

app.use(
    (error, req, res, next) => {

        console.error(
            "SERVER ERROR:",
            error
        );

        /*
        Multer errors.
        */

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
                    error.message ||
                    "Upload error."

            });
        }

        /*
        Unsupported file extension.
        */

        if (
            error &&
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

        /*
        If headers were already sent.
        */

        if (
            res.headersSent
        ) {

            return next(
                error
            );
        }

        res.status(
            error.statusCode || 500
        ).json({

            success:
                false,

            error:
                error.statusCode
                    ? error.message
                    : "An unexpected server error occurred."

        });
    }
);

/*
========================================================
SERVER START
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
                    `Server listening on port ${PORT}`
                );

                console.log(
                    "Database: connected"
                );

                console.log(
                    "Maximum upload: 50 MB"
                );

                console.log(
                    "Delete key format:"
                );

                console.log(
                    "username-mil-RANDOMCODE"
                );

                console.log(
                    "Express 5 wildcard routing: enabled"
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Database initialization failed:"
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
        `${signal} received. Shutting down...`
    );

    /*
    Close SSE clients.
    */

    for (
        const client of clients
    ) {

        try {

            client.end();

        }

        catch {

            // Ignore already closed clients.

        }
    }

    /*
    Close PostgreSQL.
    */

    try {

        await pool.end();

        console.log(
            "Database connection closed."
        );

    }

    catch (error) {

        console.error(
            "Database shutdown error:",
            error
        );
    }

    process.exit(0);
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

/*
========================================================
END
========================================================
*/
