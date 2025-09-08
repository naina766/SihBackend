const express = require("express");
const multer = require("multer");
const { diagnoseImage } = require("../services/vision");
const { requireAuth } = require("../middleware/auth");
const Chat = require("../models/Chat");

const router = express.Router();
const upload = multer();

router.post(
  "/diagnose",
  requireAuth,
  upload.single("image"),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "image required" });
    try {
      const diag = await diagnoseImage(req.file.buffer);
      // attach to a new chat for simplicity
      const chat = await Chat.create({
        user: req.user._id,
        title: `Image ${Date.now()}`,
      });
      chat.messages.push({
        role: "user",
        content: "[image uploaded]",
        modality: "image",
        meta: { diagnosis: diag },
      });
      await chat.save();
      res.json({ diagnosis: diag, chatId: chat._id });
    } catch (err) {
      console.error("vision error", err);
      res.status(500).json({ error: "vision_failed" });
    }
  }
);

module.exports = router;
