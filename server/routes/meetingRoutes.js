const express = require("express");
const router = express.Router();
const Meeting = require("../models/Meeting");
const protect = require("../middleware/authMiddleware");

// CREATE a meeting
router.post("/", protect, async (req, res) => {
  try {
    const { title, participants, scheduledTime } = req.body;

    const meeting = new Meeting({
      title,
      host: req.user.id,
      participants,
      scheduledTime,
    });

    await meeting.save();
    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// LIST all meetings for the logged-in user (as host or participant)
router.get("/", protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({
      $or: [{ host: req.user.id }, { participants: req.user.id }],
    }).sort({ scheduledTime: 1 });

    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET one meeting by id
router.get("/:id", protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE a meeting (only the host can delete it)
router.delete("/:id", protect, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    if (meeting.host.toString() !== req.user.id) {
      return res.status(403).json({ message: "Only the host can delete this meeting" });
    }

    await meeting.deleteOne();
    res.json({ message: "Meeting deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;