"use strict";

/*
========================================================
PROJECT FILE HUB
BACKEND
========================================================

Features:
- Express server
- File uploads
- 50 MB upload limit
- Random delete keys
- Uploader names
- Download counter
- Search
- Uploader filtering
- Sorting
- Script preview
- Statistics
- Server health
- Server-Sent Events
- Persistent JSON database
- Secure delete-key comparison
========================================================
*/

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");


/*
========================================================
CONFIG
========================================================
*/

const app = express();

const PORT =
    process.env.PORT || 3000;

const ROOT =
    __dirname;

const PUBLIC_DIR =
    path.join(
        ROOT,
        "public"
    );

const STORAGE_DIR =
    path.join(
        ROOT,
        "storage"
    );

const UPLOAD_DIR =
    path.join(
        STORAGE_DIR,
        "uploads"
    );

const DATABASE_FILE =
    path.join(
        STORAGE_DIR,
        "files.json"
    );


/*
========================================================
CREATE DIRECTORIES
========================================================
*/

fs.mkdirSync(
    UPLOAD_DIR,
    {
        recursive: true
    }
);


/*
========================================================
DATABASE
========================================================
*/

let files = [];


function loadDatabase() {

    try {

        if (
            !fs.existsSync(
                DATABASE_FILE
            )
        ) {

            files = [];

            saveDatabase();

            return;
        }


        const raw =
            fs.readFileSync(
                DATABASE_FILE,
                "utf8"
            );


        files =
            JSON.parse(
                raw
            );


        if (
            !Array.isArray(files)
        ) {

            files = [];

        }

    }
    catch (error) {

        console.error(
            "Database load error:",
            error
        );

        files = [];

    }

}


function saveDatabase() {

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            files,
            null,
            2
        ),
        "utf8"
    );

}


loadDatabase();


/*
========================================================
MIDDLEWARE
========================================================
*/

app.use(
    express.json({
        limit: "1mb"
    })
);


app.use(
    express.urlencoded({
        extended: true
    })
);


app.use(
    express.static(
        PUBLIC_DIR
    )
);


/*
========================================================
MULTER
========================================================
*/

const storage =
    multer.diskStorage({

        destination:
            (
                req,
                file,
                callback
            ) => {

                callback(
                    null,
                    UPLOAD_DIR
                );

            },


        filename:
            (
                req,
                file,
                callback
            ) => {

                const id =
                    crypto.randomUUID();

                const safeOriginal =
                    path
                        .basename(
                            file.originalname
                        )
                        .replace(
                            /[^a-zA-Z0-9._-]/g,
                            "_"
                        );


                callback(
                    null,
                    `${id}-${safeOriginal}`
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {
            fileSize:
                50 * 1024 * 1024
        }

    });


/*
========================================================
EVENT CLIENTS
========================================================
*/

const eventClients =
    new Set();


function broadcastUpdate() {

    for (
        const response of eventClients
    ) {

        response.write(
            "event: library-update\n" +
            "data: {}\n\n"
        );

    }

}


/*
========================================================
USERNAME
========================================================
*/

function cleanUsername(
    username
) {

    return String(
        username || ""
    )
        .trim()
        .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
        )
        .slice(
            0,
            40
        );

}


/*
========================================================
DISPLAY NAME
========================================================
*/

function cleanDisplayName(
    value,
    fallback
) {

    const result =
        String(
            value || ""
        )
        .trim()
        .slice(
            0,
            100
        );


    return result ||
        fallback;

}


/*
========================================================
DELETE KEY
========================================================
*/

function generateDeleteKey(
    username
) {

    const clean =
        cleanUsername(
            username
        );


    const random =
        crypto
            .randomBytes(
                8
            )
            .toString(
                "hex"
            )
            .toUpperCase();


    return (
        clean +
        "-MIL-" +
        random
    );

}


/*
========================================================
HASH DELETE KEY
========================================================

The raw key is returned only during publishing.

The database stores a hash.
========================================================
*/

function hashDeleteKey(
    key
) {

    return crypto
        .createHash(
            "sha256"
        )
        .update(
            key
        )
        .digest(
            "hex"
        );

}


/*
========================================================
SAFE KEY COMPARISON
========================================================
*/

function verifyDeleteKey(
    supplied,
    storedHash
) {

    const suppliedHash =
        hashDeleteKey(
            supplied
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
FILE TYPE
========================================================
*/

function getExtension(
    filename
) {

    return path
        .extname(
            filename
        )
        .replace(
            ".",
            ""
        )
        .toLowerCase();

}


function isScript(
    extension
) {

    return [
        "js",
        "mjs",
        "cjs",
        "ts",
        "tsx",
        "jsx",
        "css",
        "html",
        "htm",
        "json",
        "xml",
        "py",
        "lua",
        "java",
        "cpp",
        "c",
        "h",
        "hpp",
        "cs",
        "php",
        "rb",
        "go",
        "rs",
        "sh",
        "bat"
    ].includes(
        extension
    );

}


/*
========================================================
PUBLIC FILE OBJECT
========================================================
*/

function publicFile(
    file
) {

    return {

        id:
            file.id,

        name:
            file.name,

        displayName:
            file.displayName,

        uploader:
            file.uploader,

        extension:
            file.extension,

        size:
            file.size,

        date:
            file.date,

        downloads:
            file.downloads,

        script:
            file.script

    };

}


/*
========================================================
HEALTH
========================================================
*/

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            status:
                "online",

            uptime:
                process.uptime(),

            time:
                Date.now()

        });

    }
);


