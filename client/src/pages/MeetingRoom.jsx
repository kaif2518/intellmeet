import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "peerjs";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { isExpired, formatDateTime } from "../meetingTime";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const socket = SERVER_URL ? io(SERVER_URL) : io();

const MAX_PARTICIPANTS = 6;

// How long the floating controls stay on screen after the last touch
const CONTROLS_HIDE_MS = 3000;

// Keep this list the same as ALLOWED_REACTIONS in server/index.js
const REACTION_EMOJIS = ["👍", "💙", "👏", "🎉", "😂", "😮", "🔥"];

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

const ROOM_CSS = `
.controls-bar {
  position: fixed;
  left: 50%;
  bottom: 14px;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 20px);
  opacity: 1;
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.controls-bar.hidden {
  opacity: 0;
  visibility: hidden;
  transform: translateX(-50%) translateY(20px);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s ease, visibility 0s linear 0.25s;
}
.controls-inner,
.reaction-tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(19, 26, 43, 0.92);
  border: 1px solid rgba(99, 102, 241, 0.55);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.12);
  backdrop-filter: blur(10px);
}
.reaction-tray { gap: 6px; padding: 8px 10px; }
.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 62px;
  padding: 8px 6px;
  border-radius: 12px;
  border: 1px solid rgba(99, 102, 241, 0.45);
  background: rgba(99, 102, 241, 0.18);
  color: var(--text);
  cursor: pointer;
  font: inherit;
}
.ctrl-btn:hover:not(:disabled) { background: rgba(99, 102, 241, 0.35); }
.ctrl-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ctrl-btn.off { background: rgba(239, 68, 68, 0.22); border-color: rgba(239, 68, 68, 0.6); }
.ctrl-btn.hand-on { background: rgba(245, 158, 11, 0.3); border-color: #fbbf24; }
.ctrl-btn.active { background: rgba(56, 189, 248, 0.28); border-color: #38bdf8; }
.ctrl-icon { font-size: 22px; line-height: 1; }
.ctrl-label { font-size: 11px; font-weight: 600; }
.emoji-btn {
  width: 44px;
  height: 44px;
  font-size: 26px;
  line-height: 1;
  border-radius: 12px;
  border: 1px solid rgba(56, 189, 248, 0.35);
  background: rgba(56, 189, 248, 0.12);
  cursor: pointer;
}
.emoji-btn:hover { background: rgba(56, 189, 248, 0.3); transform: scale(1.1); }
.reaction-layer {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 45;
  overflow: hidden;
}
.reaction-float {
  position: absolute;
  bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: reactionRise 3s ease-out forwards;
}
.reaction-emoji {
  font-size: 40px;
  line-height: 1;
  filter: drop-shadow(0 4px 12px rgba(99, 102, 241, 0.7));
}
.reaction-name {
  margin-top: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.9);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}
@keyframes reactionRise {
  0% { transform: translateY(0) scale(0.6); opacity: 0; }
  12% { transform: translateY(-20px) scale(1.15); opacity: 1; }
  100% { transform: translateY(-55vh) scale(1); opacity: 0; }
}
`;

const avatarStyle = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 56,
  fontWeight: 700,
  color: "var(--accent)",
  pointerEvents: "none",
};

