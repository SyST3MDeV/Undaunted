import { app } from "./app";
import { GetDb } from "./db";

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log(`Undaunted on http://localhost:${PORT}\nClear Skies, Slayer.`);

  GetDb();
});