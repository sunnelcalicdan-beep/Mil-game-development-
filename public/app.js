"use strict";

/*
========================================================
PROJECT FILE HUB
UPGRADED FRONTEND
========================================================
*/


/* ======================================================
   HELPERS
====================================================== */

const $ = selector =>
    document.querySelector(selector);


function escapeHtml(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatBytes(bytes) {

    if (!Number.isFinite(bytes) || bytes <= 0) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index = Math.min(
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        ),
        units.length - 1
    );

    const value =
        bytes /
        Math.pow(1024, index);

    return (
        value.toFixed(index === 0 ? 0 : 1) +
        " " +
        units[index]
    );
}


function formatDate(timestamp) {

    const date =
        new Date(timestamp);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Unknown";
    }

    return date.toLocaleString();
}


/* ======================================================
   ELEMENTS
====================================================== */

const projectApp =
    $("#projectApp");

const enterProjectButton =
    $("#enterProjectButton");

const publishForm =
    $("#publishForm");

const usernameInput =
    $("#username");

const displayNameInput =
    $("#displayName");

const fileInput =
    $("#fileInput");

const dropZone =
    $("#dropZone");

const publishButton =
    $("#publishButton");

const selectedFile =
    $("#selectedFile");

const publishMessage =
    $("#publishMessage");

const uploadProgress =
    $("#uploadProgress");

const progressFill =
    $("#progressFill");

const progressText =
    $("#progressText");

const deleteKeyModal =
    $("#deleteKeyModal");

const generatedDeleteKey =
    $("#generatedDeleteKey");

const copyKeyButton =
    $("#copyKeyButton");

const copyMessage =
    $("#copyMessage");

const savedKeyButton =
    $("#savedKeyButton");

const deleteModal =
    $("#deleteModal");

const deleteTokenInput =
    $("#deleteTokenInput");

const confirmDeleteButton =
    $("#confirmDeleteButton");

const cancelDeleteButton =
    $("#cancelDeleteButton");

const deleteMessage =
    $("#deleteMessage");

const previewModal =
    $("#previewModal");

const previewTitle =
    $("#previewTitle");

const previewContent =
    $("#previewContent");

const library =
    $("#library");

const searchInput =
    $("#searchInput");

const uploaderFilter =
    $("#uploaderFilter");

const sortSelect =
    $("#sortSelect");

const refreshButton =
    $("#refreshButton");

const serverStatus =
    $("#serverStatus");

const statFiles =
    $("#statFiles");

const statScripts =
    $("#statScripts");

const statDownloads =
    $("#statDownloads");

const statStorage =
    $("#statStorage");


/* ======================================================
   STATE
====================================================== */

let selectedDeleteFileId =
    null;

let currentDeleteKey =
    null;

let searchTimer =
    null;


/* ======================================================
   PARTICLES
====================================================== */

function createParticles() {

    const container =
        document.querySelector(
            "#particles"
        );

    if (!container) {
        return;
    }

    const count =
        window.innerWidth < 600
            ? 35
            : 75;

    container.innerHTML = "";

    for (
        let i = 0;
        i < count;
        i++
    ) {

        const particle =
            document.createElement(
                "span"
            );

        particle.className =
            "particle";

        const size =
            Math.random() *
            2.5 +
            1;

        const x =
            Math.random() *
            100;

        const duration =
            Math.random() *
            18 +
            10;

        const delay =
            Math.random() *
            -25;

        const horizontal =
            Math.random() *
            180 -
            90;

        const opacity =
            Math.random() *
            .7 +
            .15;

        const colors = [
            "#00eaff",
            "#ffffff",
            "#8f5cff",
            "#ff3ddd"
        ];

        const glow =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];

        particle.style.left =
            x + "%";

        particle.style.setProperty(
            "--size",
            size + "px"
        );

        particle.style.setProperty(
            "--duration",
            duration + "s"
        );

        particle.style.setProperty(
            "--delay",
            delay + "s"
        );

        particle.style.setProperty(
            "--x",
            horizontal + "px"
        );

        particle.style.setProperty(
            "--opacity",
            opacity
        );

        particle.style.setProperty(
            "--glow",
            glow
        );

        container.appendChild(
            particle
        );
    }
}


