import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "peerjs";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const socket = SERVER_URL ? io(SERVER_URL) : io();

const MAX_PARTICIPANTS = 6;

const TURN_USER = import.meta.env.VITE_TURN_USERNAME;
const TURN_PASS = import.meta.env.VITE_TURN_CREDENTIAL;
const TURN_HOST = import.meta.env.VITE_TURN_HOST || "global.relay.metered.ca";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  TURN_USER
    ? {
        urls: [
          `turn:${TURN_HOST}:80`,
          `turn:${TURN_HOST}:80?transport=tcp`,
          `turn:${TURN_HOST}:443`,
          `turns:${TURN_HOST}:443?transport=tcp`,
        ],
        username: TURN_USER,
        credential: TURN_PASS,
      }
    : {
        urls: [
          "turn:openrelay.metered.ca:80",
          "turn:openrelay.metered.ca:443",
          "turn:openrelay.metered.ca:443?transport=tcp",
        ],
        username: "openrelayproject",
        credential: "openrelayproject",
      },
];

function RemoteVideo({ stream, name, handUp }) {
  const ref = useRef();

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div className={`video-tile ${handUp ? "hand-up" : ""}`}>
      <video
        ref={ref}
        playsInline
        autoPlay
        onClick={() => ref.current?.play().catch(() => {})}
      />
      <span className="name-tag">
        {name}
        {handUp && <span className="hand-badge">✋</span>}
        {!stream ? " (connecting...)" : ""}
      </span>
    </div>
  );
}

