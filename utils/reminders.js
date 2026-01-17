const sendMessage = require("../whatsapp");

const sent = {};

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function runReminders(lastSeen) {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const today = todayKey();

  for (const userId in lastSeen) {
    if (!sent[userId]) sent[userId] = {};

    /* ---------------- MORNING ---------------- */
    // Betaxolol – 6:30am
    if (
      hour === 6 &&
      minute >= 30 &&
      !sent[userId][`morning-betaxolol-${today}`]
    ) {
      await sendMessage(
        userId,
        "Morning 💊 Gentle reminder for your Betaxolol. No rush — just when you’re ready."
      );
      sent[userId][`morning-betaxolol-${today}`] = true;
    }

    /* ---------------- EVENING STEP 1 ---------------- */
    // Betaxolol – 9:00pm
    if (
      hour === 21 &&
      !sent[userId][`night-betaxolol-${today}`]
    ) {
      await sendMessage(
        userId,
        "Evening 🌙 Betaxolol first. I’ll remind you about the next one in a bit."
      );
      sent[userId][`night-betaxolol-${today}`] = true;
    }

    /* ---------------- EVENING STEP 2 ---------------- */
    // Xalatan – 10 minutes later (after Betaxolol)
    if (
      hour === 21 &&
      minute >= 10 &&
      sent[userId][`night-betaxolol-${today}`] &&
      !sent[userId][`night-xalatan-${today}`]
    ) {
      await sendMessage(
        userId,
        "Okay… about 10 minutes have passed 🌙 Xalatan time now."
      );
      sent[userId][`night-xalatan-${today}`] = true;
    }

    /* ---------------- EATING NUDGES ---------------- */
    // Late afternoon gentle nudge
    if (
      hour === 16 &&
      !sent[userId][`eat-afternoon-${today}`]
    ) {
      await sendMessage(
        userId,
        "Hey… have you eaten anything today? Even something small counts."
      );
      sent[userId][`eat-afternoon-${today}`] = true;
    }

    // Evening soft check-in (not tied to guilt)
    if (
      hour === 20 &&
      !sent[userId][`eat-evening-${today}`]
    ) {
      await sendMessage(
        userId,
        "Just checking — did you manage to eat earlier? If not, we can think of something easy."
      );
      sent[userId][`eat-evening-${today}`] = true;
    }
  }
}

module.exports = runReminders;
  