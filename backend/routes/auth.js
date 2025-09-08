const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ================================
// Nodemailer Setup
// ================================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // App Password (not Gmail password!)
  },
});

// ================================
// SEND OTP
// ================================
router.post("/send-otp", async (req, res) => {
  const { email, phone, name, password, role, mode } = req.body;
  if (!email) return res.status(400).json({ error: "email_required" });

  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    if (!req.session.authData) req.session.authData = {};
    req.session.authData[email] = {
      email,
      phone,
      name,
      password,
      role,
      otp,
      mode, // signup or login
      createdAt: Date.now(),
    };

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP is: ${otp}. It will expire in 15 minutes.`,
    });

    console.log("Session before saving OTP:", req.session);
    console.log("Session ID on send-otp:", req.sessionID);

    res.json({ ok: true, message: "otp_sent" });
  } catch (err) {
    console.error("send-otp error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ================================
// FARMER SIGNUP
// ================================
router.post("/farmer/signup", async (req, res) => {
  const { email, otp } = req.body;
  const sessionData = req.session.authData?.[email];
  if (!sessionData) return res.status(400).json({ error: "no_otp_session" });

  const { phone, name, password, otp: storedOtp, createdAt } = sessionData;

  console.log("SessionData at signup:", sessionData);
  console.log("OTP entered:", otp, "Stored OTP:", storedOtp);

  if (storedOtp !== otp) {
    return res.status(401).json({ error: "otp_mismatch" });
  }
  if (Date.now() - createdAt > 15 * 60 * 1000) {
    return res.status(401).json({ error: "otp_expired" });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "user_already_exists" });

    const farmer = await User.create({
      email,
      phone,
      name,
      password, // let schema middleware hash it
      role: "farmer",
    });

    const token = jwt.sign({ sub: farmer._id, role: farmer.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    delete req.session.authData[email];
    if (Object.keys(req.session.authData).length === 0) {
      delete req.session.authData;
    }

    res.json({
      ok: true,
      token,
      user: { id: farmer._id, email, phone, name, role: "farmer" },
    });
  } catch (err) {
    console.error("signup error", err);
    res.status(500).json({ error: err.message });
  }
});

// ================================
// FARMER LOGIN
// ================================
// router.post("/farmer/login", async (req, res) => {
//   const { email, otp } = req.body;
//   const sessionData = req.session.authData?.[email];
//   if (!sessionData) return res.status(400).json({ error: "no_otp_session" });

//   const { password, otp: storedOtp, createdAt } = sessionData;
//   if (storedOtp !== otp || Date.now() - createdAt > 15 * 60 * 1000) {
//     return res.status(401).json({ error: "invalid_or_expired_otp" });
//   }

//   try {
//     const user = await User.findOne({ email, role: "farmer" });
//     if (!user) return res.status(401).json({ error: "farmer_not_found" });

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) return res.status(401).json({ error: "invalid_password" });

//     const token = jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, {
//       expiresIn: "1h",
//     });

//     delete req.session.authData[email];
//     if (Object.keys(req.session.authData).length === 0) {
//       delete req.session.authData;
//     }

//     res.json({
//       ok: true,
//       token,
//       user: {
//         id: user._id,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//       },
//     });
//   } catch (err) {
//     console.error("login error", err);
//     res.status(500).json({ error: "server_error" });
//   }
// });
router.post("/farmer/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email_and_password_required" });
  }

  try {
    const user = await User.findOne({ email, role: "farmer" });
    if (!user) return res.status(401).json({ error: "farmer_not_found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "invalid_password" });

    const token = jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      ok: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "server_error" });
  }
});
// ================================
// FARMER FORGOT PASSWORD
// ================================
router.post("/farmer/forgot-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const sessionData = req.session.authData?.[email];
  if (!sessionData) return res.status(400).json({ error: "no_otp_session" });

  if (
    sessionData.otp !== otp ||
   ( Date.now() - sessionData.createdAt) > 15 * 60 * 1000
  ) {
    return res.status(401).json({ error: "invalid_or_expired_otp" });
  }

  try {
    const user = await User.findOne({ email, role: "farmer" });
    if (!user) return res.status(404).json({ error: "farmer_not_found" });

    user.password = newPassword; // will get hashed in pre-save
    await user.save();

    delete req.session.authData[email];
    if (Object.keys(req.session.authData).length === 0) {
      delete req.session.authData;
    }

    res.json({ ok: true, message: "password_reset_success" });
  } catch (err) {
    console.error("forgot password error", req.body);
    res.status(500).json({ error: err.message });
  }
});

// ================================
// ADMIN SIGNUP
// ================================
router.post("/admin/signup", async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email_and_password_required" });
  }

  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: "user_already_exists" });

    const admin = await User.create({
      name,
      email,
      phone,
      password, // let schema middleware hash it
      role: "admin",
    });

    res.json({
      ok: true,
      user: { id: admin._id, email: admin.email, role: admin.role },
    });
  } catch (err) {
    console.error("admin signup error", err);
    res.status(500).json({ error: "server_error" });
  }
});

// ================================
// ADMIN / OFFICER LOGIN
// ================================
// router.post("/admin/login", async (req, res) => {
//   const { email, otp } = req.body;
//   const sessionData = req.session.authData?.[email];
//   if (!sessionData) return res.status(400).json({ error: "no_otp_session" });

//   const { password, otp: storedOtp, createdAt } = sessionData;
//   if (storedOtp !== otp || Date.now() - createdAt > 15 * 60 * 1000) {
//     return res.status(401).json({ error: "invalid_or_expired_otp" });
//   }

//   try {
//     const user = await User.findOne({
//       email,
//       role: { $in: ["admin", "officer"] },
//     });
//     if (!user) return res.status(401).json({ error: "admin_not_found" });

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) return res.status(401).json({ error: "invalid_password" });

//     const token = jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, {
//       expiresIn: "1h",
//     });

//     delete req.session.authData[email];
//     if (Object.keys(req.session.authData).length === 0) {
//       delete req.session.authData;
//     }

//     res.json({
//       ok: true,
//       token,
//       user: { id: user._id, email: user.email, role: user.role },
//     });
//   } catch (err) {
//     console.error("admin login error", err);
//     res.status(500).json({ error: "server_error" });
//   }
// });

// ================================
// ADMIN / OFFICER LOGIN (no OTP)
// ================================
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email_and_password_required" });
  }

  try {
    const user = await User.findOne({
      email,
      role: { $in: ["admin", "officer"] },
    });
    if (!user) return res.status(401).json({ error: "admin_not_found" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: "invalid_password" });

    const token = jwt.sign({ sub: user._id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({
      ok: true,
      token,
      user: { id: user._id, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("admin login error", err);
    res.status(500).json({ error: "server_error" });
  }
});
module.exports = router;
