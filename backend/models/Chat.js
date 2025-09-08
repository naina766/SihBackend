const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ["user", "assistant", "system"],
    default: "user",
  },
  content: String,
  lang: String,
  modality: { type: String, enum: ["text", "voice", "image"], default: "text" },
  meta: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now },
});

const chatSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    title: String,
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
