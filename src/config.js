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
  port: process.env.PORT || 3001,
};
