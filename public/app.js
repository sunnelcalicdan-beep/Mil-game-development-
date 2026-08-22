"use strict";

/*
========================================================
PROJECT FILE HUB FRONTEND
========================================================
*/

const $ = selector =>
    document.querySelector(selector);


/*
========================================================
ELEMENTS
========================================================
*/

const publishForm =
    $("#publishForm");

const usernameInput =
    $("#username");

const displayNameInput =
    $("#displayName");

const fileInput =
    $("#fileInput");

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


/*
========================================================
STATE
========================================================
*/

let selectedDeleteFileId =
    null;


/*
========================================================
FORMAT BYTES
========================================================
*/

function formatBytes(
    bytes
) {

    if (
        !Number.isFinite(
            Number(bytes)
        ) ||
        Number(bytes) <= 0
    ) {

        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    const index =
        Math.min(
            Math.floor(
                Math.log(
                    Number(bytes)
                ) /
                Math.log(1024)
            ),
            units.length - 1
        );

    const value =
        Number(bytes) /
        Math.pow(
            1024,
            index
        );

    return (
        value.toFixed(
            index === 0
                ? 0
                : 1
        ) +
        " " +
        units[index]
    );
}


/*
========================================================
DATE
========================================================
*/

function formatDate(
    timestamp
) {

    const date =
        new Date(
            timestamp
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "Unknown date";
    }

    return date.toLocaleString();
}


/*
========================================================
ESCAPE HTML
========================================================
*/

function escapeHtml(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


/*
========================================================
MESSAGES
========================================================
*/

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


/*
========================================================
FILE INPUT
========================================================
*/

fileInput.addEventListener(
    "change",
    () => {

        const file =
            fileInput.files[0];

        if (!file) {

            selectedFile.textContent =
                "No file selected.";

            return;
        }

        selectedFile.textContent =
            `${file.name} • ${formatBytes(
                file.size
            )}`;
    }
);


/*
========================================================
PUBLISH FORM
========================================================
*/

publishForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();

        publishFile();
    }
);


/*
========================================================
PUBLISH FILE
========================================================
*/

function publishFile() {

    const username =
        usernameInput.value.trim();

    let displayName =
        displayNameInput.value.trim();

    const file =
        fileInput.files[0];

    /*
    USERNAME REQUIRED
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
    USERNAME LENGTH
    */

    if (
        username.length > 80
    ) {

        showPublishMessage(
            "Username must be 80 characters or less.",
            "error"
        );

        usernameInput.focus();

        return;
    }

    /*
    FILE REQUIRED
    */

    if (!file) {

        showPublishMessage(
            "Select a file before publishing.",
            "error"
        );

        fileInput.focus();

        return;
    }

    /*
    MAX SIZE
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

    /*
    If display name is empty,
    use filename automatically.
    */

    if (!displayName) {

        displayName =
            file.name
                .replace(
                    /\.[^/.]+$/,
                    ""
                )
                .slice(
                    0,
                    100
                );
    }

    /*
    FORM DATA
    */

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

    /*
    LOCK UI
    */

    publishButton.disabled =
        true;

    publishButton.textContent =
        "Publishing...";

    uploadProgress.classList.remove(
        "hidden"
    );

    progressFill.style.width =
        "0%";

    progressText.textContent =
        "Starting upload...";

    showPublishMessage(
        ""
    );

    /*
    XHR FOR REAL UPLOAD PROGRESS
    */

    const xhr =
        new XMLHttpRequest();

    xhr.open(
        "POST",
        "/api/files",
        true
    );

    /*
    PROGRESS
    */

    xhr.upload.addEventListener(
        "progress",
        event => {

            if (
                !event.lengthComputable
            ) {

                progressText.textContent =
                    "Uploading...";

                return;
            }

            const percent =
                Math.round(
                    (
                        event.loaded /
                        event.total
                    ) *
                    100
                );

            progressFill.style.width =
                `${percent}%`;

            progressText.textContent =
                `Uploading ${percent}%`;
        }
    );

    /*
    SUCCESS / ERROR RESPONSE
    */

    xhr.onload =
        () => {

            publishButton.disabled =
                false;

            publishButton.textContent =
                "Publish";

            let result;

            try {

                result =
                    JSON.parse(
                        xhr.responseText ||
                        "{}"
                    );

            }
            catch {

                result = {

                    success:
                        false,

                    error:
                        "Invalid server response."
                };
            }

            /*
            SERVER ERROR
            */

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
            ====================================================
            THE SERVER GENERATED THE DELETE KEY
            ====================================================
            */

            const deleteToken =
                result.deleteToken;

            /*
            This should NEVER be empty if the backend
            is configured correctly.
            */

            if (!deleteToken) {

                uploadProgress.classList.add(
                    "hidden"
                );

                showPublishMessage(
                    "The file was uploaded, but no delete key was returned. Contact the administrator.",
                    "error"
                );

                return;
            }

            /*
            COMPLETE PROGRESS
            */

            progressFill.style.width =
                "100%";

            progressText.textContent =
                "Published successfully.";

            /*
            ====================================================
            SHOW DELETE KEY POPUP
            ====================================================
            */

            showDeleteKeyModal(
                deleteToken
            );

            /*
            RESET PUBLISH FORM
            */

            publishForm.reset();

            selectedFile.textContent =
                "No file selected.";

            /*
            REFRESH LIBRARY
            */

            loadEverything();

            /*
            Hide progress later.
            */

            setTimeout(
                () => {

                    uploadProgress.classList.add(
                        "hidden"
                    );

                },
                1200
            );
        };

    /*
    NETWORK ERROR
    */

    xhr.onerror =
        () => {

            publishButton.disabled =
                false;

            publishButton.textContent =
                "Publish";

            uploadProgress.classList.add(
                "hidden"
            );

            showPublishMessage(
                "Unable to connect to the server.",
                "error"
            );
        };

    /*
    TIMEOUT
    */

    xhr.ontimeout =
        () => {

            publishButton.disabled =
                false;

            publishButton.textContent =
                "Publish";

            uploadProgress.classList.add(
                "hidden"
            );

            showPublishMessage(
                "The upload timed out.",
                "error"
            );
        };

    xhr.timeout =
        5 * 60 * 1000;

    /*
    SEND
    */

    xhr.send(
        formData
    );
}


