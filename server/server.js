const HTTPS_PORT = 8443;

const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const WebSocketServer = WebSocket.Server;

// Load SSL certificate and key
const options = {
    key: fs.readFileSync('www_brightspace_health.key'),
    cert: fs.readFileSync('www_brightspace_health_combined.crt'),

};



// All connected to the server users 
let users = {};
let allUsers = [];

// ----------------------------------------------------------------------------------------

// Create a server for the client HTML page
const handleRequest = function (request, response) {
    try {
        console.log('request received: ' + request.url);

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

const httpsServer = https.createServer(options, handleRequest);
httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server listening on port ${HTTPS_PORT}`);
});

// ----------------------------------------------------------------------------------------

// Create a server for handling WebSocket calls
const wss = new WebSocketServer({ server: httpsServer });

wss.on('connection', function (ws) {
    ws.on('message', function (message) {
        try {
            let data;

            try {
                data = JSON.parse(message);
            } catch (e) {
                console.log("Invalid JSON received");
                return;
            }

            console.log('Received data:', data);

            switch (data.type) {
                case "login":
                    handleLogin(ws, data);
                    break;

                case "offer":
                    handleOffer(ws, data);
                    break;

                case "answer":
                    handleAnswer(ws, data);
                    break;

                case "candidate":
                    handleCandidate(ws, data);
                    break;

                case "leave":
                    handleLeave(ws, data);
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

    ws.on("close", function () {
        try {
            if (ws.name) {
                delete users[ws.name];

                if (ws.otherName) {
                    console.log("Disconnecting from ", ws.otherName);
                    let conn = users[ws.otherName];

                    if (conn) {
                        conn.otherName = null;
                        sendTo(conn, {
                            type: "leave"
                        });
                    }
                }
            }
        } catch (error) {
            console.error("Error during websocket close: ", error);
        }
    });
});

function handleLogin(ws, data) {
    console.log("User logged", data.name);

    if (users[data.name]) {
        sendTo(ws, {
            type: "login",
            success: false
        });
    } else {
        console.log('Save user connection on the server');
        users[data.name] = ws;
        if (allUsers.indexOf(data.name) === -1) {
            allUsers.push(data.name);
        } else {
            console.log("User already exists in allUsers");
        }

        ws.name = data.name;

        sendTo(ws, {
            type: "login",
            success: true,
            allUsers: allUsers
        });
    }
}

function handleOffer(ws, data) {
    console.log("Sending offer to: ", data.name);
    let conn = users[data.name];

    if (conn) {
        ws.otherName = data.name;
        sendTo(conn, {
            type: "offer",
            offer: data.offer,
            name: ws.name
        });
    }
}

function handleAnswer(ws, data) {
    console.log("Sending answer to: ", data.name);
    let conn = users[data.name];
    console.log('Answer: ', data.answer);

    if (conn) {
        ws.otherName = data.name;
        sendTo(conn, {
            type: "answer",
            answer: data.answer
        });
    }
}

function handleCandidate(ws, data) {
    console.log("Sending candidate to:", data.name);
    let conn = users[data.name];

    if (conn) {
        sendTo(conn, {
            type: "candidate",
            candidate: data.candidate
        });
    }
}

function handleLeave(ws, data) {
    console.log("Disconnecting from", data.name);
    let conn = users[data.name];

    if (conn) {
        conn.otherName = null;
        sendTo(conn, {
            type: "leave"
        });
    }
}

function sendTo(connection, message) {
    try {
        connection.send(JSON.stringify(message));
    } catch (error) {
        console.error("Error sending message: ", error);
    }
}

console.log('Server running. Visit https://localhost:' + HTTPS_PORT + ' in Firefox/Chrome.\n\n\
Some important notes:\n\
  * Note the HTTPS; there is no HTTP -> HTTPS redirect.\n\
  * You\'ll also need to accept the invalid TLS certificate.\n\
  * Some browsers or OSs may not allow the webcam to be used by multiple pages at once. You may need to use two different browsers or machines.\n'
);