/*
========================================================
PUBLISH FILE
========================================================
*/

app.post(
    "/api/files",
    upload.single("file"),
    (req, res) => {

        try {

            if (
                !req.file
            ) {

                return res.status(400).json({

                    success: false,

                    error:
                        "No file was uploaded."

                });

            }


            const username =
                cleanUsername(
                    req.body.uploader
                );


            if (!username) {

                fs.unlinkSync(
                    req.file.path
                );


                return res.status(400).json({

                    success: false,

                    error:
                        "Uploader name is required."

                });

            }


            const originalName =
                path.basename(
                    req.file.originalname
                );


            const extension =
                getExtension(
                    originalName
                );


            const displayName =
                cleanDisplayName(
                    req.body.displayName,
                    originalName
                );


            const id =
                crypto.randomUUID();


            const deleteKey =
                generateDeleteKey(
                    username
                );


            const record = {

                id,

                name:
                    originalName,

                displayName,

                uploader:
                    username,

                extension,

                size:
                    req.file.size,

                date:
                    Date.now(),

                downloads:
                    0,

                script:
                    isScript(
                        extension
                    ),

                storedName:
                    req.file.filename,

                deleteKeyHash:
                    hashDeleteKey(
                        deleteKey
                    )

            };


            files.unshift(
                record
            );


            saveDatabase();

            broadcastUpdate();


            /*
            IMPORTANT:
            The raw delete key is returned
            ONLY at publication time.
            */

            return res.status(201).json({

                success: true,

                deleteKey,

                file:
                    publicFile(
                        record
                    )

            });

        }
        catch (error) {

            console.error(
                "Publish error:",
                error
            );


            if (
                req.file &&
                req.file.path &&
                fs.existsSync(
                    req.file.path
                )
            ) {

                try {

                    fs.unlinkSync(
                        req.file.path
                    );

                }
                catch {}

            }


            return res.status(500).json({

                success: false,

                error:
                    "Unable to publish file."

            });

        }

    }
);


/*
========================================================
GET FILES
========================================================
*/

app.get(
    "/api/files",
    (req, res) => {

        let result =
            [...files];


        const search =
            String(
                req.query.search || ""
            )
            .trim()
            .toLowerCase();


        const uploader =
            String(
                req.query.uploader || ""
            )
            .trim();


        const sort =
            String(
                req.query.sort ||
                "newest"
            );


        if (search) {

            result =
                result.filter(
                    file => {

                        return (

                            file.name
                                .toLowerCase()
                                .includes(
                                    search
                                )

                            ||

                            file.displayName
                                .toLowerCase()
                                .includes(
                                    search
                                )

                            ||

                            file.uploader
                                .toLowerCase()
                                .includes(
                                    search
                                )

                        );

                    }
                );

        }


        if (uploader) {

            result =
                result.filter(
                    file =>
                        file.uploader ===
                        uploader
                );

        }


        switch (
            sort
        ) {

            case "oldest":

                result.sort(
                    (
                        a,
                        b
                    ) =>
                        a.date -
                        b.date
                );

                break;


            case "name":

                result.sort(
                    (
                        a,
                        b
                    ) =>
                        a.displayName
                            .localeCompare(
                                b.displayName
                            )
                );

                break;


            case "largest":

                result.sort(
                    (
                        a,
                        b
                    ) =>
                        b.size -
                        a.size
                );

                break;


            case "downloads":

                result.sort(
                    (
                        a,
                        b
                    ) =>
                        b.downloads -
                        a.downloads
                );

                break;


            default:

                result.sort(
                    (
                        a,
                        b
                    ) =>
                        b.date -
                        a.date
                );

        }


        res.json({

            success: true,

            files:
                result.map(
                    publicFile
                )

        });

    }
);


/*
========================================================
DOWNLOAD
========================================================
*/

