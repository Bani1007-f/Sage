require("dotenv").config();
const express = require("express");
const fs = require("fs");
const callGroq = require("./groq");
const sendMessage = require("./whatsapp");
const processedMessages = new Set();
const systemPrompt = require("./systemPrompt");
const getTimeContext = require("./utils/time");
const typingDelay = require("./utils/typingDelay");
const proactiveCheck = require("./utils/proactive");
const medicationReminders = require("./utils/reminders");


const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const lastSeen = {};

// ---------------- MEMORY HELPERS ----------------
const memoryPath = "./memory/memory.json";
const profile = require("./memory/profile.json");
const summariesPath = "./memory/summaries.json";

function loadJSON(path, fallback) {
  if (!fs.existsSync(path)) return fallback;
  return JSON.parse(fs.readFileSync(path));
}

function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}



// ======================
// WHATSAPP WEBHOOK
// ======================
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message?.text?.body) return res.sendStatus(200);

    const userId = message.from;
    const userMessage = message.text.body.trim();

    lastSeen[userId] = Date.now();

    const memory = loadJSON(memoryPath, {});
    const summaries = loadJSON(summariesPath, {});

    if (!memory[userId]) memory[userId] = [];
 const timezone = profile?.timezone || "UTC";
  
 const messageId = message.id;

if (processedMessages.has(messageId)) {
  return res.sendStatus(200);
}

processedMessages.add(messageId);



    const conversation = [
      {
        role: "system",
        content:
          systemPrompt +
          "\n\nTime context:\n" +
          getTimeContext(profile.timezone) +
          "\n\nUser profile:\n" +
          JSON.stringify(profile, null, 2) +
          "\n\nLast conversation summary:\n" +
          (summaries[userId]?.summary || "None")
      },
      ...memory[userId],
      { role: "user", content: userMessage }
    ];

    let aiReply = await callGroq(conversation);
    aiReply = await typingDelay(aiReply);

    memory[userId].push(
      { role: "user", content: userMessage },
      { role: "assistant", content: aiReply }
    );

    if (memory[userId].length > 20) {
      memory[userId] = memory[userId].slice(-20);
    }

    saveJSON(memoryPath, memory);
    saveJSON(summariesPath, summaries);

    res.sendStatus(200);
    await sendMessage(userId, aiReply);


  } catch (err) {
    console.error(err.response?.data || err.message);
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






// ======================
// ---------------- PROACTIVE LOOP ----------------
setInterval(() => {
  proactiveCheck(lastSeen);
}, 30 * 60 * 1000); // every 30 minutes

// Medication reminders
setInterval(() => {
  medicationReminders(lastSeen);
}, 60 * 60 * 1000); // every hour
// ======================

// ======================
// START SERVER
// ======================
app.listen(PORT, () => {
  console.log(`✅ Server running on ${PORT}`);
});
