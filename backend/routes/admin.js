const express = require("express");
const { requireAdminAuth } = require("../middleware/auth");
const Chat = require("../models/Chat");

const router = express.Router();

// Escalation
router.post("/escalate", requireAdminAuth, async (req, res) => {
  const { chatId, reason } = req.body;
  const chat = await Chat.findById(chatId);
  if (chat) {
    chat.messages.push({
      role: "system",
      content: `Escalated: ${reason}`,
      meta: { by: req.user.id },
    });
    await chat.save();
  }
  res.json({ ok: true });
});

module.exports = router;
