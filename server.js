// server.js (Runs on Render)
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 8080;
const app = express();

// 1. Serve the compiled React app (the 'dist' folder)
app.use(express.static(path.join(__dirname, 'dist')));

// Send all other requests to the React app
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// 2. Start the HTTP server
const server = app.listen(PORT, () => {
    console.log(`Web and WebSocket server running on port ${PORT}`);
});

// 3. Attach the WebSocket proxy to the SAME server
const localServer = new WebSocketServer({ server });
const TARGET_WS_URL = 'wss://livetiming.azurewebsites.net/';

let latestTimingData = {}; 

localServer.on('connection', (ws) => {
    console.log('React UI connected to proxy!');
    ws.send(JSON.stringify(latestTimingData));
});

function connectToTimingServer() {
    const remoteSocket = new WebSocket(TARGET_WS_URL, {
        headers: {
            'Origin': 'https://livetiming.azurewebsites.net', 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    remoteSocket.on('open', () => {
        console.log('Connected to official timing stream!');
    });

    remoteSocket.on('message', (data) => {
        const messageString = data.toString();
        
        try {
            const parsedData = JSON.parse(messageString);
            latestTimingData = parsedData; 

            localServer.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(latestTimingData));
                }
            });
        } catch (e) {
            console.log("Failed to parse message");
        }
    });

    remoteSocket.on('close', () => {
        console.log('Connection lost. Reconnecting in 5 seconds...');
        setTimeout(connectToTimingServer, 5000);
    });

    remoteSocket.on('error', (err) => {
        console.error('Remote socket error:', err.message);
    });
}

connectToTimingServer();
