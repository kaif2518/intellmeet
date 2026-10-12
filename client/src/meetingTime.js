// A meeting can be joined until this many minutes after its scheduled start.
// Keep this the same as MEETING_WINDOW_MINUTES in server/index.js
export const MEETING_WINDOW_MINUTES = 120;

export const isExpired = (scheduledTime, now = Date.now()) =>
  now > new Date(scheduledTime).getTime() + MEETING_WINDOW_MINUTES * 60 * 1000;

export const hasStarted = (scheduledTime, now = Date.now()) =>
  now >= new Date(scheduledTime).getTime();

// Example: 12/10/2026, 9:55 AM  (day/month/year)
export const formatDateTime = (value) => {
  const d = new Date(value);
  const date = d.toLocaleDateString("en-GB");
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date}, ${time}`;
};