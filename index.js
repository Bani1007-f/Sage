require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ======================
// SIMPLE IN-MEMORY STORE
// ======================
// Later you can replace this with Redis / DB
const fs = require("fs");
const MEMORY_FILE = "./memory.json";

function loadMemory() {
  if (!fs.existsSync(MEMORY_FILE)) {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
}

function saveMemory(memory) {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// ======================
// SYSTEM PROMPT
// ======================
const systemPrompt = require("./systemPrompt");

// ======================
// GROQ HELPER FUNCTION
// ======================
async function callGroq(messages) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama3-8b-8192",
      messages
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  return response.data.choices[0].message.content;
}

// ======================
// TYPING DELAY (HUMAN FEEL)
// ======================
function typingDelay(text) {
  const min = 800;
  const max = 1800;
  return new Promise((resolve) =>
    setTimeout(() => resolve(text), Math.random() * (max - min) + min)
  );
}

// ======================
// WHATSAPP WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {
  try {
    // WhatsApp Cloud API format
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const userId = message.from; // phone number
    const userMessage = message.text.body;

    // Initialize memory if not exists
const memory = loadMemory();

if (!memory[userId]) {
  memory[userId] = [];
}



    // Build conversation
    const conversation = [
      { role: "system", content: systemPrompt },
      ...memory[userId],
      { role: "user", content: userMessage }
    ];

    // Call Groq
    let aiReply = await callGroq(conversation);

    // Add typing delay
    aiReply = await typingDelay(aiReply);

    // Save memory (limit to last 10 messages)
  memory[userId].push(
  { role: "user", content: userMessage },
  { role: "assistant", content: aiReply }
);

// keep last 20 messages
if (memory[userId].length > 20) {
  memory[userId] = memory[userId].slice(-20);
}

saveMemory(memory);

    // Send reply back to WhatsApp
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: userId,
        text: { body: aiReply }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.sendStatus(500);
  }
});

// ======================
// VERIFY WEBHOOK (META)
// ======================
app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  res.sendStatus(403);
});

// ======================
// TEST ENDPOINT
// ======================
app.get("/test", async (req, res) => {
  try {
    const reply = await callGroq([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Say hello gently and briefly." }
    ]);

    res.json({ success: true, reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ======================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