/* ======================================================
   ENTER PROJECT
====================================================== */

enterProjectButton.addEventListener(
    "click",
    () => {

        projectApp.classList.remove(
            "hidden"
        );

        projectApp.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }
);


/* ======================================================
   FILE INPUT
====================================================== */

fileInput.addEventListener(
    "change",
    updateSelectedFile
);


function updateSelectedFile() {

    const file =
        fileInput.files[0];

    if (!file) {

        selectedFile.textContent =
            "No file selected.";

        return;
    }

    selectedFile.textContent =
        `${file.name} • ${formatBytes(file.size)}`;
}


/* ======================================================
   DRAG & DROP
====================================================== */

[
    "dragenter",
    "dragover"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.add(
                    "dragging"
                );

            }
        );

    }
);


[
    "dragleave",
    "drop"
].forEach(
    eventName => {

        dropZone.addEventListener(
            eventName,
            event => {

                event.preventDefault();

                dropZone.classList.remove(
                    "dragging"
                );

            }
        );

    }
);


dropZone.addEventListener(
    "drop",
    event => {

        const files =
            event.dataTransfer.files;

        if (!files.length) {
            return;
        }

        fileInput.files =
            files;

        updateSelectedFile();

    }
);


/* ======================================================
   PUBLISH
====================================================== */

publishForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        publishFile();

    }
);


function showPublishMessage(
    message,
    type = ""
) {

    publishMessage.textContent =
        message;

    publishMessage.className =
        "message " +
        type;
}


function publishFile() {

    const username =
        usernameInput.value.trim();

    const displayName =
        displayNameInput.value.trim();

    const file =
        fileInput.files[0];


    /*
    USERNAME IS REQUIRED
    */

    if (!username) {

        showPublishMessage(
            "Enter your username before publishing.",
            "error"
        );

        usernameInput.focus();

        return;
    }


    /*
    FILE IS REQUIRED
    */

    if (!file) {

        showPublishMessage(
            "Select a file before publishing.",
            "error"
        );

        return;
    }


    /*
    MAXIMUM FILE SIZE
    */

    if (
        file.size >
        50 * 1024 * 1024
    ) {

        showPublishMessage(
            "The maximum file size is 50 MB.",
            "error"
        );

        return;
    }


    const formData =
        new FormData();

    formData.append(
        "file",
        file
    );

    formData.append(
        "uploader",
        username
    );

    formData.append(
        "displayName",
        displayName
    );


    publishButton.disabled =
        true;

    publishButton.querySelector(
        "span"
    ).textContent =
        "UPLOADING...";


    uploadProgress.classList.remove(
        "hidden"
    );

    progressFill.style.width =
        "0%";

    progressText.textContent =
        "Preparing upload...";

    showPublishMessage(
        ""
    );


    const xhr =
        new XMLHttpRequest();


    xhr.open(
        "POST",
        "/api/files"
    );


    xhr.upload.addEventListener(
        "progress",
        event => {

            if (!event.lengthComputable) {
                return;
            }

            const percent =
                Math.round(
                    event.loaded /
                    event.total *
                    100
                );

            progressFill.style.width =
                percent + "%";

            progressText.textContent =
                `Uploading ${percent}%`;

        }
    );


    xhr.onload =
        () => {

            publishButton.disabled =
                false;

            publishButton.querySelector(
                "span"
            ).textContent =
                "✦ PUBLISH FILE";


            let result;

            try {

                result =
                    JSON.parse(
                        xhr.responseText
                    );

            }
            catch {

                result = {
                    success: false,
                    error:
                        "Invalid server response."
                };

            }


            if (
                xhr.status < 200 ||
                xhr.status >= 300 ||
                !result.success
            ) {

                uploadProgress.classList.add(
                    "hidden"
                );

                showPublishMessage(
                    result.error ||
                    "Publishing failed.",
                    "error"
                );

                return;
            }


            /*
            IMPORTANT:
            THE BACKEND GENERATES THIS KEY.
            THE FRONTEND DOES NOT GENERATE IT.
            */

            const deleteToken =
                result.deleteToken;


            if (!deleteToken) {

                uploadProgress.classList.add(
                    "hidden"
                );

                showPublishMessage(
                    "File uploaded, but the server did not return a delete key.",
                    "error"
                );

                return;
            }


            progressFill.style.width =
                "100%";

            progressText.textContent =
                "Publication complete ✦";


            /*
            SHOW KEY POPUP
            */

            showDeleteKeyModal(
                deleteToken
            );


            /*
            RESET FORM
            */

            publishForm.reset();

            selectedFile.textContent =
                "No file selected.";


            /*
            REFRESH
            */

            loadEverything();


            setTimeout(
                () => {

                    uploadProgress.classList.add(
                        "hidden"
                    );

                },
                1200
            );

        };


    xhr.onerror =
        () => {

            publishButton.disabled =
                false;

            publishButton.querySelector(
                "span"
            ).textContent =
                "✦ PUBLISH FILE";

            uploadProgress.classList.add(
                "hidden"
            );

            showPublishMessage(
                "Unable to connect to the server.",
                "error"
            );

        };


    xhr.send(
        formData
    );
}


