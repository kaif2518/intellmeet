import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

export default function MeetingSummary() {
  const { id } = useParams();
  const [meeting, setMeeting] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/meetings/${id}`)
      .then((res) => setMeeting(res.data))
      .catch(() => setError("Could not load meeting."));
  }, [id]);

  if (error) return <p>{error}</p>;
  if (!meeting) return <p>Loading...</p>;

  const hasSummary = meeting.summary && meeting.summary.trim() !== "";

  return (
    <div style={{ maxWidth: 700, margin: "30px auto", textAlign: "left" }}>
      <Link to="/dashboard">← Back to Dashboard</Link>
      <h2>{meeting.title}</h2>

      {!hasSummary ? (
        <p>No summary yet. Join this meeting and click End Meeting to generate one.</p>
      ) : (
        <>
          <h3>Summary</h3>
          <p>{meeting.summary}</p>

          {meeting.keyPoints?.length > 0 && (
            <>
              <h3>Key Points</h3>
              <ul>
                {meeting.keyPoints.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </>
          )}

          {meeting.decisions?.length > 0 && (
            <>
              <h3>Decisions</h3>
              <ul>
                {meeting.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </>
          )}

          <h3>Action Items</h3>
          {meeting.actionItems?.length > 0 ? (
            <ul>
              {meeting.actionItems.map((item) => (
                <li key={item._id}>
                  {item.text}
                  {item.owner && <strong> — {item.owner}</strong>}
                  {item.dueDate && <em> (due: {item.dueDate})</em>}
                </li>
              ))}
            </ul>
          ) : (
            <p>No action items.</p>
          )}
        </>
      )}
    </div>
  );
}