app.get(
    "/api/files/:id/download",
    (req, res) => {

        const file =
            files.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!file) {

            return res.status(404).send(
                "File not found."
            );

        }


        const filePath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return res.status(404).send(
                "Stored file not found."
            );

        }


        file.downloads++;

        saveDatabase();


        res.download(
            filePath,
            file.name,
            error => {

                if (error) {

                    console.error(
                        "Download error:",
                        error
                    );

                }

            }
        );

    }
);


/*
========================================================
PREVIEW
========================================================
*/

app.get(
    "/api/files/:id/preview",
    (req, res) => {

        const file =
            files.find(
                item =>
                    item.id ===
                    req.params.id
            );


        if (!file) {

            return res.status(404).json({

                success: false,

                error:
                    "File not found."

            });

        }


        if (!file.script) {

            return res.status(400).json({

                success: false,

                error:
                    "This file cannot be previewed."

            });

        }


        const filePath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return res.status(404).json({

                success: false,

                error:
                    "Stored file not found."

            });

        }


        try {

            const content =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );


            /*
            Protect the preview endpoint
            from extremely large text files.
            */

            const limited =
                content.slice(
                    0,
                    500000
                );


            res.json({

                success: true,

                file: {

                    name:
                        file.name,

                    content:
                        limited

                }

            });

        }
        catch {

            res.status(500).json({

                success: false,

                error:
                    "Unable to preview file."

            });

        }

    }
);


/*
========================================================
DELETE
========================================================
*/

app.delete(
    "/api/files/:id",
    (req, res) => {

        const fileIndex =
            files.findIndex(
                item =>
                    item.id ===
                    req.params.id
            );


        if (
            fileIndex === -1
        ) {

            return res.status(404).json({

                success: false,

                error:
                    "File not found."

            });

        }


        const file =
            files[fileIndex];


        const suppliedKey =
            String(
                req.body.deleteKey ||
                req.body.deleteToken ||
                ""
            )
            .trim();


        if (!suppliedKey) {

            return res.status(400).json({

                success: false,

                error:
                    "Delete key is required."

            });

        }


        if (
            !verifyDeleteKey(
                suppliedKey,
                file.deleteKeyHash
            )
        ) {

            return res.status(403).json({

                success: false,

                error:
                    "Invalid delete key."

            });

        }


        const filePath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        try {

            if (
                fs.existsSync(
                    filePath
                )
            ) {

                fs.unlinkSync(
                    filePath
                );

            }

        }
        catch (error) {

            console.error(
                "Physical file deletion error:",
                error
            );

            return res.status(500).json({

                success: false,

                error:
                    "Unable to remove the stored file."

            });

        }


        files.splice(
            fileIndex,
            1
        );


        saveDatabase();

        broadcastUpdate();


        return res.json({

            success: true,

            message:
                "File deleted successfully."

        });

    }
);


/*
========================================================
UPLOADERS
========================================================
*/

app.get(
    "/api/uploaders",
    (req, res) => {

        const uploaders =
            [
                ...new Set(
                    files.map(
                        file =>
                            file.uploader
                    )
                )
            ]
            .sort(
                (
                    a,
                    b
                ) =>
                    a.localeCompare(
                        b
                    )
            );


        res.json({

            success: true,

            uploaders

        });

    }
);


/*
========================================================
STATS
========================================================
*/

app.get(
    "/api/stats",
    (req, res) => {

        const totalSize =
            files.reduce(
                (
                    total,
                    file
                ) =>
                    total +
                    file.size,
                0
            );


        const scripts =
            files.filter(
                file =>
                    file.script
            ).length;


        const downloads =
            files.reduce(
                (
                    total,
                    file
                ) =>
                    total +
                    file.downloads,
                0
            );


        res.json({

            success: true,

            stats: {

                files:
                    files.length,

                scripts,

                downloads,

                totalSize

            }

        });

    }
);


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
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );


        res.flushHeaders();


        res.write(
            "retry: 5000\n\n"
        );


        eventClients.add(
            res
        );


        req.on(
            "close",
            () => {

                eventClients.delete(
                    res
                );

            }
        );

    }
);


/*
========================================================
MAIN PAGE
========================================================
*/

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                PUBLIC_DIR,
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
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
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
                        "Maximum file size is 50 MB."

                });

            }

        }


        res.status(500).json({

            success: false,

            error:
                "Internal server error."

        });

    }
);


/*
========================================================
START
========================================================
*/

app.listen(
    PORT,
    () => {

        console.log(
            `
╔══════════════════════════════════════╗
║       PROJECT FILE HUB ONLINE        ║
╠══════════════════════════════════════╣
║ Local: http://localhost:${PORT}       ║
║ Upload limit: 50 MB                  ║
║ Delete keys: ENABLED                 ║
╚══════════════════════════════════════╝
            `
        );

    }
);
