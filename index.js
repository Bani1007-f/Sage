require("dotenv").config();
const express = require("express");
const lastSeen = {};
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;


// TIME AND DATE
function getTimeContext() {
console.log("Timezone:", timezone);
  const timezone = process.env.USER_TIMEZONE || "UTC";

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone })
  );

  const hours = now.getHours();
  const weekday = now.toLocaleDateString("en-US", { weekday: "long" });
  const isWeekend = weekday === "Saturday" || weekday === "Sunday";

  let timeOfDay = "night";
  if (hours >= 5 && hours < 12) timeOfDay = "morning";
  else if (hours >= 12 && hours < 17) timeOfDay = "afternoon";
  else if (hours >= 17 && hours < 21) timeOfDay = "evening";

  return `
Local context:
- Date: ${now.toDateString()}
- Time: ${now.toLocaleTimeString()}
- Day: ${weekday}
- Weekend: ${isWeekend ? "yes" : "no"}
- Time of day: ${timeOfDay}
`;
}

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
      model: "llama-3.1-8b-instant",
      messages,
      max_tokens: 200, // 👈 keeps replies short
      temperature: 0.7
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

async function sendMessage(to, text) {
  return axios.post(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to,
      text: { body: text }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json"
      }
    }
  );
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
console.log("📩 Webhook hit");  
  try {
    // WhatsApp Cloud API format
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || !message.text) {
      return res.sendStatus(200);
    }

    const userId = message.from; // phone number
    lastSeen[userId] = Date.now();
    const userMessage = message.text.body;
    await sendMessage(userId, aiReply);
    console.log("📤 Sending reply to:", userId);


    // Initialize memory if not exists
const memory = loadMemory();

if (!memory[userId]) {
  memory[userId] = [];
}



    // Build conversation
  const conversation = [
  {
    role: "system",
    content: systemPrompt + "\n\n" + getTimeContext()
  },
  ...memoryStore[userId],
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
    console.error("FULL ERROR:", err.response?.data || err.message);

    res.status(500).json({
      success: false,
      error: err.response?.data || err.message
    });
  }
});

setInterval(async () => {
  const now = Date.now();

  for (const userId in lastSeen) {
    const hoursAway = (now - lastSeen[userId]) / (1000 * 60 * 60);

    // If quiet for 6–8 hours
    if (hoursAway > 6 && hoursAway < 8) {
      try {
        await axios.post(
          `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            messaging_product: "whatsapp",
            to: userId,
            text: {
              body: "Hey. Just checking in — no need to reply if you’re resting. I’m here 🌱"
            }
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            }
          }
        );

        // prevent repeated pings
        lastSeen[userId] = now;
      } catch (err) {
        console.error("Quiet check-in failed");
      }
    }
  }
}, 30 * 60 * 1000); // checks every 30 mins

setInterval(async () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();

  for (const userId in lastSeen) {
    try {
      // Morning reminder (6–9am)
      if (hour === 6 && minute === 30) {
        await sendMessage(
          userId,
          "Morning reminder 💊 Have you taken your Betaxolol yet?"
        );
      }

      // Night reminder (8–10pm)
      if (hour === 21) {
        await sendMessage(
          userId,
          "It’s evening 🌙 Betaxolol + Xalatan time. I’ll sit with you for a moment."
        );
      }
    } catch {}
  }
}, 60 * 60 * 1000);


// ======================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
