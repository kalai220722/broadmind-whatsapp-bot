require("dotenv").config();

module.exports = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || "whatsapp:+14155238886",
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
  },
  kimi: {
    apiKey: process.env.KIMI_API_KEY,
    baseUrl: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
  },
  // Default AI provider: gemini | chatgpt | claude | kimi
  defaultProvider: process.env.DEFAULT_AI_PROVIDER || "gemini",
  port: process.env.PORT || 3001,
};
