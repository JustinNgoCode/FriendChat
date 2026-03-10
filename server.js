const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(helmet());
app.use(express.json());

// Load users from file or initialize empty
const usersFile = path.join(__dirname, 'users.json');
let users = {};
if (fs.existsSync(usersFile)) {
    try {
        const fileContent = fs.readFileSync(usersFile, 'utf8');
        if (fileContent.trim() !== '') {
            users = JSON.parse(fileContent);
            console.log('Loaded users from users.json:', users);
        } else {
            console.log('users.json is empty, starting with an empty users object');
        }
    } catch (err) {
        console.error('Error loading users from users.json:', err);
        users = {};
    }
}

const loginAttempts = {};
const connectedUsers = new Map(); // Map username to WebSocket client
const publicKeys = new Map(); // Map username to public key
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;
const MAX_MESSAGES_PER_MINUTE = 5;
const RATE_LIMIT_TIME = 60000;
const SECRET_KEY = process.env.SECRET_KEY || 'secretkey';

function logMessage(sessionId, sender, recipient, message) {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const chatPair = [sender, recipient].sort().join('-'); // Sort to ensure consistent filenames
    const logFile = path.join(logDir, `${sessionId}_${chatPair}.txt`);
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${sender} to ${recipient}: ${message}\n`);
}

function saveUsers() {
    try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
        console.log('Saved users to users.json:', users);
    } catch (err) {
        console.error('Error saving users to users.json:', err);
    }
}

function broadcastUsers() {
    const userList = Array.from(connectedUsers.keys());
    console.log('Broadcasting user list:', userList);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'users', users: userList }));
        }
    });
}

wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `ws://${req.headers.host}`);
    const token = url.searchParams.get('token');
    let username;

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        username = decoded.username;
        if (!users[username]) throw new Error('User not found');
    } catch (err) {
        console.error('Authentication failed for token:', token, err.message);
        ws.close(4001, 'Authentication failed');
        return;
    }

    const sessionId = crypto.randomUUID();
    connectedUsers.set(username, ws);
    console.log(`${username} connected. Total connected users: ${connectedUsers.size}`);
    broadcastUsers();

    ws.send(JSON.stringify({ message: 'Welcome to SecureChat!' }));

    ws.on('message', (message) => {
        try {
            const currentTime = Date.now();
            const user = users[username];

            if (currentTime - user.lastMessageTime > RATE_LIMIT_TIME) {
                user.messageCount = 0;
            }

            if (user.messageCount >= MAX_MESSAGES_PER_MINUTE) {
                ws.send(JSON.stringify({ message: 'Rate limit exceeded.' }));
                return;
            }

            user.messageCount++;
            user.lastMessageTime = currentTime;

            const data = JSON.parse(message);

            if (data.type === 'publicKey') {
                publicKeys.set(username, data.publicKey);
                console.log(`Received public key from ${username}`);
                // Broadcast public keys to all users
                wss.clients.forEach((client) => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'publicKeys', publicKeys: Object.fromEntries(publicKeys) }));
                    }
                });
            } else if (data.type === 'message') {
                const recipient = data.recipient;
                const recipientWs = connectedUsers.get(recipient);
                if (!recipientWs || recipientWs.readyState !== WebSocket.OPEN) {
                    ws.send(JSON.stringify({ message: `Error: User ${recipient} is not online.` }));
                    return;
                }
                logMessage(sessionId, username, recipient, data.message);
                recipientWs.send(JSON.stringify({ user: username, message: data.message }));
            } else if (data.type === 'file') {
                const recipient = data.recipient;
                const recipientWs = connectedUsers.get(recipient);
                if (!recipientWs || recipientWs.readyState !== WebSocket.OPEN) {
                    ws.send(JSON.stringify({ message: `Error: User ${recipient} is not online.` }));
                    return;
                }
                logMessage(sessionId, username, recipient, `Sent file: ${data.filename}`);
                recipientWs.send(JSON.stringify({ user: username, type: 'file', filename: data.filename, data: data.data, key: data.key, iv: data.iv }));
            }
        } catch (err) {
            console.error('Error processing message:', err.message);
            ws.send(JSON.stringify({ message: `Error processing your message: ${err.message}` }));
        }
    });

    ws.on('close', () => {
        connectedUsers.delete(username);
        publicKeys.delete(username);
        console.log(`${username} disconnected. Total connected users: ${connectedUsers.size}`);
        broadcastUsers();
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for ${username}:`, error);
    });
});

app.post('/register', (req, res) => {
    console.log('Received /register request:', req.body);
    const { username, password } = req.body;
    if (users[username]) return res.status(400).json({ error: 'User already exists' });
    users[username] = {
        password: bcrypt.hashSync(password, 10),
        lastMessageTime: Date.now(),
        messageCount: 0,
    };
    saveUsers();
    res.json({ message: 'User registered' });
});

app.post('/login', (req, res) => {
    console.log('Received /login request:', req.body);
    const { username, password } = req.body;
    const now = Date.now();

    if (!users[username]) return res.status(404).json({ error: 'User not found' });
    if (loginAttempts[username]?.count >= MAX_ATTEMPTS && now - loginAttempts[username].time < LOCKOUT_TIME) {
        return res.status(429).json({ error: 'Too many attempts. Try again later.' });
    }

    if (!bcrypt.compareSync(password, users[username].password)) {
        loginAttempts[username] = { count: (loginAttempts[username]?.count || 0) + 1, time: now };
        return res.status(401).json({ error: 'Wrong password' });
    }

    delete loginAttempts[username];
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));