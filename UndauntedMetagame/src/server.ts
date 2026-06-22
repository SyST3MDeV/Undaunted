import { app } from "./app";
import { GetDb } from "./db";

const PORT = process.env.PORT;

GetDb(); // This runs migrations TODO make this more explicit

app.listen(PORT, () => {
  console.log(`Undaunted on http://localhost:${PORT}\nClear Skies, Slayer.`);
});