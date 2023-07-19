import { summarizerPrompt } from "./prompt";
import { Logger } from "./utils";

import chalk from "chalk";
import {
  ChatCompletionRequestMessage,
  OpenAIApi
} from "openai";
import process from "process";
import fs from "fs";

export interface MemoryConfig {
  memoryPath: string;
}

const defaultConfig: MemoryConfig = {
  memoryPath: "workspace/memory.md"
};

export class Memory {
  constructor(private _config: MemoryConfig = defaultConfig) { }

  get memoryPath(): string {
    return this._config.memoryPath;
  }

  reset() {
    fs.writeFileSync(this._config.memoryPath, "");
  }

  // TODO: revisit this
  async summarize(
    chatInteractions: ChatCompletionRequestMessage[],
    agent: OpenAIApi,
    logger: Logger
  ): Promise<ChatCompletionRequestMessage> {
    const memoryPath = this._config.memoryPath;

    try {
      let summarizationRequest: ChatCompletionRequestMessage = {
        role: "system",
        content: summarizerPrompt
      };

      // Check if the summary file exists
      if (fs.existsSync(memoryPath)) {
        const existingSummaryContent = fs.readFileSync(memoryPath, "utf-8");
        const existingSummaryMessage: ChatCompletionRequestMessage = {
          role: "assistant",
          content: existingSummaryContent,
        };
        chatInteractions.push(existingSummaryMessage);
      }

      const messages = [...chatInteractions, summarizationRequest];

      const completion = await agent.createChatCompletion({
        model: process.env.GPT_MODEL!,
        messages,
        temperature: 0,
        max_tokens: 1000
      });

      // Update the summary file with the new summary
      fs.writeFile(memoryPath, completion.data.choices[0].message?.content!, (err) => {
        if (err) {
          throw err;
        }
      });

      return completion.data.choices[0].message!;
    } catch (error: any) {
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      logger.error(chalk.red("Error: ") + chalk.yellow(errorMessage));
      logger.logMessage({
        role: "system",
        content: errorMessage
      });
      throw error;
    }
  }
}
