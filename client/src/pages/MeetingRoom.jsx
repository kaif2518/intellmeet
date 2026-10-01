import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Peer from "peerjs";

const socket = io("http://localhost:5000");

function MeetingRoom() {
  const { id: roomId } = useParams();
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();
  const localStreamRef = useRef();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

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