/* ======================================================
   DELETE KEY MODAL
====================================================== */

function showDeleteKeyModal(
    deleteToken
) {

    currentDeleteKey =
        deleteToken;

    generatedDeleteKey.value =
        deleteToken;

    copyMessage.textContent =
        "";

    deleteKeyModal.classList.remove(
        "hidden"
    );
}


function closeDeleteKeyModal() {

    deleteKeyModal.classList.add(
        "hidden"
    );

    currentDeleteKey =
        null;
}


savedKeyButton.addEventListener(
    "click",
    () => {

        closeDeleteKeyModal();

        showPublishMessage(
            "File published successfully. Make sure you saved your delete key.",
            "success"
        );

    }
);


/* ======================================================
   COPY KEY
====================================================== */

copyKeyButton.addEventListener(
    "click",
    async () => {

        const key =
            generatedDeleteKey.value;

        if (!key) {
            return;
        }

        try {

            await navigator.clipboard.writeText(
                key
            );

            copyMessage.textContent =
                "✓ Delete key copied.";

        }
        catch {

            generatedDeleteKey.select();

            document.execCommand(
                "copy"
            );

            copyMessage.textContent =
                "✓ Delete key copied.";

        }

    }
);


document.querySelectorAll(
    "[data-close-delete-key]"
).forEach(
    element => {

        element.addEventListener(
            "click",
            closeDeleteKeyModal
        );

    }
);


/* ======================================================
   LOAD FILES
====================================================== */

async function loadFiles() {

    const params =
        new URLSearchParams();


    const search =
        searchInput.value.trim();

    const uploader =
        uploaderFilter.value;

    const sort =
        sortSelect.value;


    if (search) {
        params.set(
            "search",
            search
        );
    }


    if (uploader) {
        params.set(
            "uploader",
            uploader
        );
    }


    params.set(
        "sort",
        sort
    );


    library.innerHTML =
        `
        <div class="empty">
            Loading library...
        </div>
        `;


    try {

        const response =
            await fetch(
                "/api/files?" +
                params.toString()
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Unable to load files."
            );

        }


        renderFiles(
            result.files || []
        );

    }
    catch (error) {

        console.error(
            error
        );

        library.innerHTML =
            `
            <div class="empty">
                Unable to load library.
            </div>
            `;

    }

}


/* ======================================================
   RENDER FILES
====================================================== */

function renderFiles(
    files
) {

    if (!files.length) {

        library.innerHTML =
            `
            <div class="empty">
                ✦ No files found.
            </div>
            `;

        return;
    }


    library.innerHTML =
        files.map(
            createFileCard
        ).join("");


    library
        .querySelectorAll(
            "[data-download]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        const id =
                            button.dataset.download;

                        window.location.href =
                            `/api/files/${encodeURIComponent(id)}/download`;

                    }
                );

            }
        );


    library
        .querySelectorAll(
            "[data-delete]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        openDeleteModal(
                            button.dataset.delete
                        );

                    }
                );

            }
        );


    library
        .querySelectorAll(
            "[data-preview]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        previewScript(
                            button.dataset.preview,
                            button.dataset.name
                        );

                    }
                );

            }
        );

}


