import { Configuration } from "openai";
import dotenv from "dotenv";

dotenv.config();

export const OPEN_AI_CONFIG = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

export const WRAP_LIBRARY_URL =
  process.env.WRAP_LIBRARY_URL ||
  "https://raw.githubusercontent.com/polywrap/agent-learning-demo/dev/wraps";

export const WRAP_LIBRARY_NAME =
  process.env.WRAP_LIBRARY_NAME ||
  "polywrap/agent-wrap-library";
