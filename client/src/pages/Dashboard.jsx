import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

function Dashboard() {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const fetchMeetings = async () => {
    try {
      const res = await api.get("/meetings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMeetings(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load meetings");
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }
    fetchMeetings();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post(
        "/meetings",
        { title, participants: [], scheduledTime },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTitle("");
      setScheduledTime("");
      fetchMeetings();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create meeting");
    }
  };

  const handleJoinWithLink = (e) => {
    e.preventDefault();
    setError("");
    const value = joinInput.trim();
    const match = value.match(/meeting\/([a-zA-Z0-9]+)/);
    const meetingId = match ? match[1] : value;
    if (!/^[a-f0-9]{24}$/i.test(meetingId)) {
      setError("That does not look like a valid meeting link or ID.");
      return;
    }
    navigate(`/meeting/${meetingId}`);
  };

  const copyInvite = async (meetingId) => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const box = document.createElement("textarea");
      box.value = link;
      document.body.appendChild(box);
      box.select();
      document.execCommand("copy");
      document.body.removeChild(box);
    }
    setCopiedId(meetingId);
    setTimeout(() => setCopiedId(""), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div>
      <div className="navbar">
        <h1 className="brand">IntellMeet</h1>
        <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
      </div>

      <div className="container">
        <h2>Your Meetings</h2>

        <form className="create-form" onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Meeting title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <input
            type="datetime-local"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit">Create Meeting</button>
        </form>

        <h3>Join a meeting</h3>
        <form className="create-form" onSubmit={handleJoinWithLink}>
          <input
            type="text"
            placeholder="Paste an invite link or meeting ID"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            required
          />
          <button className="btn btn-primary" type="submit">Join</button>
        </form>

        {error && <p className="error-text">{error}</p>}
        {meetings.length === 0 && !error && <p className="muted">No meetings yet.</p>}

        <ul className="meeting-list">
          {meetings.map((meeting) => (
            <li className="meeting-card" key={meeting._id}>
              <div>
                <div className="meeting-title">{meeting.title}</div>
                <div className="meeting-time">
                  {new Date(meeting.scheduledTime).toLocaleString()}
                </div>
              </div>
              <div className="meeting-actions" style={{ flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to={`/meeting/${meeting._id}`}>Join</Link>
                <button className="btn btn-ghost" onClick={() => copyInvite(meeting._id)}>
                  {copiedId === meeting._id ? "Link copied!" : "Copy invite link"}
                </button>
                <Link className="btn btn-ghost" to={`/meeting-summary/${meeting._id}`}>View Summary</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default Dashboard;