/**
 * BroadMind AI Engine — Multi-provider AI for doubt solving
 *
 * Supports: Google Gemini, OpenAI ChatGPT, BroadMind AI, Kimi (Moonshot)
 * Each user can switch providers on-the-fly via /model command.
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
const OpenAI = require("openai");
const Anthropic = require("@anthropic-ai/sdk");
const config = require("./config");
const fs = require("fs");

// ── System Prompt (shared across all providers) ──────────────────────

const SYSTEM_PROMPT = `You are BroadMind AI Doubt Solver — a brilliant, patient tutor who helps students from Class 8 to PhD level across ALL subjects.

RULES:
1. DETECT the language the student is using and REPLY in that SAME language (Tamil, Hindi, Telugu, English, etc.)
2. If the student mixes languages (e.g., Tamil + English), reply in the same mix.
3. Always provide step-by-step solutions.
4. Use analogies that relate to everyday Indian life to explain concepts.
5. For math/physics/chemistry: show the full working with formulas.
6. For coding questions: provide clean, commented code.
7. Keep answers concise but complete — remember this is WhatsApp, not an essay.
8. Use emojis sparingly to make it friendly: ✅ for correct steps, 📝 for notes, 💡 for tips.
9. If a student sends an image of a problem, analyze it carefully and solve it.
10. At the end of each answer, ask a quick follow-up question to check understanding.
11. If you don't know something, say so honestly — never make up answers.

SUBJECTS YOU COVER:
- Mathematics (all levels), Physics, Chemistry, Biology
- Computer Science, Engineering (all branches)
- Medicine, Law, Commerce, Management, Arts
- Competitive exams: JEE, NEET, UPSC, GATE, CAT
- 100+ college disciplines

TONE: Friendly, encouraging, like a smart senior student helping a junior. Never condescending.

FORMAT FOR WHATSAPP:
- Use *bold* for headings and key terms
- Use numbered lists for steps
- Keep paragraphs short (2-3 lines max)
- Use line breaks between sections`;

// ── Provider Clients (lazy-initialized) ──────────────────────────────

let geminiClient = null;
let openaiClient = null;
let claudeClient = null;
let kimiClient = null;

function getGemini() {
  if (!geminiClient && config.gemini.apiKey) {
    geminiClient = new GoogleGenerativeAI(config.gemini.apiKey);
  }
  return geminiClient;
}

function getOpenAI() {
  if (!openaiClient && config.openai.apiKey) {
    openaiClient = new OpenAI.default({ apiKey: config.openai.apiKey });
  }
  return openaiClient;
}

function getClaude() {
  if (!claudeClient && config.claude.apiKey) {
    claudeClient = new Anthropic.default({ apiKey: config.claude.apiKey });
  }
  return claudeClient;
}

function getKimi() {
  if (!kimiClient && config.kimi.apiKey) {
    kimiClient = new OpenAI.default({
      apiKey: config.kimi.apiKey,
      baseURL: config.kimi.baseUrl,
    });
  }
  return kimiClient;
}

// ── Conversation History ─────────────────────────────────────────────

const conversations = new Map(); // userId -> { provider, messages[] }
const MAX_HISTORY = 10;

function getUserState(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, {
      provider: config.defaultProvider,
      messages: [],
    });
  }
  return conversations.get(userId);
}

function addMessage(userId, role, content) {
  const state = getUserState(userId);
  state.messages.push({ role, content });
  if (state.messages.length > MAX_HISTORY * 2) {
    state.messages = state.messages.slice(-MAX_HISTORY * 2);
  }
}

function resetConversation(userId) {
  conversations.delete(userId);
}

function setProvider(userId, provider) {
  const state = getUserState(userId);
  state.provider = provider;
  state.messages = []; // Reset history when switching
}

function getProvider(userId) {
  return getUserState(userId).provider;
}

// ── Provider Availability ────────────────────────────────────────────

const PROVIDER_INFO = {
  gemini: { name: "Google Gemini", emoji: "🟢", model: "gemini-1.5-flash" },
  chatgpt: { name: "ChatGPT (GPT-4o)", emoji: "🟡", model: "gpt-4o-mini" },
  claude: { name: "BroadMind AI", emoji: "🟠", model: "claude-sonnet-4-20250514" },
  kimi: { name: "Kimi (Moonshot)", emoji: "🔵", model: "moonshot-v1-8k" },
};

function getAvailableProviders() {
  const available = [];
  if (config.gemini.apiKey && config.gemini.apiKey !== "your_gemini_api_key_here") available.push("gemini");
  if (config.openai.apiKey && config.openai.apiKey !== "your_openai_api_key_here") available.push("chatgpt");
  if (config.claude.apiKey && config.claude.apiKey !== "your_claude_api_key_here") available.push("claude");
  if (config.kimi.apiKey && config.kimi.apiKey !== "your_kimi_api_key_here") available.push("kimi");
  return available;
}

function getProviderListMessage(userId) {
  const current = getProvider(userId);
  const available = getAvailableProviders();

  let msg = "🤖 *AI Models Available:*\n\n";
  for (const [key, info] of Object.entries(PROVIDER_INFO)) {
    const isAvailable = available.includes(key);
    const isCurrent = current === key;
    const status = isCurrent ? " ✅ (active)" : isAvailable ? "" : " ❌ (no API key)";
    msg += `${info.emoji} *${info.name}*${status}\n`;
    msg += `   Switch: \`/model ${key}\`\n\n`;
  }
  msg += `_Current model: *${PROVIDER_INFO[current]?.name || current}*_`;
  return msg;
}

// ── Gemini Provider ──────────────────────────────────────────────────

async function geminiText(userId, question) {
  const client = getGemini();
  if (!client) throw new Error("Gemini API key not configured");

  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
  const state = getUserState(userId);

  // Convert to Gemini format
  const history = state.messages.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history: history.length > 0 ? history : undefined,
    systemInstruction: SYSTEM_PROMPT,
  });

  const result = await chat.sendMessage(question);
  return result.response.text();
}

async function geminiImage(imagePath, caption) {
  const client = getGemini();
  if (!client) throw new Error("Gemini API key not configured");

  const model = client.getGenerativeModel({ model: "gemini-1.5-flash" });
  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = imagePath.split(".").pop().toLowerCase();
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

  const prompt = caption
    ? `The student sent this image with the message: "${caption}"\n\nAnalyze the image, identify the problem/question, and provide a complete step-by-step solution.`
    : "The student sent this image of a problem. Analyze it carefully, identify what's being asked, and provide a complete step-by-step solution.";

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: mimeMap[ext] || "image/jpeg" } },
  ]);
  return result.response.text();
}

// ── ChatGPT Provider ─────────────────────────────────────────────────

async function chatgptText(userId, question) {
  const client = getOpenAI();
  if (!client) throw new Error("OpenAI API key not configured");

  const state = getUserState(userId);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 2000,
  });

  return result.choices[0].message.content;
}

async function chatgptImage(imagePath, caption) {
  const client = getOpenAI();
  if (!client) throw new Error("OpenAI API key not configured");

  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = imagePath.split(".").pop().toLowerCase();
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

  const prompt = caption
    ? `The student sent this image with the message: "${caption}"\n\nAnalyze the image, identify the problem/question, and provide a complete step-by-step solution.`
    : "The student sent this image of a problem. Analyze it carefully, identify what's being asked, and provide a complete step-by-step solution.";

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeMap[ext] || "image/jpeg"};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 2000,
  });

  return result.choices[0].message.content;
}

// ── BroadMind AI Provider ───────────────────────────────────────────

async function claudeText(userId, question) {
  const client = getClaude();
  if (!client) throw new Error("BroadMind AI API key not configured");

  const state = getUserState(userId);
  const messages = [
    ...state.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const result = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages,
  });

  return result.content[0].text;
}

async function claudeImage(imagePath, caption) {
  const client = getClaude();
  if (!client) throw new Error("BroadMind AI API key not configured");

  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString("base64");
  const ext = imagePath.split(".").pop().toLowerCase();
  const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

  const prompt = caption
    ? `The student sent this image with the message: "${caption}"\n\nAnalyze the image, identify the problem/question, and provide a complete step-by-step solution.`
    : "The student sent this image of a problem. Analyze it carefully, identify what's being asked, and provide a complete step-by-step solution.";

  const result = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeMap[ext] || "image/jpeg", data: base64 } },
          { type: "text", text: prompt },
        ],
      },
    ],
  });

  return result.content[0].text;
}

// ── Kimi Provider (Moonshot — OpenAI-compatible API) ─────────────────

async function kimiText(userId, question) {
  const client = getKimi();
  if (!client) throw new Error("Kimi API key not configured");

  const state = getUserState(userId);
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...state.messages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: question },
  ];

  const result = await client.chat.completions.create({
    model: "moonshot-v1-8k",
    messages,
    max_tokens: 2000,
  });

  return result.choices[0].message.content;
}

async function kimiImage(imagePath, caption) {
  // Kimi doesn't natively support image input in the standard API
  // Fall back to Gemini for image analysis, then pass text to Kimi
  const gemini = getGemini();
  if (gemini) {
    // Use Gemini to read the image, then send extracted text to Kimi
    const extracted = await geminiImage(imagePath, "Extract all text, equations, and describe any diagrams from this image. Be very detailed.");
    return kimiText("system", `The student sent an image of a problem. Here's what was extracted from the image:\n\n${extracted}\n\nStudent's message: ${caption || "(no caption)"}\n\nProvide a complete step-by-step solution.`);
  }
  throw new Error("Kimi doesn't support image input directly. Please type your question instead, or switch to /model gemini for image support.");
}

// ── Unified API ──────────────────────────────────────────────────────

/**
 * Solve a text doubt using the user's active AI provider
 */
