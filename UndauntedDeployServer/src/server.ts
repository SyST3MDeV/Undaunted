import { app } from "./app";
import { Startup } from "./controllers/gameservers";
import { logger } from "./logger";

const PORT = process.env.PORT;

app.listen(PORT, () => {
  Startup();

  logger.info(`Undaunted DeployServer on port ${PORT}`);
  logger.info(`Clear Skies, Slayer.`);
});