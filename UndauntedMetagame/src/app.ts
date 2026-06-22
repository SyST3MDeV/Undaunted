import express from "express";
import { loginRouter } from "./routes/Login.js";
import { logger } from "./logger.js";
import { eosRouter } from "./routes/eos.js";
import { systemRouter } from "./routes/system.js";

export const app = express();

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use("/", loginRouter);
app.use("/", eosRouter);
app.use("/", systemRouter);

app.use((req, res) => {
    logger.warn(`Unstubbed route ${req.method} ${req.path}`)

    res.status(404);
});