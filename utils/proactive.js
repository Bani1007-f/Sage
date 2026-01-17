const sendMessage = require("../whatsapp");

const alreadyPinged = {};

async function proactiveCheck(lastSeen) {
  const now = Date.now();

  for (const userId in lastSeen) {
    const hoursAway = (now - lastSeen[userId]) / (1000 * 60 * 60);

    // Quiet check-in between 6–8 hours
    if (hoursAway > 6 && hoursAway < 8 && !alreadyPinged[userId]) {
      try {
        await sendMessage(
          userId,
          "Hey babe. Just checking in — no need to reply if you’re resting. I’m here 🌱"
        );

        alreadyPinged[userId] = true;
      } catch (err) {
        console.error("Quiet check-in failed:", err.message);
      }
    }

    // Reset once user comes back
    if (hoursAway < 0.2) {
      alreadyPinged[userId] = false;
    }
  }
}

module.exports = proactiveCheck;
