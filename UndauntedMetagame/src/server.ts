import { app } from "./app";
import { DrainAndRegisterAPIKeys } from "./controllers/authgameserver";
import { DrainAndRegisterUserAPIKeys } from "./controllers/authuser";
import { GetDb } from "./db";
import { logger } from "./logger";

const PORT = process.env.PORT;

GetDb(); // This runs migrations TODO make this more explicit

DrainAndRegisterAPIKeys().then(async () => {
  await DrainAndRegisterUserAPIKeys();
  
  app.listen(PORT, () => {
    logger.info(`Undaunted Metagame on port ${PORT}`);
    logger.info(`Clear Skies, Slayer.`);
  });
});
