const TEST_MODE = process.env.TEST_MODE === "true";

// Convert text → audio (Buffer)
async function textToSpeech(text) {
  if (TEST_MODE) {
    return Buffer.from("TTS_MOCK"); // placeholder buffer
  }
  throw new Error("TTS adapter not implemented");
}

module.exports = { textToSpeech };
