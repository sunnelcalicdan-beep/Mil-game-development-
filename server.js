"use strict";

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

const MAX_FILE_SIZE =
    50 * 1024 * 1024;

const DATA_DIR =
    path.join(__dirname, "data");

const UPLOAD_DIR =
    path.join(DATA_DIR, "uploads");

const DATABASE_FILE =
    path.join(DATA_DIR, "files.json");


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

if (!fs.existsSync(DATABASE_FILE)) {

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            [],
            null,
            2
        )
    );

}


/*
========================================================
DATABASE
========================================================
*/

function readFiles() {

    try {

        return JSON.parse(
            fs.readFileSync(
                DATABASE_FILE,
                "utf8"
            )
        );

    }
    catch {

        return [];

    }

}


function writeFiles(files) {

    fs.writeFileSync(
        DATABASE_FILE,
        JSON.stringify(
            files,
            null,
            2
        )
    );

}


/*
========================================================
MULTER
========================================================
*/

const storage =
    multer.diskStorage({

        destination:
            function (
                request,
                file,
                callback
            ) {

                callback(
                    null,
                    UPLOAD_DIR
                );

            },

        filename:
            function (
                request,
                file,
                callback
            ) {

                const random =
                    crypto
                        .randomBytes(16)
                        .toString("hex");

                callback(
                    null,
                    random
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            fileSize:
                MAX_FILE_SIZE

        }

    });


/*
========================================================
MIDDLEWARE
========================================================
*/

app.use(
    express.json(
        {
            limit: "1mb"
        }
    )
);

app.use(
    express.urlencoded(
        {
            extended: true
        }
    )
);

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
REALTIME CLIENTS
========================================================
*/

const eventClients =
    new Set();


function broadcastUpdate() {

    for (
        const response
        of eventClients
    ) {

        response.write(
            "event: library-update\n" +
            "data: {}\n\n"
        );

    }

}


/*
========================================================
NORMALIZE USERNAME
========================================================
*/

function normalizeUsername(
    username
) {

    return String(
        username || ""
    )
        .trim()
        .replace(
            /\s+/g,
            " "
        )
        .slice(
            0,
            80
        );

}


/*
========================================================
DELETE KEY
========================================================

The actual key is generated ONLY on the server.

The database stores a SHA-256 hash instead
of storing the delete key itself.
========================================================
*/

function generateDeleteKey(
    username
) {

    const safeUsername =
        username
            .toLowerCase()
            .replace(
                /[^a-z0-9]+/g,
                "-"
            )
            .replace(
                /^-+|-+$/g,
                ""
            )
            .slice(
                0,
                30
            );

    const randomCode =
        crypto
            .randomBytes(18)
            .toString("base64url");

    return `PFH-${safeUsername}-${randomCode}`;

}


function hashDeleteKey(
    key
) {

    return crypto
        .createHash("sha256")
        .update(
            String(key)
        )
        .digest("hex");

}


/*
========================================================
HEALTH
========================================================
*/

app.get(
    "/api/health",
    (
        request,
        response
    ) => {

        response.json({

            success:
                true,

            status:
                "online",

            time:
                Date.now()

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
    (
        request,
        response
    ) => {

        const files =
            readFiles();

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
                (a, b) =>
                    a.localeCompare(b)
            );

        response.json({

            success:
                true,

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
    (
        request,
        response
    ) => {

        const files =
            readFiles();

        let downloads =
            0;

        let totalSize =
            0;

        let scripts =
            0;

        for (
            const file
            of files
        ) {

            downloads +=
                Number(
                    file.downloads || 0
                );

            totalSize +=
                Number(
                    file.size || 0
                );

            if (
                file.script
            ) {

                scripts++;

            }

        }

        response.json({

            success:
                true,

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
LIST FILES
========================================================
*/

app.get(
    "/api/files",
    (
        request,
        response
    ) => {

        let files =
            readFiles();

        const search =
            String(
                request.query.search || ""
            )
                .trim()
                .toLowerCase();

        const uploader =
            String(
                request.query.uploader || ""
            )
                .trim();

        const sort =
            request.query.sort ||
            "newest";


        if (search) {

            files =
                files.filter(
                    file => {

                        return (
                            String(
                                file.name
                            )
                                .toLowerCase()
                                .includes(search)
                            ||

                            String(
                                file.displayName
                            )
                                .toLowerCase()
                                .includes(search)
                            ||

                            String(
                                file.uploader
                            )
                                .toLowerCase()
                                .includes(search)
                        );

                    }
                );

        }


        if (uploader) {

            files =
                files.filter(
                    file =>
                        file.uploader ===
                        uploader
                );

        }


        if (
            sort ===
            "oldest"
        ) {

            files.sort(
                (a, b) =>
                    a.date -
                    b.date
            );

        }
        else if (
            sort ===
            "name"
        ) {

            files.sort(
                (a, b) =>
                    a.displayName
                        .localeCompare(
                            b.displayName
                        )
            );

        }
        else if (
            sort ===
            "largest"
        ) {

            files.sort(
                (a, b) =>
                    b.size -
                    a.size
            );

        }
        else if (
            sort ===
            "downloads"
        ) {

            files.sort(
                (a, b) =>
                    b.downloads -
                    a.downloads
            );

        }
        else {

            files.sort(
                (a, b) =>
                    b.date -
                    a.date
            );

        }


        /*
        Never expose the delete-key hash.
        */

        const publicFiles =
            files.map(
                file => ({

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

                })
            );


        response.json({

            success:
                true,

            files:
                publicFiles

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
    (
        request,
        response
    ) => {

        try {

            const username =
                normalizeUsername(
                    request.body.uploader
                );

            const displayName =
                String(
                    request.body.displayName ||
                    ""
                )
                    .trim()
                    .slice(
                        0,
                        100
                    );


            /*
            USERNAME REQUIRED
            */

            if (!username) {

                if (
                    request.file
                ) {

                    fs.unlinkSync(
                        request.file.path
                    );

                }

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Username is required."

                    });

            }


            /*
            FILE REQUIRED
            */

            if (
                !request.file
            ) {

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "A file is required."

                    });

            }


            const originalName =
                request.file.originalname;

            const extension =
                path.extname(
                    originalName
                )
                    .replace(
                        ".",
                        ""
                    )
                    .toLowerCase();


            const scriptExtensions =
                new Set([

                    "js",
                    "ts",
                    "jsx",
                    "tsx",
                    "lua",
                    "py",
                    "json",
                    "css",
                    "html",
                    "htm",
                    "cs",
                    "cpp",
                    "c",
                    "java",
                    "gd",
                    "shader",
                    "txt"

                ]);


            const isScript =
                scriptExtensions.has(
                    extension
                );


            /*
            SERVER-GENERATED DELETE KEY
            */

            const deleteKey =
                generateDeleteKey(
                    username
                );

            const deleteKeyHash =
                hashDeleteKey(
                    deleteKey
                );


            const id =
                crypto
                    .randomBytes(12)
                    .toString("hex");


            const fileRecord = {

                id,

                name:
                    originalName,

                displayName:
                    displayName ||
                    originalName,

                uploader:
                    username,

                extension,

                size:
                    request.file.size,

                date:
                    Date.now(),

                downloads:
                    0,

                script:
                    isScript,

                storedName:
                    path.basename(
                        request.file.path
                    ),

                deleteKeyHash

            };


            const files =
                readFiles();

            files.push(
                fileRecord
            );

            writeFiles(
                files
            );


            broadcastUpdate();


            /*
            IMPORTANT:
            The delete key is returned exactly once
            to the publisher.
            */

            return response.json({

                success:
                    true,

                file: {

                    id,

                    name:
                        fileRecord.name,

                    displayName:
                        fileRecord.displayName,

                    uploader:
                        fileRecord.uploader

                },

                deleteToken:
                    deleteKey

            });

        }
        catch (error) {

            console.error(
                error
            );

            if (
                request.file &&
                fs.existsSync(
                    request.file.path
                )
            ) {

                fs.unlinkSync(
                    request.file.path
                );

            }

            response
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Unable to publish file."

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
    (
        request,
        response
    ) => {

        const files =
            readFiles();

        const file =
            files.find(
                item =>
                    item.id ===
                    request.params.id
            );


        if (!file) {

            return response
                .status(404)
                .send(
                    "File not found."
                );

        }


        const storedPath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        if (
            !fs.existsSync(
                storedPath
            )
        ) {

            return response
                .status(404)
                .send(
                    "Stored file not found."
                );

        }


        file.downloads =
            Number(
                file.downloads || 0
            ) + 1;

        writeFiles(
            files
        );


        response.download(
            storedPath,
            file.name
        );

    }
);


/*
========================================================
SCRIPT PREVIEW
========================================================
*/

app.get(
    "/api/files/:id/preview",
    (
        request,
        response
    ) => {

        const files =
            readFiles();

        const file =
            files.find(
                item =>
                    item.id ===
                    request.params.id
            );


        if (!file) {

            return response
                .status(404)
                .json({

                    success:
                        false,

                    error:
                        "File not found."

                });

        }


        if (!file.script) {

            return response
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "This file cannot be previewed."

                });

        }


        const storedPath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        if (
            !fs.existsSync(
                storedPath
            )
        ) {

            return response
                .status(404)
                .json({

                    success:
                        false,

                    error:
                        "Stored file not found."

                });

        }


        try {

            const stats =
                fs.statSync(
                    storedPath
                );


            /*
            Prevent enormous previews.
            */

            if (
                stats.size >
                2 * 1024 * 1024
            ) {

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "This script is too large to preview."

                    });

            }


            const content =
                fs.readFileSync(
                    storedPath,
                    "utf8"
                );


            response.json({

                success:
                    true,

                file: {

                    name:
                        file.name,

                    content

                }

            });

        }
        catch {

            response
                .status(500)
                .json({

                    success:
                        false,

                    error:
                        "Unable to preview file."

                });

        }

    }
);


/*
========================================================
DELETE FILE
========================================================
*/

app.delete(
    "/api/files/:id",
    (
        request,
        response
    ) => {

        const deleteToken =
            String(
                request.body.deleteToken ||
                ""
            )
                .trim();


        if (!deleteToken) {

            return response
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        "Delete key is required."

                });

        }


        const files =
            readFiles();

        const index =
            files.findIndex(
                file =>
                    file.id ===
                    request.params.id
            );


        if (
            index === -1
        ) {

            return response
                .status(404)
                .json({

                    success:
                        false,

                    error:
                        "File not found."

                });

        }


        const file =
            files[index];


        const suppliedHash =
            hashDeleteKey(
                deleteToken
            );


        /*
        Timing-safe comparison.
        */

        const expected =
            Buffer.from(
                file.deleteKeyHash,
                "hex"
            );

        const supplied =
            Buffer.from(
                suppliedHash,
                "hex"
            );


        const valid =
            expected.length ===
            supplied.length &&
            crypto.timingSafeEqual(
                expected,
                supplied
            );


        if (!valid) {

            return response
                .status(403)
                .json({

                    success:
                        false,

                    error:
                        "Invalid delete key."

                });

        }


        const storedPath =
            path.join(
                UPLOAD_DIR,
                file.storedName
            );


        if (
            fs.existsSync(
                storedPath
            )
        ) {

            fs.unlinkSync(
                storedPath
            );

        }


        files.splice(
            index,
            1
        );

        writeFiles(
            files
        );


        broadcastUpdate();


        response.json({

            success:
                true,

            message:
                "File deleted successfully."

        });

    }
);


/*
========================================================
SERVER EVENTS
========================================================
*/

app.get(
    "/api/events",
    (
        request,
        response
    ) => {

        response.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        response.setHeader(
            "Cache-Control",
            "no-cache"
        );

        response.setHeader(
            "Connection",
            "keep-alive"
        );


        response.write(
            "retry: 5000\n\n"
        );


        eventClients.add(
            response
        );


        request.on(
            "close",
            () => {

                eventClients.delete(
                    response
                );

            }
        );

    }
);


/*
========================================================
MULTER ERRORS
========================================================
*/

app.use(
    (
        error,
        request,
        response,
        next
    ) => {

        if (
            error instanceof
            multer.MulterError
        ) {

            if (
                error.code ===
                "LIMIT_FILE_SIZE"
            ) {

                return response
                    .status(400)
                    .json({

                        success:
                            false,

                        error:
                            "Maximum file size is 50 MB."

                    });

            }

        }


        console.error(
            error
        );


        response
            .status(500)
            .json({

                success:
                    false,

                error:
                    "Server error."

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
            `Project File Hub running on port ${PORT}`
        );

    }
);
