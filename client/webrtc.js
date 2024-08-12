var localVideo;
var localStream;
var myName;
var remoteVideo;
var yourConn;
var uuid;
var serverConnection;
var connectionState;

var name;
var connectedUser;

var peerConnectionConfig = {
  'iceServers': [
    {
      "urls": 'turn:3.128.78.243:3478?transport=tcp',
      "username": 'zomie',
      "credential": 'password'
    }
  ]
};

try {
  serverConnection = new WebSocket('wss://' + window.location.hostname + ':30001');

  serverConnection.onopen = function () {
    console.log("Connected to the signaling server");
  };

  serverConnection.onmessage = gotMessageFromServer;

  serverConnection.onerror = function (err) {
    console.log("WebSocket error:", err);
  };

} catch (error) {
  console.error("Error initializing WebSocket:", error);
}

document.getElementById('otherElements').hidden = true;
var usernameInput = document.querySelector('#usernameInput');
var usernameShow = document.querySelector('#showLocalUserName');
var showAllUsers = document.querySelector('#allUsers');
var remoteUsernameShow = document.querySelector('#showRemoteUserName');
var loginBtn = document.querySelector('#loginBtn');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');
var hangUpBtn = document.querySelector('#hangUpBtn');
var answerBtn = document.querySelector('#answerBtn');
var declineBtn = document.querySelector('#declineBtn');
var muteMicBtn = document.querySelector('#muteMicBtn');
var unmuteMicBtn = document.querySelector('#unmuteMicBtn');

// Login when the user clicks the button
loginBtn.addEventListener("click", function () {
  try {
    name = usernameInput.value;
    usernameShow.innerHTML = "Hello, " + name;
    if (name.length > 0) {
      send({
        type: "login",
        name: name
      });
    }
  } catch (error) {
    console.error("Error during login:", error);
  }
});

/* START: Register user for the first time i.e. Prepare ground for WebRTC call to happen */
function handleLogin(success, allUsers) {
  try {
    if (success === false) {
      alert("Oops...try a different username");
    } else {
      var allAvailableUsers = allUsers.join();
      console.log('All available users', allAvailableUsers);
      showAllUsers.innerHTML = 'Available users: ' + allAvailableUsers;
      localVideo = document.getElementById('localVideo');
      remoteVideo = document.getElementById('remoteVideo');
      document.getElementById('myName').hidden = true;
      document.getElementById('otherElements').hidden = false;

      var constraints = {
        video: true,
        audio: true
      };

      /* START: The camera stream acquisition */
      if (navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia(constraints)
          .then(getUserMediaSuccess)
          .catch(errorHandler);
      } else {
        alert('Your browser does not support getUserMedia API');
      }
      /* END: The camera stream acquisition */
    }
  } catch (error) {
    console.error("Error handling login:", error);
  }
}
/* END: Register user for the first time i.e. Prepare ground for WebRTC call to happen */

function getUserMediaSuccess(stream) {
  try {
    localStream = stream;
    localVideo.srcObject = stream;
    yourConn = new RTCPeerConnection(peerConnectionConfig);

    connectionState = yourConn.connectionState;
    console.log('connection state inside getUserMediaSuccess', connectionState);

    yourConn.onicecandidate = function (event) {
      try {
        if (event.candidate) {
          send({
            type: "candidate",
            candidate: event.candidate
          });
        }
      } catch (error) {
        console.error("Error handling ICE candidate:", error);
      }
    };

    yourConn.ontrack = gotRemoteStream;
    yourConn.addStream(localStream);

  } catch (error) {
    console.error("Error in getUserMediaSuccess:", error);
  }
}

/* START: Initiate call to any user i.e. send message to server */
callBtn.addEventListener("click", function () {
  try {
    if (yourConn.connectionState !== 'new' && yourConn.connectionState !== 'closed') {
      alert("You already have an ongoing call. Please hang up first.");
      return;
    }

    var callToUsername = callToUsernameInput.value;

    if (callToUsername.length > 0) {
      connectedUser = callToUsername;
      yourConn.createOffer()
        .then(offer => {
          return yourConn.setLocalDescription(offer);
        })
        .then(() => {
          send({
            type: "offer",
            offer: yourConn.localDescription
          });
        })
        .catch(error => {
          alert("Error when creating an offer: " + error.message);
        });

      document.getElementById('callOngoing').style.display = 'block';
      document.getElementById('callInitiator').style.display = 'none';
    } else {
      alert("Username can't be blank!");
    }
  } catch (error) {
    console.error("Error initiating call:", error);
  }
});
/* END: Initiate call to any user i.e. send message to server */

