// const express = require("express");
// const Chat = require("../models/Chat");
// const { requireFarmerAuth, requireAdminAuth } = require("../middleware/auth");
// const { streamLLM } = require("../services/llm");

// const router = express.Router();

// // ===============================
// // Utility → Detect low confidence AI responses
// // ===============================
// function isLowConfidence(response) {
//   const fallbackPatterns = [
//     "i am not sure",
//     "cannot determine",
//     "not confident",
//     "please consult",
//     "sorry",
//   ];
//   return (
//     response.length < 30 || // too short
//     fallbackPatterns.some((p) => response.toLowerCase().includes(p))
//   );
// }

// // ===============================
// // Farmer → Start chat
// // ===============================
// router.post("/send", requireFarmerAuth, async (req, res) => {
//   const { message } = req.body;
//   const chat = await Chat.create({
//     user: req.user.sub,
//     title: `Chat ${Date.now()}`,
//     messages: [{ role: "user", content: message, lang: "ml" }],
//   });
//   res.json({ ok: true, chatId: chat._id });
// });

// // ===============================
// // Farmer → Stream AI response
// // ===============================
// router.get("/stream", requireFarmerAuth, async (req, res) => {
//   const { message, chatId } = req.query;
//   res.setHeader("Content-Type", "text/event-stream");

//   const chat = chatId
//     ? await Chat.findById(chatId)
//     : await Chat.create({ user: req.user.sub });

//   chat.messages.push({ role: "user", content: message });
//   await chat.save();

//   let response = "";
//   for await (const token of streamLLM([{ role: "user", content: message }])) {
//     res.write(`data: ${JSON.stringify({ delta: token })}\n\n`);
//     response += token;
//   }

//   // Save AI response
//   chat.messages.push({ role: "assistant", content: response });

//   // Check for low confidence → Escalate automatically
//   if (isLowConfidence(response)) {
//     chat.messages.push({
//       role: "system",
//       content: "Escalated: AI low confidence",
//       meta: { auto: true },
//     });
//   }

//   await chat.save();

//   res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
//   res.end();
// });

// // ===============================
// // Officer/Admin → Get all escalated chats
// // ===============================
// router.get("/escalated", requireAdminAuth, async (req, res) => {
//   try {
//     const chats = await Chat.find({
//       "messages.role": "system",
//       "messages.content": /Escalated/i,
//     }).populate("user", "name phone");

//     res.json({ ok: true, chats });
//   } catch (err) {
//     console.error("fetch escalated error", err);
//     res.status(500).json({ error: "server_error" });
//   }
// });

// module.exports = router;
const express = require("express");
const Chat = require("../models/Chat");
const {
  requireFarmerAuth,
  requireAdminOrOfficerAuth,
} = require("../middleware/auth");
const { streamLLM } = require("../services/llm");

const router = express.Router();

// ===============================
// Utility → Detect language
// ===============================
function detectLang(text) {
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml"; // Malayalam Unicode
  return "en";
}

// ===============================
// Utility → Detect low confidence AI responses
// ===============================
function isLowConfidence(response) {
  const fallbackPatterns = [
    "i am not sure",
    "cannot determine",
    "not confident",
    "please consult",
    "sorry",
  ];
  return (
    response.length < 30 ||
    fallbackPatterns.some((p) => response.toLowerCase().includes(p))
  );
}

// ===============================
// Farmer → Start chat
// ===============================
router.post("/send", requireFarmerAuth, async (req, res) => {
  const { message } = req.body;
  const lang = detectLang(message);

  const chat = await Chat.create({
    user: req.user.sub,
    title: `Chat ${Date.now()}`,
    messages: [{ role: "user", content: message, lang }],
  });
  res.json({ ok: true, chatId: chat._id });
});

// ===============================
// Farmer → Stream AI response
// ===============================
router.get("/stream", requireFarmerAuth, async (req, res) => {
  const { message, chatId } = req.query;
  const lang = detectLang(message);

  res.setHeader("Content-Type", "text/event-stream");
 res.setHeader("Cache-Control", "no-cache");
 res.setHeader("Connection", "keep-alive");
  const chat = chatId
    ? await Chat.findById(chatId)
    : await Chat.create({ user: req.user.sub });

  chat.messages.push({ role: "user", content: message, lang });
  await chat.save();

  let response = "";
  for await (const token of streamLLM([{ role: "user", content: message }])) {
    res.write(`data: ${JSON.stringify({ delta: token })}\n\n`);
    response += token;
  }

  // Save AI response
  chat.messages.push({ role: "assistant", content: response, lang });

  // Check for low confidence → Escalate automatically
  if (isLowConfidence(response)) {
    chat.messages.push({
      role: "system",
      content: "Escalated: AI low confidence",
      meta: { auto: true },
    });
  }

  await chat.save();

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

// ===============================
// Officer/Admin → Get all escalated chats
// ===============================
router.get("/escalated", requireAdminOrOfficerAuth, async (req, res) => {
  try {
    const chats = await Chat.find({
      "messages.role": "system",
      "messages.content": /Escalated/i,
    }).populate("user", "name phone");

    res.json({ ok: true, chats });
  } catch (err) {
    console.error("fetch escalated error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ===============================
// Officer/Admin → Reply to an escalated chat
// ===============================
router.post("/reply", requireAdminOrOfficerAuth, async (req, res) => {
  const { chatId, reply } = req.body;
  if (!chatId || !reply) {
    return res.status(400).json({ error: "chatId and reply required" });
  }

  try {
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "chat_not_found" });

    const lang = detectLang(reply);

    chat.messages.push({
      role: "officer",
      content: reply,
      lang,
      meta: { by: req.user.sub },
    });

    await chat.save();

    res.json({ ok: true, message: "reply_saved", chat });
  } catch (err) {
    console.error("reply error", err);
    res.status(500).json({ error: "server_error" });
  }
});

module.exports = router;
