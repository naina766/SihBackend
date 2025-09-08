// const axios = require("axios");

// const TEST_MODE = process.env.TEST_MODE === "true";
// const LLM_BASE = process.env.LLM_BASE_URL;
// const LLM_KEY = process.env.LLM_API_KEY;
// const LLM_MODEL = process.env.LLM_MODEL || "dhenu2-in-8b-preview";

// function delay(ms) {
//   return new Promise((resolve) => setTimeout(resolve, ms));
// }

// // Async generator → yields token-like strings
// async function* streamLLM(messages) {
//   if (TEST_MODE) {
//     const fake = [
//       "നമസ്കാരം. ",
//       "താങ്കളുടെ പഴത്തിലെ ഇലകളിൽ രോഗലക്ഷണം കണ്ടു. ",
//       "ഒരു സാധാരണ പരിഹാരം: രോഗബാധിത ഇലകൾ വെട്ടി നീക്കം ചെയ്യുക. ",
//       "ശ്രദ്ധിക്കുക: സംരക്ഷണ വസ്ത്രം ധരിക്കുക, മരുന്ന് label പ്രകാരം മാത്രം ഉപയോഗിക്കുക.",
//     ];
//     for (const p of fake) {
//       await delay(300);
//       yield p;
//     }
//     return;
//   }

//   try {
//     const resp = await axios({
//       method: "post",
//       url: `${LLM_BASE}/chat/completions`,
//       headers: {
//         Authorization: `Bearer ${LLM_KEY}`,
//         "Content-Type": "application/json",
//       },
//       data: { model: LLM_MODEL, messages, stream: true },
//       responseType: "stream",
//       timeout: 120000,
//     });

//     for await (const chunk of resp.data) {
//       yield chunk.toString();
//     }
//   } catch (err) {
//     console.error("LLM API error:", err.message || err);
//     throw new Error("llm_failed");
//   }
// }

// module.exports = { streamLLM };
const axios = require("axios");

const TEST_MODE = process.env.TEST_MODE === "true";
const LLM_BASE = process.env.LLM_BASE_URL;
const LLM_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || "dhenu2-in-8b-preview";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Detect language (simple heuristic) ---
function detectLang(text) {
  // crude Malayalam detection → Unicode range 0D00–0D7F
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml";
  // fallback
  return "en";
}

// Async generator → yields token-like strings
async function* streamLLM(messages) {
  if (TEST_MODE) {
    // Fake streaming for testing
    const fake = [
      "നമസ്കാരം. ",
      "താങ്കളുടെ പഴത്തിലെ ഇലകളിൽ രോഗലക്ഷണം കണ്ടു. ",
      "ഒരു സാധാരണ പരിഹാരം: രോഗബാധിത ഇലകൾ വെട്ടി നീക്കം ചെയ്യുക. ",
      "ശ്രദ്ധിക്കുക: സംരക്ഷണ വസ്ത്രം ധരിക്കുക, മരുന്ന് label പ്രകാരം മാത്രം ഉപയോഗിക്കുക.",
    ];
    for (const p of fake) {
      await delay(300);
      yield p;
    }
    return;
  }

  try {
    // Detect user language from last user message
    const userMessage =
      messages.filter((m) => m.role === "user").pop()?.content || "";
    const lang = detectLang(userMessage);

    // Add system instruction → respond in same language
    const sysPrompt = {
      role: "system",
      content:
        lang === "ml"
          ? "ഉപയോക്താവ് ചോദിക്കുന്ന ഭാഷയിൽ തന്നെ മറുപടി നൽകുക (മലയാളം). "
          : "Always reply in the same language as the user input. Default to English if unclear.",
    };

    const resp = await axios({
      method: "post",
      url: `${LLM_BASE}/chat/completions`,
      headers: {
        Authorization: `Bearer ${LLM_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        model: LLM_MODEL,
        messages: [sysPrompt, ...messages],
        stream: true,
      },
      responseType: "stream",
      timeout: 120000,
    });

    let buffer = "";

    for await (const chunk of resp.data) {
      buffer += chunk.toString();

      const parts = buffer.split("\n");
      buffer = parts.pop();

      for (const line of parts) {
        if (!line.trim() || !line.startsWith("data:")) continue;

        const data = line.replace(/^data:\s*/, "");
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) yield token;
        } catch (e) {
          console.error("LLM parse error:", e.message, line);
        }
      }
    }
  } catch (err) {
    console.error("LLM API error:", err.message || err);
    throw new Error("llm_failed");
  }
}

module.exports = { streamLLM };