/*
========================================================
DELETE KEY POPUP
========================================================
*/

function showDeleteKeyModal(
    deleteToken
) {

    generatedDeleteKey.value =
        deleteToken;

    copyMessage.textContent =
        "";

    deleteKeyModal.classList.remove(
        "hidden"
    );

    /*
    Automatically select the key
    so it is easy to copy manually.
    */

    setTimeout(
        () => {

            generatedDeleteKey.focus();

            generatedDeleteKey.select();

        },
        50
    );
}


/*
========================================================
CLOSE DELETE KEY MODAL
========================================================
*/

function closeDeleteKeyModal() {

    deleteKeyModal.classList.add(
        "hidden"
    );

    /*
    Clear the key from the DOM after closing.
    */

    generatedDeleteKey.value =
        "";

    copyMessage.textContent =
        "";
}


/*
========================================================
SAVED KEY
========================================================
*/

savedKeyButton.addEventListener(
    "click",
    () => {

        closeDeleteKeyModal();

        showPublishMessage(
            "File published. Make sure you saved your delete key.",
            "success"
        );
    }
);


/*
========================================================
COPY KEY
========================================================
*/

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
                "Delete key copied.";

        }

        catch {

            generatedDeleteKey.focus();

            generatedDeleteKey.select();

            const copied =
                document.execCommand(
                    "copy"
                );

            copyMessage.textContent =
                copied
                    ? "Delete key copied."
                    : "Select the key and copy it manually.";
        }
    }
);


/*
========================================================
CLOSE KEY MODAL
========================================================
*/

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


