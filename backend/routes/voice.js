const express = require("express");
const multer = require("multer");
const { speechToText } = require("../services/stt");
const { textToSpeech } = require("../services/tts");
const { requireAuth } = require("../middleware/auth");
const Chat = require("../models/Chat");

const router = express.Router();
const upload = multer();

// STT: upload audio -> return text and create chat message
router.post("/stt", requireAuth, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "audio required" });
  try {
    const text = await speechToText(req.file.buffer);
    const chat = await Chat.create({
      user: req.user._id,
      title: `Voice ${Date.now()}`,
    });
    chat.messages.push({
      role: "user",
      content: text,
      modality: "voice",
      lang: req.user.locale,
    });
    await chat.save();
    res.json({ text, chatId: chat._id });
  } catch (err) {
    console.error("stt error", err);
    res.status(500).json({ error: "stt_failed" });
  }
});

// TTS: POST text -> returns audio (mock buffer)
router.post("/tts", requireAuth, express.json(), async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });
  try {
    const audioBuf = await textToSpeech(text);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuf);
  } catch (err) {
    console.error("tts error", err);
    res.status(500).json({ error: "tts_failed" });
  }
});

module.exports = router;
