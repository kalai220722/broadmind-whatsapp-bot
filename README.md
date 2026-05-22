# BroadMind AI — WhatsApp Doubt Solver Bot

A WhatsApp bot that solves academic doubts instantly using Google Gemini AI. Students can send text questions or photos of problems and get step-by-step solutions in their own language (Tamil, Hindi, Telugu, English & more).

## Features

- **Text Doubts** — Type any question and get a step-by-step solution
- **Photo Doubts** — Send a photo of a handwritten/printed problem for instant OCR + solving
- **Multilingual** — Auto-detects language and replies in the same language
- **Conversation Memory** — Remembers context for follow-up questions
- **100+ Subjects** — Math, Physics, Chemistry, CS, Engineering, Medicine, Law & more
- **Exam Prep** — JEE, NEET, UPSC, GATE support

## Tech Stack

- **Runtime:** Node.js + Express
- **AI:** Google Gemini 1.5 Flash
- **WhatsApp:** Twilio WhatsApp Business API
- **Image Processing:** Sharp

## Quick Start

### 1. Get API Keys

- **Twilio:** Sign up at https://console.twilio.com → get Account SID & Auth Token
- **Twilio WhatsApp Sandbox:** Go to Console → Messaging → Try it out → Send a WhatsApp message
- **Gemini:** Get a free API key at https://aistudio.google.com/apikey

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your actual keys
```

### 3. Install & Run

```bash
npm install
npm run dev
```

### 4. Expose with ngrok

```bash
npx ngrok http 3001
```

### 5. Set Twilio Webhook

1. Go to Twilio Console → Messaging → Settings → WhatsApp Sandbox
2. Set "When a message comes in" to: `https://<your-ngrok-url>/webhook`
3. Method: POST

### 6. Test It!

Send a WhatsApp message to your Twilio sandbox number. Try:
- "hi" — Get the welcome message
- "Solve: x² + 5x + 6 = 0" — Get a step-by-step solution
- Send a photo of a math problem — Get it solved from the image
- "Explain Ohm's law in Tamil" — Get the answer in Tamil

## Commands

| Command | Description |
|---------|-------------|
| `hi` / `hello` / `/start` | Welcome message |
| `/help` | See what the bot can do |
| `/reset` | Clear conversation history |

## Project Structure

```
broadmind-whatsapp-bot/
├── src/
│   ├── server.js      # Express server + routes
│   ├── config.js      # Environment config
│   ├── gemini.js      # Google Gemini AI integration
│   └── whatsapp.js    # Twilio WhatsApp handler
├── .env.example       # Environment template
├── package.json
└── README.md
```

## License

MIT — Built for BroadMind AI by Kalairajan
