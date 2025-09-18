import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Configuration for SSL
const ssl = true; // Set this to false if you don't want SSL

// Read Gemini API key optionally
let GEMINI_API_KEY = null;
const keyPath = path.join(process.cwd(), 'gemini_key.txt');
if (fs.existsSync(keyPath)) {
    const key = fs.readFileSync(keyPath, 'utf8').trim();
    if (key) GEMINI_API_KEY = key;
}

// Messages directory
const messagesDir = path.join(process.cwd(), 'messages');
if (!fs.existsSync(messagesDir)) fs.mkdirSync(messagesDir);
['general.json', 'random.json', 'ai.json'].forEach(file => {
    const filePath = path.join(messagesDir, file);
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');
});

// Get messages
app.get('/messages/:channel', (req, res) => {
    const filePath = path.join(messagesDir, `${req.params.channel}.json`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.json([]);
        const messages = JSON.parse(data);
        const safeMessages = messages.map(({ username, message, time, image }) => ({
            username,
            message,
            time,
            image,
            uncopyable: username === 'Owner'
        }));
        res.json(safeMessages);
    });
});

// Post message
app.post('/upload/:channel', (req, res) => {
    const channel = req.params.channel;
    const filePath = path.join(messagesDir, `${channel}.json`);
    const newMsg = {
        username: req.body.username || 'Anonymous',
        message: req.body.message || '',
        image: req.body.image || null,
        time: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
    };
    fs.readFile(filePath, 'utf8', (err, data) => {
        let msgs = [];
        if (!err) msgs = JSON.parse(data);
        msgs.push(newMsg);
        fs.writeFile(filePath, JSON.stringify(msgs, null, 2), () => res.json({ success: true }));
    });
});

// Delete message (Admin)
app.delete('/deleteMessage/:channel/:index', (req, res) => {
    const channel = req.params.channel;
    const index = parseInt(req.params.index);
    const filePath = path.join(messagesDir, `${channel}.json`);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.json({ success: false });
        let msgs = JSON.parse(data);
        if (index < 0 || index >= msgs.length) return res.json({ success: false });
        msgs.splice(index, 1);
        fs.writeFile(filePath, JSON.stringify(msgs, null, 2), () => res.json({ success: true }));
    });
});

// AI endpoint (optional)
app.post('/ai', async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(400).json({ error: "AI not available (no API key)" });
    }
    const prompt = req.body.prompt;
    if (!prompt) return res.status(400).json({ error: "No prompt provided" });

    try {
        const response = await fetch('https://api.gemini.ai/v1/query', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GEMINI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gemini-1.5',
                prompt: prompt
            })
        });
        const data = await response.json();
        const answer = data.answer || "No response";

        // Save AI conversation
        const filePath = path.join(messagesDir, 'ai.json');
        fs.readFile(filePath, 'utf8', (err, content) => {
            let msgs = [];
            if (!err) msgs = JSON.parse(content);
            msgs.push({ username: 'AI', message: answer, time: new Date().toISOString() });
            fs.writeFile(filePath, JSON.stringify(msgs, null, 2), () => {});
        });

        res.json({ answer });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "AI request failed" });
    }
});

// SSL and HTTP Logic
const PORT = process.env.PORT || 13551; // Default to port 443 for HTTPS

// Check for SSL certificates and configure server accordingly
const certsDir = path.join(process.cwd(), 'certs');
const certPath = {
    key: path.join(certsDir, 'privatekey.pem'),
    cert: path.join(certsDir, 'fullchain.pem')
};

// Start HTTPS if SSL certificates are found, otherwise start HTTP
if (ssl && fs.existsSync(certPath.key) && fs.existsSync(certPath.cert)) {
    const sslOptions = {
        key: fs.readFileSync(certPath.key),
        cert: fs.readFileSync(certPath.cert)
    };
    https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`✅ HTTPS server running at https://localhost:${PORT}`);
    });
} else {
    // If SSL is not enabled or certificates are missing, fall back to HTTP
    http.createServer(app).listen(PORT, () => {
        console.log(`⚡ HTTP server running at http://localhost:${PORT}`);
    });
}