async function solveTextDoubt(userId, question) {
  const provider = getProvider(userId);
  const info = PROVIDER_INFO[provider];

  try {
    let response;
    switch (provider) {
      case "gemini":
        response = await geminiText(userId, question);
        break;
      case "chatgpt":
        response = await chatgptText(userId, question);
        break;
      case "claude":
        response = await claudeText(userId, question);
        break;
      case "kimi":
        response = await kimiText(userId, question);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Save to history
    addMessage(userId, "user", question);
    addMessage(userId, "assistant", response);

    return `${info.emoji} _${info.name}_\n\n${response}`;
  } catch (error) {
    console.error(`${provider} text error:`, error.message);

    // Try fallback to another available provider
    const fallback = tryFallback(provider);
    if (fallback) {
      console.log(`⚡ Falling back from ${provider} to ${fallback}`);
      setProvider(userId, fallback);
      return solveTextDoubt(userId, question);
    }

    throw new Error(`Sorry, ${info.name} couldn't process your question. Please try again! 🙏`);
  }
}

/**
 * Solve an image doubt using the user's active AI provider
 */
async function solveImageDoubt(userId, imagePath, caption) {
  const provider = getProvider(userId);
  const info = PROVIDER_INFO[provider];

  try {
    let response;
    switch (provider) {
      case "gemini":
        response = await geminiImage(imagePath, caption);
        break;
      case "chatgpt":
        response = await chatgptImage(imagePath, caption);
        break;
      case "claude":
        response = await claudeImage(imagePath, caption);
        break;
      case "kimi":
        response = await kimiImage(imagePath, caption);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    addMessage(userId, "user", caption || "[Sent an image of a problem]");
    addMessage(userId, "assistant", response);

    // Clean up
    try { fs.unlinkSync(imagePath); } catch {}

    return `${info.emoji} _${info.name}_\n\n${response}`;
  } catch (error) {
    console.error(`${provider} image error:`, error.message);
    try { fs.unlinkSync(imagePath); } catch {}
    throw new Error(`Sorry, ${info.name} couldn't analyze that image. Try /model gemini for best image support! 🙏`);
  }
}

/**
 * Try to find a working fallback provider
 */
function tryFallback(failedProvider) {
  const available = getAvailableProviders();
  return available.find((p) => p !== failedProvider) || null;
}

module.exports = {
  solveTextDoubt,
  solveImageDoubt,
  resetConversation,
  setProvider,
  getProvider,
  getAvailableProviders,
  getProviderListMessage,
  PROVIDER_INFO,
};