function MeetingRoom() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();

  const myVideoRef = useRef();
  const localStreamRef = useRef();
  const callsRef = useRef({});
  const transcriptEndRef = useRef();
  const lastInterimSent = useRef(0);

  const myName = JSON.parse(localStorage.getItem("user") || "{}").name || "Guest";

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [remotes, setRemotes] = useState({});
  const [handsUp, setHandsUp] = useState({});
  const [myHand, setMyHand] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [myInterim, setMyInterim] = useState("");
  const [remoteInterims, setRemoteInterims] = useState({});
  const [speechSupported, setSpeechSupported] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [mediaHint, setMediaHint] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [notes, setNotes] = useState("");
  const [showEnd, setShowEnd] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");

  const remoteList = Object.entries(remotes);
  const raisedNames = [
    ...(myHand ? [`${myName} (You)`] : []),
    ...remoteList.filter(([id]) => handsUp[id]).map(([, r]) => r.name),
  ];

  const openEnd = () => {
    const lines = [...transcript];
    if (myInterim.trim()) lines.push(`${myName}: ${myInterim.trim()}`);
    if (lines.length > 0) setNotes(lines.join("\n"));
    setShowEnd(true);
  };

  const handleEndMeeting = async () => {
    if (!notes.trim()) {
      setError("Add some notes or a transcript first.");
      return;
    }
    setSummarizing(true);
    setError("");
    try {
      await api.post(`/meetings/${roomId}/summarize`, { transcript: notes });
      navigate(`/meeting-summary/${roomId}`);
    } catch (err) {
      setError(err.response?.data?.message || "Summarize failed. Try again.");
      setSummarizing(false);
    }
  };

  const toggleHand = () => {
    const next = !myHand;
    setMyHand(next);
    socket.emit("raise-hand", { roomId, raised: next });
  };

  // Video call (everyone connects to everyone) and chat
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    let active = true;
    setMyHand(false);
    setRoomFull(false);

    const peer = new Peer(undefined, { config: { iceServers: ICE_SERVERS } });

    let peerId = null;
    let joined = false;

    const addRemote = (id, name, stream) => {
      setRemotes((prev) => ({
        ...prev,
        [id]: {
          name: name || prev[id]?.name || "Guest",
          stream: stream || prev[id]?.stream || null,
        },
      }));
    };

    const removeRemote = (id) => {
      if (callsRef.current[id]) {
        try {
          callsRef.current[id].close();
        } catch (e) {
          /* already closed */
        }
        delete callsRef.current[id];
      }
      setRemotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setHandsUp((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    const tryJoin = () => {
      if (!active || joined || !peerId || !localStreamRef.current) return;
      joined = true;
      socket.emit("join-room", { roomId, peerId, name: myName });
    };

    // Try camera + microphone, then microphone only
    const getMedia = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-media");
      }
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (e) {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        if (active) {
          setMediaError(
            "The camera could not be opened. Allow camera access for this site, close other apps or tabs that use the camera, then refresh. You joined with audio only."
          );
        }
        return audioOnly;
      }
    };

    const streamPromise = getMedia();

    // Show a hint if the permission box seems stuck
    const hintTimer = setTimeout(() => {
      if (active && !localStreamRef.current) setMediaHint(true);
    }, 6000);

    // Answer incoming calls once our media is ready
    peer.on("call", async (call) => {
      const callerName = call.metadata?.name || "Guest";
      addRemote(call.peer, callerName, null);
      try {
        const stream = await streamPromise;
        if (!active) return;
        callsRef.current[call.peer] = call;
        call.answer(stream);
        call.on("stream", (remoteStream) =>
          addRemote(call.peer, callerName, remoteStream)
        );
        call.on("close", () => removeRemote(call.peer));
      } catch (e) {
        /* no media available, cannot answer */
      }
    });

    peer.on("open", (id) => {
      peerId = id;
      tryJoin();
    });

    streamPromise
      .then((stream) => {
        clearTimeout(hintTimer);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setMediaHint(false);
        setCameraOn(stream.getVideoTracks().length > 0);
        localStreamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          myVideoRef.current.play().catch(() => {});
        }
        tryJoin();
      })
      .catch((e) => {
        clearTimeout(hintTimer);
        if (!active) return;
        setMediaHint(false);
        if (e && e.message === "no-media") {
          setMediaError(
            "Camera and microphone need a secure (https) link, so you cannot join this meeting from here."
          );
        } else {
          setMediaError(
            "Could not access the camera or microphone. Click the icon at the left of the address bar, allow both for this site, and refresh the page to join."
          );
        }
      });

    // We just joined: call everyone who is already in the room
    const handleRoomUsers = (users) => {
      if (!active || !localStreamRef.current) return;
      setHandsUp((prev) => {
        const next = { ...prev };
        users.forEach((u) => {
          if (u.handRaised) next[u.peerId] = true;
        });
        return next;
      });
      users.forEach(({ peerId: otherId, name }) => {
        addRemote(otherId, name, null);
        const call = peer.call(otherId, localStreamRef.current, {
          metadata: { name: myName },
        });
        if (!call) return;
        callsRef.current[otherId] = call;
        call.on("stream", (remoteStream) => addRemote(otherId, name, remoteStream));
        call.on("close", () => removeRemote(otherId));
      });
    };

    // Someone else joined: show a placeholder tile, they will call us
    const handleUserJoined = ({ peerId: otherId, name }) => {
      if (!active) return;
      addRemote(otherId, name, null);
    };

    const handleUserLeft = ({ peerId: otherId }) => {
      removeRemote(otherId);
    };

    const handleHandChanged = ({ peerId: otherId, raised }) => {
      setHandsUp((prev) => {
        const next = { ...prev };
        if (raised) next[otherId] = true;
        else delete next[otherId];
        return next;
      });
    };

    // The room already has the maximum number of people
    const handleRoomFull = () => {
      if (!active) return;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      try {
        peer.destroy();
      } catch (e) {
        /* already destroyed */
      }
      setRoomFull(true);
    };

    const handleReceiveMessage = ({ message, sender }) => {
      setMessages((prev) => [...prev, { message, sender }]);
    };

    socket.on("room-users", handleRoomUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("hand-changed", handleHandChanged);
    socket.on("room-full", handleRoomFull);
    socket.on("receive-message", handleReceiveMessage);

    return () => {
      active = false;
      clearTimeout(hintTimer);
      socket.emit("leave-room");
      socket.off("room-users", handleRoomUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("hand-changed", handleHandChanged);
      socket.off("room-full", handleRoomFull);
      socket.off("receive-message", handleReceiveMessage);
      Object.values(callsRef.current).forEach((c) => {
        try {
          c.close();
        } catch (e) {
          /* already closed */
        }
      });
      callsRef.current = {};
      try {
        peer.destroy();
      } catch (e) {
        /* already destroyed */
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [roomId]);

  // Live transcript (speech recognition with live partial words)
  useEffect(() => {
    if (!localStorage.getItem("token") || roomFull) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    let active = true;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const spoken = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          if (!spoken) continue;
          const line = `${myName}: ${spoken}`;
          setTranscript((prev) => [...prev, line]);
          setMyInterim("");
          socket.emit("transcript-line", { roomId, line });
          socket.emit("transcript-interim", { roomId, name: myName, text: "" });
        } else {
          interim += spoken + " ";
        }
      }
      if (interim) {
        setMyInterim(interim);
        const now = Date.now();
        if (now - lastInterimSent.current > 250) {
          lastInterimSent.current = now;
          socket.emit("transcript-interim", {
            roomId,
            name: myName,
            text: interim,
          });
        }
      }
    };

    recognition.onend = () => {
      if (active) {
        try {
          recognition.start();
        } catch (e) {
          /* already started */
        }
      }
    };
    recognition.onerror = () => {};

    try {
      recognition.start();
    } catch (e) {
      /* already started */
    }

    const handleLine = ({ line }) => {
      setTranscript((prev) => [...prev, line]);
      const speaker = line.split(": ")[0];
      setRemoteInterims((prev) => {
        const next = { ...prev };
        delete next[speaker];
        return next;
      });
    };
    const handleInterim = ({ name, text }) => {
      setRemoteInterims((prev) => {
        const next = { ...prev };
        if (text) next[name] = text;
        else delete next[name];
        return next;
      });
    };
    socket.on("transcript-line", handleLine);
    socket.on("transcript-interim", handleInterim);

    return () => {
      active = false;
      recognition.stop();
      socket.off("transcript-line", handleLine);
      socket.off("transcript-interim", handleInterim);
    };
  }, [roomId, roomFull]);

  // Keep the transcript scrolled to the newest line
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [transcript, myInterim, remoteInterims]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("send-message", { roomId, message: text, sender: myName });
    setText("");
  };

  if (roomFull) {
    return (
      <div className="container">
        <div className="summary-card" style={{ textAlign: "center" }}>
          <h2>This meeting is full</h2>
          <p className="muted">
            A meeting can have up to {MAX_PARTICIPANTS} people. Ask the host to
            check the meeting, or try again when someone leaves.
          </p>
          <Link className="btn btn-primary" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const interimStyle = { color: "var(--muted)", fontStyle: "italic" };
  const hasInterim = myInterim || Object.keys(remoteInterims).length > 0;

  return (
    <div className="container">
      <div className="room-header">
        <div>
          <h2>Meeting Room</h2>
          <span className="muted">
            {remoteList.length + 1} of {MAX_PARTICIPANTS} people in this meeting
          </span>
        </div>
        <div className="room-actions">
          <button
            className={`btn ${myHand ? "btn-hand-active" : "btn-ghost"}`}
            onClick={toggleHand}
          >
            ✋ {myHand ? "Lower hand" : "Raise hand"}
          </button>
          <button className="btn btn-danger" onClick={openEnd}>
            End Meeting
          </button>
        </div>
      </div>

      {raisedNames.length > 0 && (
        <p className="hand-summary">✋ Hands raised: {raisedNames.join(", ")}</p>
      )}

      {showEnd && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>End meeting</h3>
            <p className="muted">
              Live transcript is filled in below. You can edit it before generating the summary.
            </p>
            <textarea
              rows={8}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={summarizing}
            />
            {error && <p className="error-text">{error}</p>}
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleEndMeeting}
                disabled={summarizing}
              >
                {summarizing ? "Summarizing..." : "Generate Summary"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowEnd(false)}
                disabled={summarizing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {mediaError && (
        <p className="error-text" style={{ marginBottom: 16 }}>{mediaError}</p>
      )}
      {mediaHint && !mediaError && (
        <p className="error-text" style={{ marginBottom: 16 }}>
          Waiting for camera and microphone permission. Look for a permission box
          near the address bar and click Allow. You join the meeting once it opens.
        </p>
      )}

      <div
        className="room-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 420px))",
          justifyContent: "center",
        }}
      >
        <div className={`video-tile ${myHand ? "hand-up" : ""}`}>
          <video ref={myVideoRef} muted playsInline autoPlay />
          <span className="name-tag">
            {myName} (You){cameraOn ? "" : " - camera off"}
            {myHand && <span className="hand-badge">✋</span>}
          </span>
        </div>
        {remoteList.map(([id, remote]) => (
          <RemoteVideo
            key={id}
            stream={remote.stream}
            name={remote.name}
            handUp={!!handsUp[id]}
          />
        ))}
      </div>

      <div className="chat-box">
        <h3>Live Transcript</h3>
        {!speechSupported && (
          <p className="muted">Speech recognition works only in Chrome or Edge.</p>
        )}
        <div className="chat-messages">
          {transcript.length === 0 && !hasInterim && (
            <p className="muted">Start speaking...</p>
          )}
          {transcript.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          {Object.entries(remoteInterims).map(([name, t]) => (
            <p key={name} style={interimStyle}>
              {name}: {t}
            </p>
          ))}
          {myInterim && (
            <p style={interimStyle}>
              {myName}: {myInterim}
            </p>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="chat-box">
        <h3>Chat</h3>
        <div className="chat-messages">
          {messages.map((m, i) => (
            <p key={i}>
              <strong>{m.sender}:</strong> {m.message}
            </p>
          ))}
        </div>
        <div className="chat-input-row">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message"
          />
          <button className="btn btn-primary" onClick={sendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingRoom;