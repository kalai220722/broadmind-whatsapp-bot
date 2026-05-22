const express = require("express");
const config = require("./config");
const { handleIncomingMessage } = require("./whatsapp");

const app = express();

// Parse incoming Twilio webhook (URL-encoded form data)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    name: "BroadMind AI - WhatsApp Doubt Solver",
    status: "running",
    version: "1.0.0",
    endpoints: {
      webhook: "POST /webhook",
      health: "GET /health",
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Twilio WhatsApp webhook — receives incoming messages
app.post("/webhook", handleIncomingMessage);

// Start server
app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🧠  BroadMind AI — WhatsApp Doubt Solver       ║
║                                                  ║
║   Server running on port ${config.port}                  ║
║   Webhook URL: http://localhost:${config.port}/webhook    ║
║                                                  ║
║   📋 Setup checklist:                             ║
║   1. Add your Twilio credentials to .env          ║
║   2. Add your Gemini API key to .env              ║
║   3. Run: npx ngrok http ${config.port}                  ║
║   4. Set Twilio webhook to:                       ║
║      https://<ngrok-url>/webhook                  ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
});
