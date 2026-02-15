const sendMessage = require("../whatsapp");

const alreadyPinged = {};

async function proactiveCheck(lastSeen) {
  const now = Date.now();

  for (const userId in lastSeen) {
    const minutesAway = Math.floor((Date.now() - lastSeen[userId]) / 60000);
    const hoursAway = minutesAway / 60;

// 5 minute check-in
if (minutesAway >= 5 && minutesAway < 60 && !alreadyPinged[userId]) {
  try {
    await sendMessage(
      userId,
      "Hey… you disappeared for a bit. Everything okay? 🌿"
    );
    alreadyPinged[userId] = true;
  } catch (err) {
    console.error("5-min check-in failed:", err.message);
  }
}

// Goodnight between 6–8 hours
else if (hoursAway >= 6 && hoursAway <= 8 && !alreadyPinged[userId]) {
  try {
    await sendMessage(
      userId,
      "It’s been a while… I’m guessing you’re asleep. Goodnight 🌙"
    );
    alreadyPinged[userId] = true;
  } catch (err) {
    console.error("Goodnight failed:", err.message);
  }
}


    // Reset once user comes back
   lastSeen[userId] = Date.now();

if (alreadyPinged[userId]) {
  alreadyPinged[userId] = false;
}
  }
}

module.exports = proactiveCheck;
