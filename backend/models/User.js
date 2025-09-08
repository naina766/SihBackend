const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String},
    // email:{type: String},
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["farmer", "admin", "officer"],
      default: "farmer",
    },
    district: { type: String }, // New field
    village: { type: String }, // New field
  },
  { timestamps: true }
);

// ================================
// Password hashing before save
// ================================
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// ================================
// Compare Password
// ================================
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
