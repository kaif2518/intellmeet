import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import MeetingRoom from "./pages/MeetingRoom";
import MeetingSummary from "./pages/MeetingSummary";
import Splash from "./Splash";

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return !sessionStorage.getItem("introSeen");
    } catch (e) {
      return true;
    }
  });

  const finishIntro = () => {
    try {
      sessionStorage.setItem("introSeen", "1");
    } catch (e) {
      /* storage not available */
    }
    setShowSplash(false);
  };

  if (showSplash) {
    return <Splash onDone={finishIntro} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meeting/:id" element={<MeetingRoom />} />
        <Route path="/meeting-summary/:id" element={<MeetingSummary />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;