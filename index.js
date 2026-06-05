





import "dotenv/config";
import { startOrderScheduler } from "./src/order-scheduler.js";

import express from "express";
import { PORT } from "./src/config.js";
import { addLog } from "./src/logger.js";
import { createRoutes } from "./src/routes.js";
import { runBotOnce } from "./src/bot.js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

createRoutes(app);

app.listen(PORT, () => {
  addLog(`Dashboard server started on port ${PORT}`);
  startOrderScheduler();
  runBotOnce();
});
