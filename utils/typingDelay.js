module.exports = function typingDelay(text) {
  const min = 600;
  const max = 1400;
  return new Promise((resolve) =>
    setTimeout(() => resolve(text), Math.random() * (max - min) + min)
  );
}

