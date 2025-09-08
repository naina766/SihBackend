const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

// ----------------------
// Verify Token Middleware
// ----------------------
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "no_token" });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: "invalid_token" });

    req.user = decoded; // { sub: user._id, role: "farmer/admin/officer" }
    next();
  });
}

// ----------------------
// Role Guards
// ----------------------
function requireFarmerAuth(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== "farmer") {
      return res.status(403).json({ error: "farmer_only" });
    }
    next();
  });
}

function requireAdminAuth(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "admin_only" });
    }
    next();
  });
}

function requireOfficerAuth(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== "officer") {
      return res.status(403).json({ error: "officer_only" });
    }
    next();
  });
}

// ✅ Combined guard → Admin OR Officer
function requireAdminOrOfficerAuth(req, res, next) {
  verifyToken(req, res, () => {
    if (!["admin", "officer"].includes(req.user.role)) {
      return res.status(403).json({ error: "admin_or_officer_only" });
    }
    next();
  });
}

module.exports = {
  verifyToken,
  requireFarmerAuth,
  requireAdminAuth,
  requireOfficerAuth,
  requireAdminOrOfficerAuth,
};
