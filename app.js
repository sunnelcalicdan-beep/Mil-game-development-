"use strict";

/*
========================================================
MIL PROJECT • GAME DEVELOPMENT
PROJECT FILE HUB
EXPRESS SERVER
========================================================

Structure:

project/
│
├── app.js
├── package.json
│
└── public/
    ├── index.html
    ├── hub.html
    ├── style.css
    ├── script.js
    └── particle.js

Routes:

/       → Original landing page
/hub    → Project File Hub
========================================================
*/

const express = require("express");
const path = require("path");

const app = express();

/*
========================================================
PORT
========================================================
*/

const PORT = process.env.PORT || 3000;


/*
========================================================
MIDDLEWARE
========================================================
*/

// Parse JSON requests
app.use(express.json());

// Parse form requests
app.use(express.urlencoded({
    extended: true
}));


// Serve the entire public folder
app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/*
========================================================
HOME PAGE
========================================================

This keeps your ORIGINAL landing page.

URL:

https://your-site.onrender.com/
========================================================
*/

app.get("/", (req, res) => {

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
PROJECT HUB
========================================================

This fixes:

Cannot GET /hub

The browser will load:

public/hub.html

when visiting:

/hub
========================================================
*/

app.get("/hub", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "hub.html"
        )
    );

});


/*
========================================================
OPTIONAL API STATUS
========================================================

Useful for checking whether the server
is running correctly.

Visit:

/api/status
========================================================
*/

app.get("/api/status", (req, res) => {

    res.json({

        success: true,

        project:
            "MIL Project • Game Development",

        hub:
            "Project File Hub",

        status:
            "online",

        time:
            new Date().toISOString()

    });

});


/*
========================================================
HEALTH CHECK
========================================================

Useful for Render and monitoring.
========================================================
*/

app.get("/health", (req, res) => {

    res.status(200).json({

        status: "ok"

    });

});


/*
========================================================
404 HANDLER
========================================================

Anything that doesn't exist reaches here.
========================================================
*/

app.use((req, res) => {

    res.status(404).send(`

        <!DOCTYPE html>

        <html lang="en">

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width,
                initial-scale=1.0"
            >

            <title>404 • Project File Hub</title>

            <style>

                * {
                    box-sizing: border-box;
                }

                body {

                    margin: 0;

                    min-height: 100vh;

                    display: flex;

                    align-items: center;

                    justify-content: center;

                    padding: 24px;

                    background:
                        radial-gradient(
                            circle at 20% 20%,
                            rgba(0, 180, 255, 0.12),
                            transparent 35%
                        ),
                        radial-gradient(
                            circle at 80% 80%,
                            rgba(150, 0, 255, 0.14),
                            transparent 35%
                        ),
                        #030512;

                    color: #eef5ff;

                    font-family:
                        Arial,
                        Helvetica,
                        sans-serif;

                    text-align: center;

                }

                .error {

                    width: min(
                        520px,
                        100%
                    );

                    padding: 45px 28px;

                    border: 1px solid
                        rgba(100, 190, 255, 0.35);

                    border-radius: 24px;

                    background:
                        rgba(
                            12,
                            22,
                            52,
                            0.72
                        );

                    box-shadow:
                        0 0 40px
                        rgba(
                            70,
                            80,
                            255,
                            0.12
                        );

                }

                h1 {

                    margin:
                        0 0 12px;

                    font-size: 64px;

                    letter-spacing:
                        -3px;

                }

                h2 {

                    margin:
                        0 0 16px;

                    font-size: 24px;

                }

                p {

                    color:
                        rgba(
                            230,
                            240,
                            255,
                            0.72
                        );

                    line-height: 1.6;

                }

                a {

                    display: inline-block;

                    margin-top: 18px;

                    padding:
                        13px 24px;

                    border-radius: 12px;

                    background:
                        linear-gradient(
                            135deg,
                            #7b2cff,
                            #246bff
                        );

                    color: white;

                    text-decoration: none;

                    font-weight: 700;

                }

            </style>

        </head>

        <body>

            <div class="error">

                <h1>404</h1>

                <h2>Page Not Found</h2>

                <p>
                    The requested Project File Hub
                    page does not exist.
                </p>

                <a href="/">
                    ← BACK TO PROJECT HUB
                </a>

            </div>

        </body>

        </html>

    `);

});


/*
========================================================
ERROR HANDLER
========================================================
*/

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "SERVER ERROR:",
            err
        );

        res.status(500).json({

            success: false,

            error:
                "Internal server error."

        });

    }
);


/*
========================================================
START SERVER
========================================================
*/

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "========================================"
        );

        console.log(
            " MIL PROJECT • GAME DEVELOPMENT"
        );

        console.log(
            " PROJECT FILE HUB"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server running on port ${PORT}`
        );

        console.log(
            `Home: http://localhost:${PORT}/`
        );

        console.log(
            `Hub:  http://localhost:${PORT}/hub`
        );

        console.log(
            `API:  http://localhost:${PORT}/api/status`
        );

        console.log(
            "========================================"
        );

    }
);
