"use strict";

/*
========================================================
PROJECT FILE HUB
MIL PROJECT • GAME DEVELOPMENT
========================================================

BACKEND
- Node.js
- Express 5
- PostgreSQL
- Multer

KEY SYSTEM
========================================================

Delete key format:

    username-mil-RANDOMCODE

Example:

    Sunnel-mil-X7K2P9Q4

IMPORTANT:
- Delete keys are generated server-side.
- Only a SHA-256 hash is stored in PostgreSQL.
- The original delete key is returned only after upload.
- Uploaded files are never executed.
- Only TXT files may be treated as custom scripts.
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

const MAX_SEARCH_LENGTH = 100;

const MAX_NAME_LENGTH = 100;

const MAX_UPLOADER_LENGTH = 80;

/*
========================================================
ALLOWED EXTENSIONS
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
Only TXT files can become custom scripts.
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
SECURITY HEADERS
========================================================
*/

app.use(
    (req, res, next) => {

        res.setHeader(
            "X-Content-Type-Options",
            "nosniff"
        );

        res.setHeader(
            "X-Frame-Options",
            "SAMEORIGIN"
        );

        res.setHeader(
            "Referrer-Policy",
            "strict-origin-when-cross-origin"
        );

        res.setHeader(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=()"
        );

        next();
    }
);

/*
========================================================
BASIC RATE LIMITING
========================================================
*/

const requestTracker = new Map();

const RATE_WINDOW = 60 * 1000;

const GENERAL_LIMIT = 240;

const UPLOAD_LIMIT = 20;

const DELETE_LIMIT = 30;

function getClientIp(req) {

    const forwarded =
        req.headers["x-forwarded-for"];

    if (typeof forwarded === "string") {

        return forwarded
            .split(",")[0]
            .trim();
    }

    return (
        req.socket?.remoteAddress ||
        "unknown"
    );
}

function rateLimit(
    limit,
    windowMs
) {

    return (req, res, next) => {

        const key =
            `${getClientIp(req)}:${req.path}`;

        const now =
            Date.now();

        let record =
            requestTracker.get(key);

        if (
            !record ||
            now - record.startedAt >= windowMs
        ) {

            record = {

                startedAt: now,

                count: 0

            };
        }

        record.count += 1;

        requestTracker.set(
            key,
            record
        );

        if (
            record.count > limit
        ) {

            return res.status(
                429
            ).json({

                success:
                    false,

                error:
                    "Too many requests. Please try again later."

            });
        }

        next();
    };
}

/*
Clean old rate-limit records.
*/

