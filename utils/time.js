function getTimeContext() {

  const timezone = process.env.USER_TIMEZONE || "UTC";

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: timezone })
  );

  const hours = now.getHours();
  const minutes = now.getMinutes();
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

module.exports = getTimeContext;