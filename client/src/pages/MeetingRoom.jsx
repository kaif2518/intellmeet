import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Peer from "peerjs";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axios"; // your axios instance (adjust if it's a named export)
const socket = io("http://localhost:5000");

function MeetingRoom() {
  const { id: roomId } = useParams();
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();
  const localStreamRef = useRef();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
const navigate = useNavigate();
const [notes, setNotes] = useState("");
const [showEnd, setShowEnd] = useState(false);
const [summarizing, setSummarizing] = useState(false);
const [error, setError] = useState("");

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
  useEffect(() => {
    let active = true;
    const peer = new Peer();

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        myVideoRef.current.srcObject = stream;
        myVideoRef.current.play().catch(() => {});

        peer.on("call", (call) => {
          call.answer(stream);
          call.on("stream", (remoteStream) => {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(() => {});
          });
        });
      });

    peer.on("open", (peerId) => {
      if (!active) return;
      socket.emit("join-room", { roomId, peerId });
    });

    const handleUserJoined = (remotePeerId) => {
      if (!active || !localStreamRef.current) return;
      const call = peer.call(remotePeerId, localStreamRef.current);
      if (!call) return;
      call.on("stream", (remoteStream) => {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      });
    };
    socket.on("user-joined", handleUserJoined);

    const handleReceiveMessage = ({ message, sender }) => {
      setMessages((prev) => [...prev, { message, sender }]);
    };
    socket.on("receive-message", handleReceiveMessage);

    return () => {
      active = false;
      socket.off("user-joined", handleUserJoined);
      socket.off("receive-message", handleReceiveMessage);
      peer.destroy();
    };
  }, [roomId]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("send-message", { roomId, message: text, sender: "You" });
    setText("");
  };

  return (
    <div>
      <button onClick={() => setShowEnd(true)} style={{ background: "crimson", color: "white" }}>
  End Meeting
</button>

{showEnd && (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ background: "#fff", color: "#000", padding: 20, borderRadius: 8, width: 420 }}>
      <h3>End meeting</h3>
      <p>Paste or type the meeting notes / transcript:</p>
      <textarea rows={8} style={{ width: "100%" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <button onClick={handleEndMeeting} disabled={summarizing}>
          {summarizing ? "Summarizing..." : "Generate Summary"}
        </button>
        <button onClick={() => setShowEnd(false)} disabled={summarizing}>Cancel</button>
      </div>
    </div>
  </div>
)}
      <h2>Meeting Room</h2>
      <div style={{ display: "flex", gap: "10px" }}>
        <video ref={myVideoRef} muted style={{ width: "300px" }} />
        <video ref={remoteVideoRef} style={{ width: "300px" }} />
      </div>

      <div style={{ marginTop: "20px" }}>
        <h3>Chat</h3>
        <div style={{ border: "1px solid gray", height: "150px", overflowY: "auto" }}>
          {messages.map((m, i) => (
            <p key={i}>
              <strong>{m.sender}:</strong> {m.message}
            </p>
          ))}
        </div>
        <input value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
}

export default MeetingRoom;