setInterval(
    () => {

        const now =
            Date.now();

        for (
            const [
                key,
                record
            ] of requestTracker
        ) {

            if (
                now - record.startedAt >
                RATE_WINDOW * 2
            ) {

                requestTracker.delete(
                    key
                );
            }
        }

    },
    RATE_WINDOW
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

    console.log(
        "Database initialized successfully."
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

Ambiguous characters are excluded:

0
1
I
O
========================================================
*/

function generateRandomCode(
    length = 8
) {

    const alphabet =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const randomBytes =
        crypto.randomBytes(
            length
        );

    let result = "";

    for (
        let i = 0;
        i < length;
        i++
    ) {

        result +=
            alphabet[
                randomBytes[i] %
                alphabet.length
            ];
    }

    return result;
}

/*
========================================================
CLEAN USERNAME FOR KEY
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

        value =
            "User";
    }

    return value.slice(
        0,
        40
    );
}

/*
========================================================
GENERATE DELETE KEY
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
        generateRandomCode(
            8
        );

    return (
        `${safeUsername}-mil-${randomCode}`
    );
}

/*
========================================================
HASH DELETE KEY
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
CONSTANT-TIME HASH COMPARISON
========================================================
*/

function tokensMatch(
    suppliedToken,
    storedHash
) {

    const suppliedHash =
        hashToken(
            suppliedToken
        );

    const a =
        Buffer.from(
            suppliedHash,
            "hex"
        );

    const b =
        Buffer.from(
            storedHash,
            "hex"
        );

    if (
        a.length !==
        b.length
    ) {

        return false;
    }

    return crypto.timingSafeEqual(
        a,
        b
    );
}

/*
========================================================
TEXT CLEANING
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
        .replace(
            /\s+/g,
            " "
        )
        .slice(
            0,
            maxLength
        );
}

/*
========================================================
EXTENSION
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
SAFE DISPLAY FILENAME
========================================================
*/

function safeDisplayFilename(
    filename
) {

    const original =
        String(
            filename || "file"
        );

    const basename =
        path.basename(
            original
        );

    return basename
        .replace(
            /[\r\n"]/g,
            "_"
        )
        .slice(
            0,
            255
        );
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
SSE
========================================================
*/

app.get(
    "/api/events",
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
    async (req, res) => {

        try {

            const search =
                cleanText(
                    req.query.search || "",
                    MAX_SEARCH_LENGTH
                );

            const uploader =
                cleanText(
                    req.query.uploader || "",
                    MAX_UPLOADER_LENGTH
                );

            const sort =
                String(
                    req.query.sort ||
                    "newest"
                );

            const values = [];

            const conditions = [];

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

            switch (sort) {

                case "oldest":

                    orderBy =
                        "uploaded_at ASC";

                    break;

                case "name":

                    orderBy =
                        "LOWER(display_name) ASC";

                    break;

                case "largest":

                    orderBy =
                        "size DESC";

                    break;

                case "downloads":

                    orderBy =
                        "downloads DESC";

                    break;

                default:

                    orderBy =
                        "uploaded_at DESC";
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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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
UPLOAD
========================================================
*/

app.post(
    "/api/files",
    rateLimit(
        UPLOAD_LIMIT,
        RATE_WINDOW
    ),
    upload.single("file"),
    async (req, res) => {

        try {

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

            const uploader =
                cleanText(
                    req.body.uploader,
                    MAX_UPLOADER_LENGTH
                );

            const displayName =
                cleanText(
                    req.body.displayName,
                    MAX_NAME_LENGTH
                );

            const extension =
                getExtension(
                    req.file.originalname
                );

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

            const isScript =
                SCRIPT_EXTENSIONS.has(
                    extension
                );

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
            ========================================================
            KEY SYSTEM
            ========================================================
            */

            const deleteToken =
                generateDeleteToken(
                    uploader
                );

            const deleteTokenHash =
                hashToken(
                    deleteToken
                );

            const id =
                generateId();

            const safeOriginalName =
                safeDisplayFilename(
                    req.file.originalname
                );

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

                    safeOriginalName,

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

            broadcastLibraryUpdate();

            /*
            IMPORTANT:
            deleteToken is returned ONCE.
            PostgreSQL only receives the hash.
            */

            res.status(
                201
            ).json({

                success:
                    true,

                file: {

                    id,

                    name:
                        safeOriginalName,

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
                        "Keep this key safe. You need it to delete your uploaded file. It cannot be recovered if lost."

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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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

            if (
                !res.headersSent
            ) {

                res.status(
                    500
                ).send(
                    "Download failed."
                );
            }
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
    rateLimit(
        GENERAL_LIMIT,
        RATE_WINDOW
    ),
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

            /*
            Only UTF-8 TXT content is returned.
            */

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

DELETE REQUEST:

DELETE /api/files/:id

JSON BODY:

{
    "deleteToken":
        "Sunnel-mil-X7K2P9Q4"
}

The key itself is never stored.

Only:

SHA-256(deleteToken)

is stored.
========================================================
*/

app.delete(
    "/api/files/:id",
    rateLimit(
        DELETE_LIMIT,
        RATE_WINDOW
    ),
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

            /*
            Get stored hash.
            */

            const lookup =
                await pool.query(
                    `
                    SELECT
                        delete_token_hash

                    FROM files

                    WHERE id = $1
                    `,
                    [
                        req.params.id
                    ]
                );

            if (
                !lookup.rows.length
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

            const storedHash =
                lookup.rows[0]
                    .delete_token_hash;

            /*
            Constant-time comparison.
            */

            if (
                !tokensMatch(
                    token,
                    storedHash
                )
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
            Correct key:
            delete file.
            */

            const result =
                await pool.query(
                    `
                    DELETE FROM files

                    WHERE id = $1

                    RETURNING id
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
                        "File no longer exists."

                });
            }

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
                    "connected",

                timestamp:
                    new Date().toISOString()

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
FRONTEND
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

                if (
                    error &&
                    !res.headersSent
                ) {

                    console.error(
                        "Frontend error:",
                        error
                    );

                    res.status(
                        404
                    ).send(
                        "PROJECT FILE HUB frontend not found. Make sure public/index.html exists."
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
                    error.message ||
                    "Upload error."

            });
        }

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
                    "Security: enabled"
                );

                console.log(
                    "SSE realtime: enabled"
                );

                console.log(
                    "Script execution: disabled"
                );

            }
        );

    }

    catch (error) {

        console.error(
            "=========================================="
        );

        console.error(
            "SERVER STARTUP FAILED"
        );

        console.error(
            "=========================================="
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

let shuttingDown = false;

async function shutdown(
    signal
) {

    if (shuttingDown) {

        return;
    }

    shuttingDown = true;

    console.log(
        `${signal} received. Shutting down...`
    );

    /*
    Close SSE connections.
    */

    for (
        const client of clients
    ) {

        try {

            client.end();

        }

        catch {

            // Already closed.
        }
    }

    clients.clear();

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
UNHANDLED ERRORS
========================================================
*/

process.on(
    "unhandledRejection",
    (error) => {

        console.error(
            "UNHANDLED REJECTION:",
            error
        );
    }
);

process.on(
    "uncaughtException",
    (error) => {

        console.error(
            "UNCAUGHT EXCEPTION:",
            error
        );
    }
);

/*
========================================================
END
========================================================
*/
