"use strict";

/*
========================================================
PROJECT FILE HUB
FRONTEND CONTROLLER
========================================================
*/

(() => {

    const $ =
        selector =>
            document.querySelector(
                selector
            );


    /*
    ======================================================
    ELEMENTS
    ======================================================
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
    ======================================================
    STATE
    ======================================================
    */

    let selectedDeleteFileId =
        null;


    /*
    ======================================================
    UTILITIES
    ======================================================
    */

    function formatBytes(
        bytes
    ) {

        if (
            !Number.isFinite(
                bytes
            )
        ) {

            return "0 B";

        }


        if (
            bytes === 0
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
                        bytes
                    ) /
                    Math.log(
                        1024
                    )
                ),
                units.length - 1
            );


        const value =
            bytes /
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


    function formatDate(
        timestamp
    ) {

        return new Date(
            timestamp
        ).toLocaleString();

    }


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
    ======================================================
    FILE INPUT
    ======================================================
    */

    fileInput.addEventListener(
        "change",
        () => {

            const file =
                fileInput.files[0];


            if (!file) {

                selectedFile.innerHTML =
                    "<span>📁</span> No file selected.";

                return;

            }


            selectedFile.innerHTML =
                `
                <span>📄</span>
                ${escapeHtml(file.name)}
                •
                ${formatBytes(file.size)}
                `;

        }
    );


    /*
    ======================================================
    PUBLISH
    ======================================================
    */

    publishForm.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            publishFile();

        }
    );


    function publishFile() {

        const username =
            usernameInput.value.trim();


        const displayName =
            displayNameInput.value.trim();


        const file =
            fileInput.files[0];


        if (!username) {

            showPublishMessage(
                "Enter your uploader name before publishing.",
                "error"
            );

            usernameInput.focus();

            return;

        }


        if (!file) {

            showPublishMessage(
                "Select a file before publishing.",
                "error"
            );

            return;

        }


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


        publishButton.innerHTML =
            "<span>⏳</span> Publishing...";


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


        const xhr =
            new XMLHttpRequest();


        xhr.open(
            "POST",
            "/api/files"
        );


        xhr.upload.addEventListener(
            "progress",
            event => {

                if (
                    !event.lengthComputable
                ) {

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
                    percent + "%";


                progressText.textContent =
                    `Uploading ${percent}%`;

            }
        );


        xhr.onload =
            async () => {

                publishButton.disabled =
                    false;


                publishButton.innerHTML =
                    "<span>🚀</span> Publish File";


                let result;


                try {

                    result =
                        JSON.parse(
                            xhr.responseText
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
                ==================================================
                THE SERVER GENERATED THE DELETE KEY.
                ==================================================
                */

                if (
                    !result.deleteKey
                ) {

                    showPublishMessage(
                        "The file was uploaded, but the server did not return the delete key.",
                        "error"
                    );

                    return;

                }


                progressFill.style.width =
                    "100%";


                progressText.textContent =
                    "Published successfully.";


                /*
                SHOW WARNING POPUP
                */

                showDeleteKeyModal(
                    result.deleteKey
                );


                publishForm.reset();


                selectedFile.innerHTML =
                    "<span>📁</span> No file selected.";


                await loadEverything();


                setTimeout(
                    () => {

                        uploadProgress.classList.add(
                            "hidden"
                        );

                    },
                    1000
                );

            };


        xhr.onerror =
            () => {

                publishButton.disabled =
                    false;


                publishButton.innerHTML =
                    "<span>🚀</span> Publish File";


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


    /*
    ======================================================
    DELETE KEY MODAL
    ======================================================
    */

    function showDeleteKeyModal(
        key
    ) {

        generatedDeleteKey.value =
            key;


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


        generatedDeleteKey.value =
            "";

    }


    savedKeyButton.addEventListener(
        "click",
        () => {

            closeDeleteKeyModal();


            showPublishMessage(
                "File published successfully. Keep your delete key safe.",
                "success"
            );

        }
    );


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
    )
    .forEach(
        element => {

            element.addEventListener(
                "click",
                closeDeleteKeyModal
            );

        }
    );


    /*
    ======================================================
    LOAD FILES
    ======================================================
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
            `<div class="empty">Loading library...</div>`;


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
                result.files
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


    /*
    ======================================================
    RENDER
    ======================================================
    */

    function renderFiles(
        files
    ) {

        if (
            !files.length
        ) {

            library.innerHTML =
                `
                <div class="empty">
                    ✦ No files found.
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


        library
            .querySelectorAll(
                "[data-download]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            window.location.href =
                                `/api/files/${encodeURIComponent(
                                    button.dataset.download
                                )}/download`;

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


    function createFileCard(
        file
    ) {

        const previewButton =
            file.script
                ? `
                <button
                    data-preview="${escapeHtml(file.id)}"
                    data-name="${escapeHtml(file.displayName)}"
                >
                    👁 Preview
                </button>
                `
                : "";


        return `
        <article class="file-card">

            <div class="file-top">

                <div>

                    <div class="file-name">
                        ${escapeHtml(file.displayName)}
                    </div>

                    <div class="file-meta">

                        ${escapeHtml(file.name)}
                        •
                        ${escapeHtml(
                            file.extension || "FILE"
                        ).toUpperCase()}
                        •
                        ${formatBytes(file.size)}

                        <br>

                        <div class="file-uploader">
                            👤 Uploaded by
                            <strong>
                                ${escapeHtml(file.uploader)}
                            </strong>
                        </div>

                        ${formatDate(file.date)}

                        •
                        Downloads:
                        ${file.downloads}

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
                    data-download="${escapeHtml(file.id)}"
                >
                    ⬇ Download
                </button>

                <button
                    class="delete-file"
                    data-delete="${escapeHtml(file.id)}"
                >
                    🗑 Delete
                </button>

            </div>

        </article>
        `;

    }


    /*
    ======================================================
    DELETE
    ======================================================
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


        selectedDeleteFileId =
            null;

    }


    cancelDeleteButton.addEventListener(
        "click",
        closeDeleteModal
    );


    document.querySelectorAll(
        "[data-close-delete]"
    )
    .forEach(
        element => {

            element.addEventListener(
                "click",
                closeDeleteModal
            );

        }
    );


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

        if (
            !selectedDeleteFileId
        ) {

            return;

        }


        const token =
            deleteTokenInput.value.trim();


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
                                deleteKey:
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


    /*
    ======================================================
    PREVIEW
    ======================================================
    */

    async function previewScript(
        id,
        name
    ) {

        previewTitle.textContent =
            name ||
            "Script Preview";


        previewContent.textContent =
            "Loading preview...";


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


    document.querySelectorAll(
        "[data-close-preview]"
    )
    .forEach(
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


    /*
    ======================================================
    STATS
    ======================================================
    */

    async function loadStats() {

        try {

            const response =
                await fetch(
                    "/api/stats"
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
                "Stats:",
                error
            );

        }

    }


    /*
    ======================================================
    UPLOADERS
    ======================================================
    */

    async function loadUploaders() {

        try {

            const response =
                await fetch(
                    "/api/uploaders"
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
                "Uploaders:",
                error
            );

        }

    }


    /*
    ======================================================
    HEALTH
    ======================================================
    */

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


    /*
    ======================================================
    LOAD EVERYTHING
    ======================================================
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
    ======================================================
    SEARCH
    ======================================================
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
    ======================================================
    REAL-TIME LIBRARY
    ======================================================
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

    }


    /*
    ======================================================
    ESCAPE MODALS
    ======================================================
    */

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


    /*
    ======================================================
    START
    ======================================================
    */

    loadEverything();

    connectEvents();

})();
