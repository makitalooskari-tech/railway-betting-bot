const logs = [];

export function addLog(message) {
  const time = new Date().toLocaleString("fi-FI");
  const logLine = `[${time}] ${message}`;

  logs.unshift(logLine);

  if (logs.length > 100) {
    logs.pop();
  }

  console.log(logLine);
}

export function getLogs() {
  return logs;
}
