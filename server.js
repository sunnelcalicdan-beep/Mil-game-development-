"use strict";

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT =
    process.env.PORT || 10000;


const DATA =
    path.join(
        __dirname,
        "data"
    );


const UPLOADS =
    path.join(
        DATA,
        "uploads"
    );


const DATABASE =
    path.join(
        DATA,
        "files.json"
    );


/* =========================================
   DIRECTORIES
========================================= */

fs.mkdirSync(
    UPLOADS,
    {
        recursive: true
    }
);


if (
    !fs.existsSync(DATABASE)
) {

    fs.writeFileSync(
        DATABASE,
        "[]"
    );

}


/* =========================================
   MIDDLEWARE
========================================= */

app.use(
    express.json({
        limit: "1mb"
    })
);


app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =========================================
   UPLOAD STORAGE
========================================= */

const storage =
    multer.diskStorage({

        destination:
            (
                request,
                file,
                callback
            ) => {

                callback(
                    null,
                    UPLOADS
                );

            },


        filename:
            (
                request,
                file,
                callback
            ) => {

                const extension =
                    path.extname(
                        file.originalname
                    ).slice(
                        0,
                        20
                    );


                callback(
                    null,

                    crypto.randomUUID() +
                    extension
                );

            }

    });


const upload =
    multer({

        storage,

        limits: {

            fileSize:
                100 *
                1024 *
                1024

        }

    });


/* =========================================
   DATABASE HELPERS
========================================= */

function readDatabase() {

    try {

        return JSON.parse(
            fs.readFileSync(
                DATABASE,
                "utf8"
            )
        );

    }

    catch {

        return [];

    }

}


function writeDatabase(
    data
) {

    fs.writeFileSync(
        DATABASE,
        JSON.stringify(
            data,
            null,
            2
        )
    );

}


function clean(
    value,
    maxLength
) {

    return String(
        value || ""
    )
        .trim()
        .slice(
            0,
            maxLength
        );

}


/* =========================================
   HOME
========================================= */

app.get(
    "/",
    (
        request,
        response
    ) => {

        response.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


/* =========================================
   GET PROJECTS
========================================= */

app.get(
    "/api/files",
    (
        request,
        response
    ) => {

        const projects =
            readDatabase();


        /*
         * Delete credentials are never
         * exposed to the browser.
         */

        const safeProjects =
            projects.map(
                ({
                    deleteKey,
                    ...project
                }) =>
                    project
            );


        response.json({
            files:
                safeProjects
        });

    }
);


/* =========================================
   UPLOAD PROJECT
========================================= */

app.post(
    "/api/files",

    upload.single("file"),

    (
        request,
        response
    ) => {

        if (
            !request.file
        ) {

            return response
                .status(400)
                .json({
                    error:
                        "A file is required."
                });

        }


        const project = {

            id:
                crypto.randomUUID(),

            title:
                clean(
                    request.body.title,
                    120
                ) ||
                request.file.originalname,

            description:
                clean(
                    request.body.description,
                    500
                ),

            uploader:
                clean(
                    request.body.uploader,
                    80
                ) ||
                "Anonymous",

            originalName:
                clean(
                    request.file.originalname,
                    180
                ),

            storedName:
                request.file.filename,

            size:
                request.file.size,

            mime:
                request.file.mimetype ||
                "application/octet-stream",

            createdAt:
                new Date().toISOString()

        };


        const database =
            readDatabase();


        database.push(
            project
        );


        writeDatabase(
            database
        );


        response
            .status(201)
            .json({
                file:
                    project
            });

    }
);


/* =========================================
   DOWNLOAD
========================================= */

app.get(
    "/api/files/:id/download",

    (
        request,
        response
    ) => {

        const database =
            readDatabase();


        const project =
            database.find(
                item =>
                    item.id ===
                    request.params.id
            );


        if (!project) {

            return response
                .status(404)
                .send(
                    "File not found."
                );

        }


        const filePath =
            path.join(
                UPLOADS,
                project.storedName
            );


        if (
            !fs.existsSync(
                filePath
            )
        ) {

            return response
                .status(404)
                .send(
                    "Stored file not found."
                );

        }


        response.download(
            filePath,
            project.originalName
        );

    }
);


/* =========================================
   DELETE
========================================= */

app.delete(
    "/api/files/:id",

    (
        request,
        response
    ) => {

        /*
         * The old delete-key system is
         * intentionally removed.
         *
         * Deletion is now handled directly
         * from the project library.
         */

        const database =
            readDatabase();


        const index =
            database.findIndex(
                item =>
                    item.id ===
                    request.params.id
            );


        if (
            index < 0
        ) {

            return response
                .status(404)
                .json({
                    error:
                        "Project not found."
                });

        }


        const [
            project
        ] =
            database.splice(
                index,
                1
            );


        const filePath =
            path.join(
                UPLOADS,
                project.storedName
            );


        if (
            fs.existsSync(
                filePath
            )
        ) {

            fs.unlinkSync(
                filePath
            );

        }


        writeDatabase(
            database
        );


        response.json({
            ok: true
        });

    }
);


/* =========================================
   ERROR HANDLER
========================================= */

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
                    .status(413)
                    .json({
                        error:
                            "File exceeds 100 MB."
                    });

            }

        }


        console.error(
            error
        );


        response
            .status(500)
            .json({
                error:
                    "Server error."
            });

    }
);


/* =========================================
   START
========================================= */

app.listen(
    PORT,
    () => {

        console.log(
            "MIL Project File Hub running on port " +
            PORT
        );

    }
);
