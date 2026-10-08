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

  if (error) return <div className="container"><p className="error-text">{error}</p></div>;
  if (!meeting) return <div className="container"><p className="muted">Loading...</p></div>;

  const hasSummary = meeting.summary && meeting.summary.trim() !== "";

  return (
    <div className="container">
      <Link to="/dashboard">← Back to Dashboard</Link>
      <h2 style={{ marginTop: 16 }}>{meeting.title}</h2>

      <div className="summary-card">
        {!hasSummary ? (
          <p className="muted">
            No summary yet. Join this meeting and click End Meeting to generate one.
          </p>
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
                    {item.owner && <span className="owner"> — {item.owner}</span>}
                    {item.dueDate && <span className="due"> (due: {item.dueDate})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No action items.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}