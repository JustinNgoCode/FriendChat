# SecureChat

SecureChat is a real-time messaging application built using WebSockets that allows multiple users to communicate instantly. The project demonstrates a full-stack architecture with a Node.js backend and an Electron-based desktop client.

The goal of this project was to explore real-time communication systems, client-server architecture, and secure handling of user authentication.

---

## Features

* Real-time messaging using WebSockets
* Multi-user chat support
* Secure authentication using JWT
* Password hashing with bcrypt
* REST API backend using Express
* Security middleware using Helmet and CORS
* Environment configuration using dotenv
* Electron desktop client interface

---

## Tech Stack

**Backend**

* Node.js
* Express
* WebSockets (`ws`)
* JSON Web Tokens (`jsonwebtoken`)
* bcryptjs

**Frontend**

* Electron

**Security**

* Helmet
* CORS
* Environment variables with dotenv

---

## Project Structure

```
securechat/
│
├── server.js        # WebSocket + API server
├── main.js          # Electron application entry point
├── package.json
├── .env             # Environment variables
│
└── client/
    └── UI files for the Electron chat interface
```

---

## Installation

Clone the repository:

```bash
git clone https://github.com/JustinNgoCode/securechat.git
cd securechat
```

Install dependencies:

```bash
npm install
```

---

## Running the Application

Start the backend server:

```bash
npm run server
```

Then launch the Electron client:

```bash
npm start
```

For development with automatic server restart:

```bash
npm run server:dev
```

---

## How It Works

1. The Node.js server manages authentication and WebSocket connections.
2. Clients connect through the Electron interface.
3. Messages are routed through the WebSocket server and broadcast to connected users in real time.
4. Authentication tokens ensure only authorized users can access chat functionality.

---

## Demo

A demo video showing the real-time messaging functionality is available here:

*(Add your video link here)*

---

## Purpose

This project was built to practice:

* Real-time communication systems
* Client-server architecture
* Secure authentication workflows
* Full-stack JavaScript development

---

## Author

Justin Ngo
Computer Science — California State University, Fullerton

---