/* ======================================================
   FILE CARD
====================================================== */

function createFileCard(
    file
) {

    const preview =
        file.script
            ? `
                <button
                    data-preview="${escapeHtml(file.id)}"
                    data-name="${escapeHtml(file.displayName || file.name)}"
                >
                    &lt;/&gt; Preview
                </button>
            `
            : "";


    return `
        <article class="file-card">

            <div class="file-top">

                <div>

                    <div class="file-name">
                        ${escapeHtml(
                            file.displayName ||
                            file.name
                        )}
                    </div>

                    <div class="file-meta">

                        ${escapeHtml(file.name)}

                        •

                        ${escapeHtml(
                            file.extension || ""
                        ).toUpperCase()}

                        •

                        ${formatBytes(file.size)}

                        <br>

                        Published by

                        <strong>
                            ${escapeHtml(
                                file.uploader
                            )}
                        </strong>

                        •

                        ${formatDate(file.date)}

                        <br>

                        Downloads:
                        ${Number(file.downloads || 0)}

                    </div>

                </div>


                <span class="badge">

                    ${
                        file.script
                            ? "SCRIPT"
                            : "FILE"
                    }

                </span>

            </div>


            <div class="file-actions">

                ${preview}

                <button
                    data-download="${escapeHtml(file.id)}"
                >
                    ↓ Download
                </button>

                <button
                    class="delete-file"
                    data-delete="${escapeHtml(file.id)}"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


/* ======================================================
   DELETE MODAL
====================================================== */

function openDeleteModal(
    fileId
) {

    selectedDeleteFileId =
        fileId;

    deleteTokenInput.value =
        "";

    deleteMessage.textContent =
        "";

    deleteMessage.className =
        "message";

    deleteModal.classList.remove(
        "hidden"
    );

    setTimeout(
        () => {
            deleteTokenInput.focus();
        },
        50
    );
}


function closeDeleteModal() {

    deleteModal.classList.add(
        "hidden"
    );

    selectedDeleteFileId =
        null;
}


cancelDeleteButton.addEventListener(
    "click",
    closeDeleteModal
);


document.querySelectorAll(
    "[data-close-delete]"
).forEach(
    element => {

        element.addEventListener(
            "click",
            closeDeleteModal
        );

    }
);


/* ======================================================
   CONFIRM DELETE
====================================================== */

confirmDeleteButton.addEventListener(
    "click",
    deleteFile
);


deleteTokenInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            deleteFile();

        }

    }
);


async function deleteFile() {

    const token =
        deleteTokenInput.value.trim();


    if (!selectedDeleteFileId) {
        return;
    }


    if (!token) {

        deleteMessage.textContent =
            "Enter your delete key.";

        deleteMessage.className =
            "message error";

        return;
    }


    confirmDeleteButton.disabled =
        true;

    confirmDeleteButton.textContent =
        "Deleting...";


    try {

        const response =
            await fetch(
                `/api/files/${encodeURIComponent(
                    selectedDeleteFileId
                )}`,
                {
                    method:
                        "DELETE",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            deleteToken:
                                token
                        })
                }
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            deleteMessage.textContent =
                result.error ||
                "Delete failed.";

            deleteMessage.className =
                "message error";

            return;
        }


        closeDeleteModal();


        showPublishMessage(
            "File deleted successfully.",
            "success"
        );


        await loadEverything();

    }
    catch (error) {

        console.error(
            error
        );

        deleteMessage.textContent =
            "Unable to connect to the server.";

        deleteMessage.className =
            "message error";

    }
    finally {

        confirmDeleteButton.disabled =
            false;

        confirmDeleteButton.textContent =
            "Delete File";

    }

}


/* ======================================================
   SCRIPT PREVIEW
====================================================== */

async function previewScript(
    id,
    name
) {

    previewTitle.textContent =
        name ||
        "Script Preview";

    previewContent.textContent =
        "Loading...";

    previewModal.classList.remove(
        "hidden"
    );


    try {

        const response =
            await fetch(
                `/api/files/${encodeURIComponent(
                    id
                )}/preview`
            );


        const result =
            await response.json();


        if (
            !response.ok ||
            !result.success
        ) {

            throw new Error(
                result.error ||
                "Preview failed."
            );

        }


        previewContent.textContent =
            result.file.content;

    }
    catch (error) {

        previewContent.textContent =
            error.message;

    }

}


/* ======================================================
   CLOSE PREVIEW
====================================================== */

document.querySelectorAll(
    "[data-close-preview]"
).forEach(
    element => {

        element.addEventListener(
            "click",
            () => {

                previewModal.classList.add(
                    "hidden"
                );

            }
        );

    }
);


/* ======================================================
   ESCAPE MODALS
====================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {
            return;
        }

        deleteKeyModal.classList.add(
            "hidden"
        );

        deleteModal.classList.add(
            "hidden"
        );

        previewModal.classList.add(
            "hidden"
        );

    }
);


/* ======================================================
   STATS
====================================================== */

async function loadStats() {

    try {

        const response =
            await fetch(
                "/api/stats"
            );

        const result =
            await response.json();


        if (!result.success) {
            return;
        }


        statFiles.textContent =
            result.stats.files;

        statScripts.textContent =
            result.stats.scripts;

        statDownloads.textContent =
            result.stats.downloads;

        statStorage.textContent =
            formatBytes(
                result.stats.totalSize
            );

    }
    catch (error) {

        console.error(
            "Stats:",
            error
        );

    }

}


/* ======================================================
   UPLOADERS
====================================================== */

async function loadUploaders() {

    try {

        const response =
            await fetch(
                "/api/uploaders"
            );

        const result =
            await response.json();


        if (!result.success) {
            return;
        }


        const current =
            uploaderFilter.value;


        uploaderFilter.innerHTML =
            `
            <option value="">
                All uploaders
            </option>
            `;


        (
            result.uploaders ||
            []
        ).forEach(
            uploader => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    uploader;

                option.textContent =
                    uploader;

                uploaderFilter.appendChild(
                    option
                );

            }
        );


        if (
            result.uploaders.includes(
                current
            )
        ) {

            uploaderFilter.value =
                current;

        }

    }
    catch (error) {

        console.error(
            "Uploaders:",
            error
        );

    }

}


/* ======================================================
   HEALTH
====================================================== */

async function checkHealth() {

    try {

        const response =
            await fetch(
                "/api/health"
            );


        const result =
            await response.json();


        if (
            response.ok &&
            result.success
        ) {

            serverStatus.innerHTML =
                `
                <span class="status-dot"></span>
                Server Online
                `;

            serverStatus.className =
                "status online";

        }
        else {

            throw new Error();

        }

    }
    catch {

        serverStatus.innerHTML =
            `
            <span class="status-dot"></span>
            Server Offline
            `;

        serverStatus.className =
            "status offline";

    }

}


/* ======================================================
   EVERYTHING
====================================================== */

async function loadEverything() {

    await Promise.all([
        loadFiles(),
        loadStats(),
        loadUploaders(),
        checkHealth()
    ]);

}


/* ======================================================
   FILTERS
====================================================== */

searchInput.addEventListener(
    "input",
    () => {

        clearTimeout(
            searchTimer
        );

        searchTimer =
            setTimeout(
                loadFiles,
                250
            );

    }
);


uploaderFilter.addEventListener(
    "change",
    loadFiles
);


sortSelect.addEventListener(
    "change",
    loadFiles
);


refreshButton.addEventListener(
    "click",
    loadEverything
);


/* ======================================================
   REAL TIME EVENTS
====================================================== */

function connectEvents() {

    if (!window.EventSource) {
        return;
    }


    const events =
        new EventSource(
            "/api/events"
        );


    events.addEventListener(
        "library-update",
        () => {

            loadEverything();

        }
    );


    events.onerror =
        () => {

            /*
             EventSource automatically
             reconnects.
            */

        };

}


/* ======================================================
   INITIALIZE
====================================================== */

createParticles();

loadEverything();

connectEvents();
