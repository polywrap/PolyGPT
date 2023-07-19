import dotenv from "dotenv";

dotenv.config();

export interface Env {
  OPENAI_API_KEY: string;
  WRAP_LIBRARY_URL: string;
  WRAP_LIBRARY_NAME: string;
  GPT_MODEL: string;
  ROLLING_SUMMARY_WINDOW: number;
  CHUNKING_TOKENS: number;
  ETHEREUM_PRIVATE_KEY?: string;
}

let _env: Env | undefined;

function missingEnvError(prop: string): Error {
  return new Error(
    `Missing "${prop}" Environment Variable - please create a .env file, see .env.template for help.`
  );
}

export function env(): Env {
  if (_env) {
    return _env;
  }

  const {
    OPENAI_API_KEY,
    WRAP_LIBRARY_URL,
    WRAP_LIBRARY_NAME,
    GPT_MODEL,
    ROLLING_SUMMARY_WINDOW,
    CHUNKING_TOKENS,
    ETHEREUM_PRIVATE_KEY
  } = process.env;

  if (!OPENAI_API_KEY) {
    throw missingEnvError("OPENAI_API_KEY");
  }
  if (!WRAP_LIBRARY_URL) {
    throw missingEnvError("WRAP_LIBRARY_URL");
  }
  if (!WRAP_LIBRARY_NAME) {
    throw missingEnvError("WRAP_LIBRARY_NAME");
  }
  if (!GPT_MODEL) {
    throw missingEnvError("GPT_MODEL");
  }
  if (!ROLLING_SUMMARY_WINDOW) {
    throw missingEnvError("ROLLING_SUMMARY_WINDOW");
  }
  if (!CHUNKING_TOKENS) {
    throw missingEnvError("CHUNKING_TOKENS");
  }

  return {
    OPENAI_API_KEY,
    WRAP_LIBRARY_URL,
    WRAP_LIBRARY_NAME,
    GPT_MODEL,
    ROLLING_SUMMARY_WINDOW: Number(ROLLING_SUMMARY_WINDOW),
    CHUNKING_TOKENS: Number(CHUNKING_TOKENS),
    ETHEREUM_PRIVATE_KEY
  };
}
