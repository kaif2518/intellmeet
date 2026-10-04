const express = require("express");
const router = express.Router();
const Meeting = require("../models/Meeting");
const protect = require("../middleware/authMiddleware");
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// SAVE meeting notes (transcript) and generate AI summary
router.post("/:id/summarize", protect, async (req, res) => {
  try {
    const { transcript } = req.body;
    const meeting = await Meeting.findById(req.params.id);

    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    const prompt = `You are given a meeting transcript. Summarize it in 3-5 sentences, and extract clear action items with an owner if mentioned. Respond ONLY in this exact JSON format, with no extra text:
{
  "summary": "string",
  "actionItems": [{ "text": "string", "owner": "string" }]
}

Transcript:
${transcript}`;

    const completion = await groq.chat.completions.create({
      model:"openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
    });

    const raw = completion.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    meeting.transcript = transcript;
    meeting.summary = parsed.summary;
    meeting.actionItems = parsed.actionItems;
    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: "Summarization failed", error: error.message });
  }
});
module.exports = router;