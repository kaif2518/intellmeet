const mongoose = require("mongoose");

const meetingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    host: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    scheduledTime: {
      type: Date,
      required: true,
    },
    transcript: {
      type: String,
      default: "",
    },
    summary: {
  type: String,
  default: "",
},
keyPoints: [String],
decisions: [String],
actionItems: [
  {
    text: String,
    owner: String,
    dueDate: String,
  },
],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Meeting", meetingSchema);