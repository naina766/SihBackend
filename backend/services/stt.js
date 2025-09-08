const TEST_MODE = process.env.TEST_MODE === "true";

// Convert audio → text
async function speechToText(buffer) {
  if (TEST_MODE) {
    return "നമസ്കാരം, എന്റെ പഴത്തിൽ രോഗം വന്നിട്ടുണ്ട്, എന്ത് ചെയ്യണം?";
  }
  throw new Error("STT adapter not implemented");
}

module.exports = { speechToText };
