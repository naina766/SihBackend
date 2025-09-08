const express = require("express");
const multer = require("multer");
const { diagnoseImage } = require("../services/vision");

const router = express.Router();
const upload = multer();

// POST /api/diagnose
router.post("/diagnose", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }
    const result = await diagnoseImage(req.file.buffer);
    res.json(result);
  } catch (err) {
    console.error("diagnose error:", err);
    res.status(500).json({ error: "Diagnosis failed" });
  }
});

module.exports = router;