/* START: Received call from server i.e. receive messages from server */
function gotMessageFromServer(message) {
  try {
    console.log("Got message", message.data);
    var data = JSON.parse(message.data);

    switch (data.type) {
      case "login":
        handleLogin(data.success, data.allUsers);
        break;
      case "offer":
        console.log('inside offer');
        handleOffer(data.offer, data.name);
        break;
      case "answer":
        console.log('inside answer');
        handleAnswer(data.answer);
        break;
      case "candidate":
        console.log('inside handle candidate');
        handleCandidate(data.candidate);
        break;
      case "leave":
        handleLeave();
        break;
      default:
        console.warn("Unknown message type:", data.type);
        break;
    }
  } catch (error) {
    console.error("Error handling message from server:", error);
  }
}

function send(msg) {
  try {
    if (connectedUser) {
      msg.name = connectedUser;
    }
    console.log('msg before sending to server', msg);
    serverConnection.send(JSON.stringify(msg));
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

/* START: Create an answer for an offer i.e. send message to server */
function handleOffer(offer, name) {
  try {
    document.getElementById('callInitiator').style.display = 'none';
    document.getElementById('callReceiver').style.display = 'block';

    /* Call answer functionality starts */
    answerBtn.addEventListener("click", function () {
      try {
        connectedUser = name;
        yourConn.setRemoteDescription(new RTCSessionDescription(offer))
          .then(() => yourConn.createAnswer())
          .then(answer => {
            return yourConn.setLocalDescription(answer);
          })
          .then(() => {
            send({
              type: "answer",
              answer: yourConn.localDescription
            });
          })
          .catch(error => {
            alert("Error when creating an answer: " + error.message);
          });

        document.getElementById('callReceiver').style.display = 'none';
        document.getElementById('callOngoing').style.display = 'block';
      } catch (error) {
        console.error("Error handling offer answer:", error);
      }
    });
    /* Call answer functionality ends */

    /* Call decline functionality starts */
    declineBtn.addEventListener("click", function () {
      document.getElementById('callInitiator').style.display = 'block';
      document.getElementById('callReceiver').style.display = 'none';
    });
    /* Call decline functionality ends */

  } catch (error) {
    console.error("Error handling offer:", error);
  }
}

function gotRemoteStream(event) {
  try {
    console.log('Received remote stream:', event.streams[0]);
    remoteVideo.srcObject = event.streams[0];
  } catch (error) {
    console.error("Error handling remote stream:", error);
  }
}

function errorHandler(error) {
  console.error("Error:", error);
}

muteMicBtn.addEventListener("click", function () {
  try {
    localStream.getAudioTracks()[0].enabled = false;
    muteMicBtn.style.display = 'none';
    unmuteMicBtn.style.display = 'inline';
  } catch (error) {
    console.error("Error muting microphone:", error);
  }
});

unmuteMicBtn.addEventListener("click", function () {
  try {
    localStream.getAudioTracks()[0].enabled = true;
    muteMicBtn.style.display = 'inline';
    unmuteMicBtn.style.display = 'none';
  } catch (error) {
    console.error("Error unmuting microphone:", error);
  }
});

// When we get an answer from a remote user
function handleAnswer(answer) {
  try {
    console.log('Answer: ', answer);
    yourConn.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (error) {
    console.error("Error handling answer:", error);
  }
}

// When we get an ICE candidate from a remote user
function handleCandidate(candidate) {
  try {
    yourConn.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (error) {
    console.error("Error handling ICE candidate:", error);
  }
}

// Hang up
hangUpBtn.addEventListener("click", function () {
  try {
    send({
      type: "leave"
    });

    handleLeave();

    document.getElementById('callOngoing').style.display = 'none';
    document.getElementById('callInitiator').style.display = 'block';
  } catch (error) {
    console.error("Error during hang up:", error);
  }
});

function handleLeave() {
  try {
    connectedUser = null;
    remoteVideo.srcObject = null;
    if (yourConn) {
      yourConn.close();
      yourConn.onicecandidate = null;
      yourConn.ontrack = null;
      yourConn = new RTCPeerConnection(peerConnectionConfig); // Reset the connection for new calls
    }

    document.getElementById('callOngoing').style.display = 'none';
    document.getElementById('callInitiator').style.display = 'block';
    document.getElementById('callReceiver').style.display = 'none';
  } catch (error) {
    console.error("Error handling leave:", error);
  }
}
