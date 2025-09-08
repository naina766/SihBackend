const TEST_MODE = process.env.TEST_MODE === "true";

async function diagnoseImage(buffer) {
  if (TEST_MODE) {
    return {
      label: "banana leaf spot (sigatoka)",
      confidence: 0.78,
      advice: "Prune infected leaves; apply registered fungicide.",
    };
  }
  // Replace with real API call to your vision model / service.
  throw new Error("Vision adapter not implemented for production");
}

module.exports = { diagnoseImage };
