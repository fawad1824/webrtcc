const HTTPS_PORT = 30001;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// TLS configuration is required
const serverConfig = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem'),
};

// All connected users and their WebSocket connections
var users = {};
var allUsers = [];

// ----------------------------------------------------------------------------------------

// Create a server for serving the client HTML page
const handleRequest = function(request, response) {
    try {
        console.log('Request received: ' + request.url);

        if (request.url === '/') {
            response.writeHead(200, { 'Content-Type': 'text/html' });
            response.end(fs.readFileSync('client/index.html'));
        } else if (request.url === '/webrtc.js') {
            response.writeHead(200, { 'Content-Type': 'application/javascript' });
            response.end(fs.readFileSync('client/webrtc.js'));
        } else {
            response.writeHead(404);
            response.end();
        }
    } catch (error) {
        console.error("Error handling request: ", error);
        response.writeHead(500);
        response.end("Internal Server Error");
    }
};

const httpsServer = https.createServer(serverConfig, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0');

// ----------------------------------------------------------------------------------------

// Create a WebSocket server
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', function(ws) {
    ws.on('message', function(message) {
        try {
            var data;

            // Accepting only JSON messages
            try {
                data = JSON.parse(message);
            } catch (e) {
                console.log("Invalid JSON");
                data = {};
            }

            console.log('Received data:', data);

            // Switching type of the user message
            switch (data.type) {
                case "login":
                    console.log("User logged in:", data.name);

                    if (users[data.name]) {
                        sendTo(ws, {
                            type: "login",
                            success: false
                        });
                    } else {
                        console.log('Saving user connection on the server');
                        users[data.name] = ws;
                        allUsers.indexOf(data.name) === -1 ? allUsers.push(data.name) : console.log("This item already exists");

                        ws.name = data.name;

                        sendTo(ws, {
                            type: "login",
                            success: true,
                            allUsers: allUsers
                        });
                    }
                    break;

                case "offer":
                    console.log("Sending offer to:", data.name);
                    var conn = users[data.name];

                    if (conn != null) {
                        ws.otherName = data.name;
                        sendTo(conn, {
                            type: "offer",
                            offer: data.offer,
                            name: ws.name
                        });
                    }
                    break;

                case "answer":
                    console.log("Sending answer to:", data.name);
                    var conn = users[data.name];

                    if (conn != null) {
                        ws.otherName = data.name;
                        sendTo(conn, {
                            type: "answer",
                            answer: data.answer
                        });
                    }
                    break;

                case "candidate":
                    console.log("Sending candidate to:", data.name);
                    var conn = users[data.name];

                    if (conn != null) {
                        sendTo(conn, {
                            type: "candidate",
                            candidate: data.candidate
                        });
                    }
                    break;

                case "leave":
                    console.log("Disconnecting from", data.name);
                    var conn = users[data.name];

                    if (conn) {
                        conn.otherName = null;
                        sendTo(conn, {
                            type: "leave"
                        });
                    }
                    break;

                default:
                    sendTo(ws, {
                        type: "error",
                        message: "Command not found: " + data.type
                    });
                    break;
            }
        } catch (error) {
            console.error("Error processing message: ", error);
        }
    });

    ws.on('error', function(error) {
        console.error("WebSocket error observed:", error);
        ws.close(); // Close the connection on error to avoid further issues
    });

    ws.on("close", function() {
        try {
            if (ws.name) {
                delete users[ws.name];

                if (ws.otherName) {
                    console.log("Disconnecting from", ws.otherName);
                    var conn = users[ws.otherName];

                    if (conn) {
                        conn.otherName = null;
                        sendTo(conn, {
                            type: "leave"
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error during WebSocket close:", error);
        }
    });
});

function sendTo(connection, message) {
    try {
        connection.send(JSON.stringify(message));
    } catch (error) {
        console.error("Error sending message:", error);
    }
}

httpsServer.on('error', (err) => {
    console.error('Server error:', err);
});

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);
