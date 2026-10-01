import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Dashboard() {
  const [meetings, setMeetings] = useState([]);
  const [title, setTitle] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
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

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div>
      <button onClick={handleLogout} style={{ float: "right" }}>
        Logout
      </button>
      <h2>Your Meetings</h2>

      <form onSubmit={handleCreate}>
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
        <button type="submit">Create Meeting</button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
      {meetings.length === 0 && !error && <p>No meetings yet.</p>}
      <ul>
        {meetings.map((meeting) => (
          <li key={meeting._id}>
            {meeting.title} —{" "}
            {new Date(meeting.scheduledTime).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;