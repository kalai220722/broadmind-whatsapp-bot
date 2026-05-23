const twilio = require("twilio");
const config = require("./config");
const {
  solveTextDoubt,
  solveImageDoubt,
  resetConversation,
  setProvider,
  getProvider,
  getAvailableProviders,
  getProviderListMessage,
  PROVIDER_INFO,
} = require("./ai-engine");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Initialize Twilio client (lazy — warns if credentials are missing)
let client;
if (config.twilio.accountSid && config.twilio.accountSid.startsWith("AC")) {
  client = twilio(config.twilio.accountSid, config.twilio.authToken);
} else {
  console.warn("⚠️  Twilio credentials not configured. Add them to .env to enable WhatsApp messaging.");
  client = null;
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Send a WhatsApp message reply
 */
async function sendReply(to, body) {
  if (!client) {
    console.log(`📤 [DRY RUN] Reply to ${to}:\n${body}\n`);
    return;
  }

  // WhatsApp has a 1600 character limit per message
  // Split long messages into chunks
  const MAX_LENGTH = 1500;

  if (body.length <= MAX_LENGTH) {
    await client.messages.create({
      body,
      from: config.twilio.whatsappNumber,
      to,
    });
    return;
  }

  // Split into chunks at natural break points
  const chunks = splitMessage(body, MAX_LENGTH);
  for (const chunk of chunks) {
    await client.messages.create({
      body: chunk,
      from: config.twilio.whatsappNumber,
      to,
    });
    // Small delay between messages to maintain order
    await new Promise((r) => setTimeout(r, 500));
  }
}

/**
 * Split a long message into chunks at natural break points
 */
function splitMessage(text, maxLength) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // Try to split at a double newline (paragraph break)
    let splitIndex = remaining.lastIndexOf("\n\n", maxLength);

    // If no paragraph break, try single newline
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remaining.lastIndexOf("\n", maxLength);
    }

    // If no newline, split at last space
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }

    // Worst case, hard split
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Download media from Twilio (image sent by student)
 */
async function downloadMedia(mediaUrl, mediaContentType) {
  const ext = mediaContentType.includes("png") ? "png" : mediaContentType.includes("webp") ? "webp" : "jpg";
  const filename = `doubt_${Date.now()}.${ext}`;
  const filepath = path.join(uploadsDir, filename);

  return new Promise((resolve, reject) => {
    // Twilio media URLs require authentication
    const authUrl = mediaUrl.replace("https://", `https://${config.twilio.accountSid}:${config.twilio.authToken}@`);

    const handler = (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const proto = response.headers.location.startsWith("https") ? https : http;
        proto.get(response.headers.location, handler).on("error", reject);
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve(filepath);
      });
    };

    https.get(authUrl, handler).on("error", reject);
  });
}

/**
 * Handle incoming WhatsApp message
 */
