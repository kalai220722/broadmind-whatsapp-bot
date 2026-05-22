const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("./config");
const fs = require("fs");

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// System prompt that makes the bot behave as a BroadMind AI doubt solver
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

// Store conversation history per user (in-memory, resets on restart)
const conversations = new Map();
const MAX_HISTORY = 10; // Keep last 10 messages per user

/**
 * Get or create conversation history for a user
 */
function getHistory(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  return conversations.get(userId);
}

/**
 * Add a message to conversation history
 */
function addToHistory(userId, role, text) {
  const history = getHistory(userId);
  history.push({ role, parts: [{ text }] });

  // Trim to max history
  if (history.length > MAX_HISTORY * 2) {
    conversations.set(userId, history.slice(-MAX_HISTORY * 2));
  }
}

/**
 * Solve a text-based doubt
 */
async function solveTextDoubt(userId, question) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const history = getHistory(userId);

    const chat = model.startChat({
      history: history.length > 0 ? history : undefined,
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await chat.sendMessage(question);
    const response = result.response.text();

    // Save to history
    addToHistory(userId, "user", question);
    addToHistory(userId, "model", response);

    return response;
  } catch (error) {
    console.error("Gemini text error:", error.message);
    throw new Error("Sorry, I couldn't process your question. Please try again! 🙏");
  }
}

/**
 * Solve a doubt from an image (photo of a problem)
 */
async function solveImageDoubt(userId, imagePath, caption) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString("base64");

    // Detect mime type from extension
    const ext = imagePath.split(".").pop().toLowerCase();
    const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
    const mimeType = mimeMap[ext] || "image/jpeg";

    const prompt = caption
      ? `The student sent this image with the message: "${caption}"\n\nAnalyze the image, identify the problem/question, and provide a complete step-by-step solution.`
      : "The student sent this image of a problem. Analyze it carefully, identify what's being asked, and provide a complete step-by-step solution.";

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType,
        },
      },
    ]);

    const response = result.response.text();

    // Save to history
    addToHistory(userId, "user", caption || "[Sent an image of a problem]");
    addToHistory(userId, "model", response);

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    return response;
  } catch (error) {
    console.error("Gemini image error:", error.message);
    // Clean up on error too
    try { fs.unlinkSync(imagePath); } catch {}
    throw new Error("Sorry, I couldn't analyze that image. Please try sending it again or type your question! 🙏");
  }
}

/**
 * Reset conversation for a user
 */
function resetConversation(userId) {
  conversations.delete(userId);
}

module.exports = {
  solveTextDoubt,
  solveImageDoubt,
  resetConversation,
};
