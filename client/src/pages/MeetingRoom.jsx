import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "peerjs";
import { useNavigate, useParams, Link } from "react-router-dom";
import api from "../api/axios";
import { isExpired, formatDateTime } from "../meetingTime";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const socket = SERVER_URL ? io(SERVER_URL) : io();

const MAX_PARTICIPANTS = 6;

// How long the controls stay on your video after the last touch
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
.self-controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 28px 8px 8px;
  border-radius: 0 0 var(--radius) var(--radius);
  background: linear-gradient(
    to top,
    rgba(8, 12, 24, 0.92) 0%,
    rgba(8, 12, 24, 0.72) 60%,
    rgba(8, 12, 24, 0) 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 1;
  transition: opacity 0.25s ease;
}
.self-controls.hidden {
  opacity: 0;
  pointer-events: none;
}
.ctl-row {
  display: flex;
  justify-content: center;
  gap: 4px;
  width: 100%;
}
.ctl {
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 0;
  color: #e8ecf5;
  font: inherit;
  cursor: pointer;
}
.ctl-icon {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2f6df6;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.35);
  transition: background 0.15s ease, transform 0.1s ease;
}
.ctl:hover:not(:disabled) .ctl-icon { background: #1f56d8; }
.ctl:active:not(:disabled) .ctl-icon { transform: scale(0.94); }
.ctl:disabled { opacity: 0.45; cursor: not-allowed; }
.ctl-label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
  line-height: 1;
  white-space: nowrap;
}
.ctl.off .ctl-icon { background: #dc2f3f; box-shadow: 0 2px 8px rgba(220, 47, 63, 0.35); }
.ctl.hand-on .ctl-icon { background: #f59e0b; color: #1a1200; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.35); }
.ctl.active .ctl-icon { background: #0ea5e9; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35); }
.react-tray {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px;
  padding: 5px 6px;
  border-radius: 12px;
  background: rgba(19, 26, 43, 0.95);
  border: 1px solid rgba(59, 130, 246, 0.5);
}
.react-emoji {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  border: none;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.react-emoji:hover { background: rgba(59, 130, 246, 0.3); }
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
  filter: drop-shadow(0 4px 12px rgba(59, 130, 246, 0.7));
}
.reaction-name {
  margin-top: 3px;
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(47, 109, 246, 0.92);
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

const ICONS = {
  mic: (
    <>
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </>
  ),
  micOff: (
    <>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </>
  ),
  video: (
    <>
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </>
  ),
  videoOff: (
    <>
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  flip: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </>
  ),
  hand: (
    <>
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </>
  ),
  smile: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </>
  ),
};

function Icon({ name, size = 20 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

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

  // Show the controls on your video, then hide them again after a few seconds
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
        <div
          className={`video-tile ${myHand ? "hand-up" : ""}`}
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") {
              hoverRef.current = true;
              wakeControls();
            }
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
          }}
        >
          <video ref={myVideoRef} muted playsInline autoPlay />
          {!myCameraShown && (
            <div style={avatarStyle}>{myName.charAt(0).toUpperCase()}</div>
          )}
          <span className="name-tag" style={{ top: 12, bottom: "auto" }}>
            {myName} (You)
            {!hasCamera ? " - no camera" : ""}
            {!micOn && <span className="hand-badge">🔇</span>}
            {myHand && <span className="hand-badge">✋</span>}
          </span>

          <div className={`self-controls ${controlsVisible ? "" : "hidden"}`}>
            {showReactions && (
              <div className="react-tray">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="react-emoji"
                    onClick={() => sendReaction(emoji)}
                    aria-label={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            <div className="ctl-row">
              <button
                className={`ctl ${micOn ? "" : "off"}`}
                onClick={toggleMic}
                aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
              >
                <span className="ctl-icon">
                  <Icon name={micOn ? "mic" : "micOff"} />
                </span>
                <span className="ctl-label">{micOn ? "Mute" : "Unmute"}</span>
              </button>
              <button
                className={`ctl ${myCameraShown ? "" : "off"}`}
                onClick={toggleCamera}
                disabled={!hasCamera}
                aria-label={myCameraShown ? "Turn camera off" : "Turn camera on"}
              >
                <span className="ctl-icon">
                  <Icon name={myCameraShown ? "video" : "videoOff"} />
                </span>
                <span className="ctl-label">Video</span>
              </button>
              {canFlip && (
                <button
                  className="ctl"
                  onClick={flipCamera}
                  disabled={flipping}
                  aria-label="Switch between front and back camera"
                >
                  <span className="ctl-icon">
                    <Icon name="flip" />
                  </span>
                  <span className="ctl-label">{flipping ? "Wait" : "Flip"}</span>
                </button>
              )}
              <button
                className={`ctl ${myHand ? "hand-on" : ""}`}
                onClick={toggleHand}
                aria-label={myHand ? "Lower hand" : "Raise hand"}
              >
                <span className="ctl-icon">
                  <Icon name="hand" />
                </span>
                <span className="ctl-label">{myHand ? "Lower" : "Hand"}</span>
              </button>
              <button
                className={`ctl ${showReactions ? "active" : ""}`}
                onClick={() => setShowReactions((v) => !v)}
                aria-label="Send a reaction"
              >
                <span className="ctl-icon">
                  <Icon name="smile" />
                </span>
                <span className="ctl-label">React</span>
              </button>
            </div>
          </div>
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
        Tap your video to show the controls.
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
    </div>
  );
}

export default MeetingRoom;