/*
========================================================
LOAD FILES
========================================================
*/

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
            Loading files...
        </div>
        `;

    try {

        const response =
            await fetch(
                `/api/files?${params.toString()}`,
                {
                    cache:
                        "no-store"
                }
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
            result.files
        );

    }

    catch (error) {

        console.error(
            "FILES:",
            error
        );

        library.innerHTML =
            `
            <div class="empty">
                Unable to load files.
            </div>
            `;
    }
}


/*
========================================================
RENDER FILES
========================================================
*/

function renderFiles(
    files
) {

    if (
        !Array.isArray(files) ||
        !files.length
    ) {

        library.innerHTML =
            `
            <div class="empty">
                No files found.
            </div>
            `;

        return;
    }

    library.innerHTML =
        files
            .map(
                createFileCard
            )
            .join("");

    /*
    DOWNLOAD
    */

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
                            `/api/files/${encodeURIComponent(
                                id
                            )}/download`;
                    }
                );
            }
        );

    /*
    DELETE
    */

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

    /*
    PREVIEW
    */

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


/*
========================================================
FILE CARD
========================================================
*/

function createFileCard(
    file
) {

    const previewButton =
        file.script
            ? `
                <button
                    type="button"
                    data-preview="${escapeHtml(
                        file.id
                    )}"
                    data-name="${escapeHtml(
                        file.displayName
                    )}"
                >
                    Preview
                </button>
            `
            : "";

    return `
        <article class="file-card">

            <div class="file-top">

                <div>

                    <div class="file-name">
                        ${escapeHtml(
                            file.displayName
                        )}
                    </div>

                    <div class="file-meta">

                        ${escapeHtml(
                            file.name
                        )}

                        •

                        ${escapeHtml(
                            String(
                                file.extension
                            ).toUpperCase()
                        )}

                        •

                        ${formatBytes(
                            file.size
                        )}

                        <br>

                        Published by

                        <strong>
                            ${escapeHtml(
                                file.uploader
                            )}
                        </strong>

                        •

                        ${formatDate(
                            file.date
                        )}

                        <br>

                        Downloads:
                        ${Number(
                            file.downloads || 0
                        )}

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

                ${previewButton}

                <button
                    type="button"
                    data-download="${escapeHtml(
                        file.id
                    )}"
                >
                    Download
                </button>

                <button
                    type="button"
                    class="delete-file"
                    data-delete="${escapeHtml(
                        file.id
                    )}"
                >
                    Delete
                </button>

            </div>

        </article>
    `;
}


/*
========================================================
DELETE MODAL
========================================================
*/

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

    deleteTokenInput.value =
        "";

    selectedDeleteFileId =
        null;
}


/*
========================================================
CANCEL DELETE
========================================================
*/

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


/*
========================================================
CONFIRM DELETE
========================================================
*/

confirmDeleteButton.addEventListener(
    "click",
    deleteFile
);


deleteTokenInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

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

        deleteTokenInput.focus();

        return;
    }

    confirmDeleteButton.disabled =
        true;

    cancelDeleteButton.disabled =
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
            "DELETE:",
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

        cancelDeleteButton.disabled =
            false;

        confirmDeleteButton.textContent =
            "Delete";
    }
}


/*
========================================================
SCRIPT PREVIEW
========================================================
*/

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


/*
========================================================
CLOSE PREVIEW
========================================================
*/

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

                previewContent.textContent =
                    "";
            }
        );
    }
);


/*
========================================================
STATS
========================================================
*/

async function loadStats() {

    try {

        const response =
            await fetch(
                "/api/stats",
                {
                    cache:
                        "no-store"
                }
            );

        const result =
            await response.json();

        if (
            !result.success
        ) {

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
            "STATS:",
            error
        );
    }
}


/*
========================================================
UPLOADERS
========================================================
*/

async function loadUploaders() {

    try {

        const response =
            await fetch(
                "/api/uploaders",
                {
                    cache:
                        "no-store"
                }
            );

        const result =
            await response.json();

        if (
            !result.success
        ) {

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

        result.uploaders.forEach(
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
            "UPLOADERS:",
            error
        );
    }
}


/*
========================================================
HEALTH
========================================================
*/

async function checkHealth() {

    try {

        const response =
            await fetch(
                "/api/health",
                {
                    cache:
                        "no-store"
                }
            );

        const result =
            await response.json();

        if (
            response.ok &&
            result.success
        ) {

            serverStatus.textContent =
                "Server Online";

            serverStatus.className =
                "status online";

            return;
        }

        throw new Error();

    }

    catch {

        serverStatus.textContent =
            "Server Offline";

        serverStatus.className =
            "status offline";
    }
}


/*
========================================================
LOAD EVERYTHING
========================================================
*/

async function loadEverything() {

    await Promise.all([
        loadFiles(),
        loadStats(),
        loadUploaders(),
        checkHealth()
    ]);
}


/*
========================================================
FILTERS
========================================================
*/

let searchTimer =
    null;

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


/*
========================================================
ESCAPE KEY
========================================================
*/

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Escape"
        ) {

            return;
        }

        if (
            !deleteKeyModal.classList.contains(
                "hidden"
            )
        ) {

            closeDeleteKeyModal();

            return;
        }

        if (
            !deleteModal.classList.contains(
                "hidden"
            )
        ) {

            closeDeleteModal();

            return;
        }

        if (
            !previewModal.classList.contains(
                "hidden"
            )
        ) {

            previewModal.classList.add(
                "hidden"
            );
        }
    }
);


/*
========================================================
REAL-TIME EVENTS
========================================================
*/

function connectEvents() {

    if (
        !window.EventSource
    ) {

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
            Browser automatically reconnects.
            */
        };
}


/*
========================================================
START
========================================================
*/

loadEverything();

connectEvents();