function RemoteVideo({ stream, name, handUp, camOn, micOn }) {
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
      {!camOn && (
        <div style={avatarStyle}>{(name || "?").charAt(0).toUpperCase()}</div>
      )}
      <span className="name-tag">
        {name}
        {!micOn && <span className="hand-badge">🔇</span>}
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
  const facingRef = useRef("user");
  const transcriptEndRef = useRef();
  const lastInterimSent = useRef(0);
  const hideTimerRef = useRef(null);
  const hoverRef = useRef(false);
  const lastWake = useRef(0);
  const reactionIdRef = useRef(0);
  const lastReactionSent = useRef(0);

  const myName = JSON.parse(localStorage.getItem("user") || "{}").name || "Guest";

  const [meetingInfo, setMeetingInfo] = useState({
    status: "checking",
    scheduledTime: null,
  });
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [remotes, setRemotes] = useState({});
  const [handsUp, setHandsUp] = useState({});
  const [mediaStates, setMediaStates] = useState({});
  const [myHand, setMyHand] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [hasCamera, setHasCamera] = useState(true);
  const [canFlip, setCanFlip] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showReactions, setShowReactions] = useState(false);
  const [floating, setFloating] = useState([]);
  const [roomFull, setRoomFull] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [myInterim, setMyInterim] = useState("");
  const [remoteInterims, setRemoteInterims] = useState({});
  const [speechSupported, setSpeechSupported] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const [mediaHint, setMediaHint] = useState(false);
  const [notes, setNotes] = useState("");
  const [showEnd, setShowEnd] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [error, setError] = useState("");

  const meetingOk = meetingInfo.status === "ok";
  const remoteList = Object.entries(remotes);
  const raisedNames = [
    ...(myHand ? [`${myName} (You)`] : []),
    ...remoteList.filter(([id]) => handsUp[id]).map(([, r]) => r.name),
  ];
  const myCameraShown = hasCamera && camOn;

  // Show the floating controls, then hide them again after a few seconds
  const scheduleHide = () => {
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (hoverRef.current) {
        scheduleHide();
        return;
      }
      setControlsVisible(false);
      setShowReactions(false);
    }, CONTROLS_HIDE_MS);
  };

  const wakeControls = () => {
    lastWake.current = Date.now();
    setControlsVisible(true);
    scheduleHide();
  };

  const handlePointerMove = () => {
    if (Date.now() - lastWake.current > 500) wakeControls();
  };

  // Float an emoji up the screen
  const addFloating = (name, emoji) => {
    reactionIdRef.current += 1;
    const id = reactionIdRef.current;
    const left = 10 + Math.random() * 75;
    setFloating((prev) => [...prev.slice(-19), { id, name, emoji, left }]);
    setTimeout(() => {
      setFloating((prev) => prev.filter((r) => r.id !== id));
    }, 3200);
  };

  const sendReaction = (emoji) => {
    const now = Date.now();
    if (now - lastReactionSent.current < 250) return;
    lastReactionSent.current = now;
    socket.emit("reaction", { roomId, emoji });
    addFloating("You", emoji);
  };

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

  // Turn your own microphone on or off
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !micOn;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = next;
    });
    setMicOn(next);
    if (!next) {
      setMyInterim("");
      socket.emit("transcript-interim", { roomId, name: myName, text: "" });
    }
    socket.emit("media-state", { roomId, camOn: hasCamera && camOn, micOn: next });
  };

  // Turn your own camera on or off
  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream || !hasCamera) return;
    const next = !camOn;
    stream.getVideoTracks().forEach((t) => {
      t.enabled = next;
    });
    setCamOn(next);
    socket.emit("media-state", { roomId, camOn: next, micOn });
  };

  // Switch between the front and back camera (phones)
  const flipCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream || flipping) return;
    const oldTrack = stream.getVideoTracks()[0];
    if (!oldTrack) return;

    const nextFacing = facingRef.current === "user" ? "environment" : "user";
    setFlipping(true);
    setMediaError("");

    const swapTrack = (newTrack) => {
      newTrack.enabled = camOn;
      stream.getVideoTracks().forEach((t) => stream.removeTrack(t));
      stream.addTrack(newTrack);
      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(() => {});
      }
      Object.values(callsRef.current).forEach((call) => {
        const sender = call.peerConnection
          ?.getSenders()
          .find((s) => s.track && s.track.kind === "video");
        if (sender) sender.replaceTrack(newTrack).catch(() => {});
      });
    };

    try {
      // Some phones cannot open two cameras at once, so release the old one first
      oldTrack.stop();
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacing } },
      });
      swapTrack(next.getVideoTracks()[0]);
      facingRef.current = nextFacing;
    } catch (e) {
      try {
        const back = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingRef.current } },
        });
        swapTrack(back.getVideoTracks()[0]);
      } catch (e2) {
        /* could not restore the old camera */
      }
      setMediaError("Could not switch the camera on this device.");
    }
    setFlipping(false);
  };

  // Show the controls when the meeting opens, and clean up the timer on exit
  useEffect(() => {
    if (meetingOk) wakeControls();
    return () => clearTimeout(hideTimerRef.current);
  }, [meetingOk]);

  // Check that the meeting exists and has not ended, before opening the camera
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    let active = true;
    setMeetingInfo({ status: "checking", scheduledTime: null });

    api
      .get(`/meeting-status/${roomId}`)
      .then((res) => {
        if (!active) return;
        const { status, scheduledTime } = res.data;
        if (status === "ok" && scheduledTime && isExpired(scheduledTime)) {
          setMeetingInfo({ status: "expired", scheduledTime });
        } else {
          setMeetingInfo({ status, scheduledTime: scheduledTime || null });
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 401) {
          navigate("/login");
          return;
        }
        setMeetingInfo({ status: "error", scheduledTime: null });
      });

    return () => {
      active = false;
    };
  }, [roomId]);

  // Video call (everyone connects to everyone) and chat
  useEffect(() => {
    if (!meetingOk) return;
    if (!localStorage.getItem("token")) {
      navigate("/login");
      return;
    }

    let active = true;
    setMyHand(false);
    setMicOn(true);
    setCamOn(true);
    setRoomFull(false);
    facingRef.current = "user";

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
      setMediaStates((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    };

    const tryJoin = () => {
      if (!active || joined || !peerId || !localStreamRef.current) return;
      joined = true;
      const hasVideo = localStreamRef.current.getVideoTracks().length > 0;
      socket.emit("join-room", {
        roomId,
        peerId,
        name: myName,
        camOn: hasVideo,
        micOn: true,
      });
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
        const hasVideo = stream.getVideoTracks().length > 0;
        setHasCamera(hasVideo);
        setCamOn(hasVideo);
        localStreamRef.current = stream;
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
          myVideoRef.current.play().catch(() => {});
        }
        // Show the flip button only when the device has two or more cameras
        if (hasVideo && navigator.mediaDevices.enumerateDevices) {
          navigator.mediaDevices
            .enumerateDevices()
            .then((devices) => {
              if (!active) return;
              const cameras = devices.filter((d) => d.kind === "videoinput");
              setCanFlip(cameras.length > 1);
            })
            .catch(() => {});
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
      setMediaStates((prev) => {
        const next = { ...prev };
        users.forEach((u) => {
          next[u.peerId] = {
            camOn: u.camOn !== false,
            micOn: u.micOn !== false,
          };
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
    const handleUserJoined = ({
      peerId: otherId,
      name,
      camOn: theirCam,
      micOn: theirMic,
    }) => {
      if (!active) return;
      addRemote(otherId, name, null);
      setMediaStates((prev) => ({
        ...prev,
        [otherId]: { camOn: theirCam !== false, micOn: theirMic !== false },
      }));
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

    const handleMediaChanged = ({ peerId: otherId, camOn: theirCam, micOn: theirMic }) => {
      setMediaStates((prev) => ({
        ...prev,
        [otherId]: { camOn: theirCam !== false, micOn: theirMic !== false },
      }));
    };

    // Someone else sent a reaction
    const handleReaction = ({ name, emoji }) => {
      if (!active) return;
      if (!REACTION_EMOJIS.includes(emoji)) return;
      addFloating(name || "Guest", emoji);
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

    // The server says this meeting has ended or does not exist
    const handleRoomClosed = ({ reason }) => {
      if (!active) return;
      setMeetingInfo((prev) => ({
        ...prev,
        status:
          reason === "expired"
            ? "expired"
            : reason === "not-found"
            ? "not-found"
            : "error",
      }));
    };

    const handleReceiveMessage = ({ message, sender }) => {
      setMessages((prev) => [...prev, { message, sender }]);
    };

    socket.on("room-users", handleRoomUsers);
    socket.on("user-joined", handleUserJoined);
    socket.on("user-left", handleUserLeft);
    socket.on("hand-changed", handleHandChanged);
    socket.on("media-changed", handleMediaChanged);
    socket.on("reaction", handleReaction);
    socket.on("room-full", handleRoomFull);
    socket.on("room-closed", handleRoomClosed);
    socket.on("receive-message", handleReceiveMessage);

    return () => {
      active = false;
      clearTimeout(hintTimer);
      socket.emit("leave-room");
      socket.off("room-users", handleRoomUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("user-left", handleUserLeft);
      socket.off("hand-changed", handleHandChanged);
      socket.off("media-changed", handleMediaChanged);
      socket.off("reaction", handleReaction);
      socket.off("room-full", handleRoomFull);
      socket.off("room-closed", handleRoomClosed);
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
      setRemotes({});
      setHandsUp({});
      setMediaStates({});
      setFloating([]);
    };
  }, [roomId, meetingOk]);

  // Receive other people's transcript lines (works even while you are muted)
  useEffect(() => {
    if (!meetingOk) return;

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
      socket.off("transcript-line", handleLine);
      socket.off("transcript-interim", handleInterim);
    };
  }, [roomId, meetingOk]);

  // Your own live transcript (speech recognition), only while your mic is on
  useEffect(() => {
    if (!meetingOk || roomFull || !micOn) return;
    if (!localStorage.getItem("token")) return;

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

    return () => {
      active = false;
      recognition.stop();
    };
  }, [roomId, roomFull, meetingOk, micOn]);

  // Keep the transcript scrolled to the newest line
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [transcript, myInterim, remoteInterims]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("send-message", { roomId, message: text, sender: myName });
    setText("");
  };

  if (meetingInfo.status === "checking") {
    return (
      <div className="container">
        <p className="muted">Checking the meeting...</p>
      </div>
    );
  }

  if (meetingInfo.status === "expired") {
    return (
      <div className="container">
        <div className="summary-card" style={{ textAlign: "center" }}>
          <h2>This meeting has ended</h2>
          <p className="muted">
            It was scheduled for {formatDateTime(meetingInfo.scheduledTime)} and
            can no longer be joined. Create a new meeting from the dashboard.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link className="btn btn-primary" to="/dashboard">
              Back to Dashboard
            </Link>
            <Link className="btn btn-ghost" to={`/meeting-summary/${roomId}`}>
              View Summary
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (meetingInfo.status === "not-found" || meetingInfo.status === "error") {
    return (
      <div className="container">
        <div className="summary-card" style={{ textAlign: "center" }}>
          <h2>
            {meetingInfo.status === "not-found"
              ? "Meeting not found"
              : "Could not check this meeting"}
          </h2>
          <p className="muted">
            {meetingInfo.status === "not-found"
              ? "This link does not match any meeting. Check the link or create a new meeting."
              : "The server did not answer. Wait a few seconds, then refresh the page."}
          </p>
          <Link className="btn btn-primary" to="/dashboard">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (roomFull) {
    return (
      <div className="container">
        <div className="summary-card" style={{ textAlign: "center" }}>
          <h2>This meeting is full</h2>
          <p className="muted">
            A meeting can have up to {MAX_PARTICIPANTS} people. Try again when
            someone leaves.
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
    <div
      className="container"
      style={{ paddingBottom: 140 }}
      onPointerDown={wakeControls}
      onPointerMove={handlePointerMove}
    >
      <style>{ROOM_CSS}</style>

      <div className="room-header">
        <div>
          <h2>Meeting Room</h2>
          <span className="muted">
            {remoteList.length + 1} of {MAX_PARTICIPANTS} people in this meeting
          </span>
        </div>
        <div className="room-actions">
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
          {!myCameraShown && (
            <div style={avatarStyle}>{myName.charAt(0).toUpperCase()}</div>
          )}
          <span className="name-tag">
            {myName} (You)
            {!hasCamera ? " - no camera" : ""}
            {!micOn && <span className="hand-badge">🔇</span>}
            {myHand && <span className="hand-badge">✋</span>}
          </span>
        </div>
        {remoteList.map(([id, remote]) => (
          <RemoteVideo
            key={id}
            stream={remote.stream}
            name={remote.name}
            handUp={!!handsUp[id]}
            camOn={mediaStates[id]?.camOn !== false}
            micOn={mediaStates[id]?.micOn !== false}
          />
        ))}
      </div>

      <p
        className="muted"
        style={{ textAlign: "center", fontSize: 13, marginTop: 12 }}
      >
        Tap the screen to show the controls.
      </p>

      <div className="chat-box">
        <h3>Live Transcript</h3>
        {!speechSupported && (
          <p className="muted">Speech recognition works only in Chrome or Edge.</p>
        )}
        {!micOn && (
          <p className="muted">
            Your microphone is muted, so your own speech is not being transcribed.
          </p>
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

      <div className="reaction-layer" aria-hidden="true">
        {floating.map((r) => (
          <div
            key={r.id}
            className="reaction-float"
            style={{ left: `${r.left}%` }}
          >
            <span className="reaction-emoji">{r.emoji}</span>
            <span className="reaction-name">{r.name}</span>
          </div>
        ))}
      </div>

      <div
        className={`controls-bar ${controlsVisible ? "" : "hidden"}`}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hoverRef.current = true;
        }}
        onPointerLeave={() => {
          hoverRef.current = false;
        }}
      >
        {showReactions && (
          <div className="reaction-tray">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="emoji-btn"
                onClick={() => sendReaction(emoji)}
                aria-label={`Send ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
        <div className="controls-inner">
          <button
            className={`ctrl-btn ${micOn ? "" : "off"}`}
            onClick={toggleMic}
          >
            <span className="ctrl-icon">{micOn ? "🎤" : "🔇"}</span>
            <span className="ctrl-label">{micOn ? "Mute" : "Unmute"}</span>
          </button>
          <button
            className={`ctrl-btn ${myCameraShown ? "" : "off"}`}
            onClick={toggleCamera}
            disabled={!hasCamera}
          >
            <span className="ctrl-icon">{myCameraShown ? "📷" : "🚫"}</span>
            <span className="ctrl-label">
              {myCameraShown ? "Camera off" : "Camera on"}
            </span>
          </button>
          {canFlip && (
            <button
              className="ctrl-btn"
              onClick={flipCamera}
              disabled={flipping}
            >
              <span className="ctrl-icon">🔄</span>
              <span className="ctrl-label">{flipping ? "Wait..." : "Flip"}</span>
            </button>
          )}
          <button
            className={`ctrl-btn ${myHand ? "hand-on" : ""}`}
            onClick={toggleHand}
          >
            <span className="ctrl-icon">✋</span>
            <span className="ctrl-label">{myHand ? "Lower" : "Raise"}</span>
          </button>
          <button
            className={`ctrl-btn ${showReactions ? "active" : ""}`}
            onClick={() => setShowReactions((v) => !v)}
          >
            <span className="ctrl-icon">😊</span>
            <span className="ctrl-label">React</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingRoom;