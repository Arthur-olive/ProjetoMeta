const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const crypto = require("crypto");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "supersecret";
const DB_PATH = process.env.DB_PATH || "data/db.json";
const SOCKET_SECRET = process.env.SOCKET_SECRET || "socksecret";

function generateId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

let Low, JSONFile, db;

async function initDb() {
    const low = await import("lowdb");
    const lowNode = await import("lowdb/node");
    Low = low.Low;
    JSONFile = lowNode.JSONFile;
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const adapter = new JSONFile(DB_PATH);
    db = new Low(adapter, { subscribers: [], logs: [] });
    try {
        await db.read();
    } catch (err) {
        db.data = { subscribers: [], logs: [] };
    }
    db.data ||= { subscribers: [], logs: [] };
    await db.write();
    console.log("DB inicializado em:", DB_PATH);
}

function signPayload(payload) {
    const h = crypto.createHmac("sha256", WEBHOOK_SECRET);
    h.update(JSON.stringify(payload));
    return h.digest("hex");
}

async function postWithRetry(url, payload, headers = {}, maxAttempts = 3) {
    let attempt = 0;
    let lastErr = null;
    while (attempt < maxAttempts) {
        try {
            const res = await axios.post(url, payload, { headers, timeout: 5000 });
            return { success: true, status: res.status, data: res.data };
        } catch (err) {
            lastErr = err;
            attempt++;
            await new Promise((r) => setTimeout(r, 500 * attempt));
        }
    }
    return { success: false, error: lastErr?.message || "unknown" };
}

app.post("/subscribe", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    await db.read();
    const exists = db.data.subscribers.find((s) => s.url === url);
    if (exists) return res.json({ success: true, subscriber: exists });
    const id = generateId();
    const challenge = generateId().slice(0, 16);
    const subscriber = { id, url, status: "pending", challenge, createdAt: new Date().toISOString() };
    db.data.subscribers.push(subscriber);
    await db.write();
    try {
        const verifyUrl = url.endsWith("/") ? url + "verify" : url + "/verify";
        const r = await axios.post(verifyUrl, { challenge }, { timeout: 5000 });
        if (r.data?.challenge === challenge) {
            subscriber.status = "verified";
            await db.write();
        }
    } catch (err) {
        console.warn("Challenge não confirmado para", url, "->", err.message);
    }
    await db.read();
    res.json({ success: true, subscriber });
});

app.get("/subscribers", async (req, res) => {
    await db.read();
    res.json({ subscribers: db.data.subscribers });
});

app.delete("/subscribers/:id", async (req, res) => {
    await db.read();
    const id = req.params.id;
    const idx = db.data.subscribers.findIndex((s) => s.id === id);
    if (idx === -1) return res.status(404).json({ error: "not found" });
    db.data.subscribers.splice(idx, 1);
    await db.write();
    res.json({ success: true });
});

app.post("/event", async (req, res) => {
    await db.read();
    const payload = { message: req.body.message || "hello from backend", timestamp: new Date().toISOString() };
    const subscribers = db.data.subscribers.filter((s) => s.status === "verified");
    const results = [];
    for (const s of subscribers) {
        const signature = signPayload(payload);
        const headers = { "Content-Type": "application/json", "x-webhook-signature": signature };
        const r = await postWithRetry(s.url, payload, headers, 3);
        const log = { id: generateId(), subscriberId: s.id, url: s.url, payload, result: r, time: new Date().toISOString() };
        db.data.logs.push(log);
        results.push({ url: s.url, result: r });
        await db.write();
        if (io) io.emit("log", log);
    }
    res.json({ sent: results });
});

app.get("/logs", async (req, res) => {
    await db.read();
    res.json({ logs: [...db.data.logs].reverse() });
});

app.get("/", (req, res) => {
    res.send("Webhook backend operational (Docker-ready)");
});

const server = http.createServer(app);
let io = null;

initDb().then(() => {
    server.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
    });
    io = new Server(server, { cors: { origin: "*" } });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (token === SOCKET_SECRET) return next();
        next(new Error("unauthorized"));
    });
    io.on("connection", async (socket) => {
        await db.read();
        const initial = (db.data.logs || []).slice().reverse().slice(0, 50);
        socket.emit("logs", initial);
    });
}).catch((err) => {
    console.error("Falha ao iniciar backend:", err);
    process.exit(1);
});