async function handleIncomingMessage(req, res) {
  const { Body: body, From: from, NumMedia: numMedia, MediaUrl0, MediaContentType0 } = req.body;

  const userId = from; // Use phone number as user ID
  const messageText = (body || "").trim();

  console.log(`📩 Message from ${from}: ${messageText || "[media]"}`);

  // Send immediate TwiML response to acknowledge
  const twiml = new twilio.twiml.MessagingResponse();
  res.type("text/xml").send(twiml.toString());

  try {
    // Handle special commands
    if (messageText.toLowerCase() === "/start" || messageText.toLowerCase() === "hi" || messageText.toLowerCase() === "hello") {
      await sendReply(from, getWelcomeMessage());
      return;
    }

    if (messageText.toLowerCase() === "/reset") {
      resetConversation(userId);
      await sendReply(from, "🔄 Conversation reset! Ask me a new question.");
      return;
    }

    if (messageText.toLowerCase() === "/help") {
      await sendReply(from, getHelpMessage());
      return;
    }

    // /models — List available AI models
    if (messageText.toLowerCase() === "/models") {
      await sendReply(from, getProviderListMessage(userId));
      return;
    }

    // /model <provider> — Switch AI model
    if (messageText.toLowerCase().startsWith("/model ")) {
      const requested = messageText.substring(7).trim().toLowerCase();
      const available = getAvailableProviders();
      const validProviders = Object.keys(PROVIDER_INFO);

      if (!validProviders.includes(requested)) {
        await sendReply(from, `❌ Unknown model: *${requested}*\n\nAvailable: ${validProviders.join(", ")}\nUse /models to see all options.`);
        return;
      }

      if (!available.includes(requested)) {
        await sendReply(from, `❌ *${PROVIDER_INFO[requested].name}* is not configured (no API key).\n\nUse /models to see available models.`);
        return;
      }

      setProvider(userId, requested);
      const info = PROVIDER_INFO[requested];
      await sendReply(from, `${info.emoji} Switched to *${info.name}*! ✅\n\nYour conversation history has been reset. Ask me anything!`);
      return;
    }

    // Handle image messages (student sent a photo of a problem)
    if (parseInt(numMedia) > 0 && MediaUrl0) {
      await sendReply(from, "📷 Got your image! Analyzing the problem... ⏳");

      const imagePath = await downloadMedia(MediaUrl0, MediaContentType0 || "image/jpeg");
      const answer = await solveImageDoubt(userId, imagePath, messageText);
      await sendReply(from, answer);
      return;
    }

    // Handle text questions
    if (messageText) {
      await sendReply(from, "🧠 Thinking... ⏳");

      const answer = await solveTextDoubt(userId, messageText);
      await sendReply(from, answer);
      return;
    }

    // Empty message
    await sendReply(from, "Please send me a question (text or photo) and I'll solve it! 📝");

  } catch (error) {
    console.error("Error handling message:", error.message);
    await sendReply(from, error.message || "Something went wrong. Please try again! 🙏");
  }
}

/**
 * Welcome message for new users
 */
function getWelcomeMessage() {
  return `🎓 *Welcome to BroadMind AI Doubt Solver!*

I'm your AI tutor — available 24/7 to solve any academic doubt.

📝 *What I can do:*
• Solve math, physics, chemistry problems step-by-step
• Help with coding questions in any language
• Answer questions across 100+ subjects
• Analyze photos of handwritten/printed problems
• Reply in Tamil, Hindi, Telugu, English & more
• Switch between multiple AI models on-the-fly

💡 *How to use:*
1. Just type your question
2. Or snap a photo of a problem and send it
3. I'll reply in YOUR language automatically!

🤖 *AI Models:*
🟢 Google Gemini  |  🟡 ChatGPT  |  🟠 BroadMind AI  |  🔵 Kimi

🔧 *Commands:*
/models — See available AI models
/model gemini — Switch AI model
/help — See what I can do
/reset — Start a fresh conversation

*Ask me anything! Let's learn together.* 🚀`;
}

/**
 * Help message
 */
function getHelpMessage() {
  return `📚 *BroadMind AI — Help*

*Subjects I cover:*
📐 Maths (Class 8 to PhD level)
⚡ Physics, Chemistry, Biology
💻 Computer Science & Coding
🏗️ Engineering (all branches)
🏥 Medicine & Pharmacy
⚖️ Law, Commerce, Management
📖 Arts, Humanities, Languages

*Exam Prep:*
🎯 JEE, NEET, UPSC, GATE, CAT & more

*Tips for best results:*
• Ask one question at a time
• For math: type the full equation
• For diagrams: take a clear photo
• Mention your class/level for tailored answers

*Commands:*
/models — List AI models & switch
/model gemini — Switch to Gemini
/model chatgpt — Switch to ChatGPT
/model claude — Switch to BroadMind AI
/model kimi — Switch to Kimi
/reset — Clear chat history
/help — Show this message

*Example questions:*
• "Solve: integrate x²sin(x)dx"
• "Explain Kirchhoff's law in Tamil"
• "Write a Python program for binary search"
• "What is the difference between mitosis and meiosis?"`;
}

module.exports = {
  handleIncomingMessage,
};
