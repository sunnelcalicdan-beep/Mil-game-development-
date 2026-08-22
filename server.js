const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        project: "MIL Game Development"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`MIL Game Development running on port ${PORT}`);
});
