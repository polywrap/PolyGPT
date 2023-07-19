import { summarizerPrompt } from "./prompt";
import { Logger, env } from "./utils";
import { Workspace } from "./workspace";

import chalk from "chalk";
import {
  ChatCompletionRequestMessage,
  OpenAIApi
} from "openai";

export class Memory {
  constructor(
    private _workspace: Workspace,
    private _memoryPath: string = "summary.md"
  ) { }

  get memoryPath(): string {
    return this._memoryPath;
  }

  reset() {
    this._workspace.writeFileSync(
      this.memoryPath, ""
    );
  }

  // TODO: revisit this
  async summarize(
    chatInteractions: ChatCompletionRequestMessage[],
    agent: OpenAIApi,
    logger: Logger
  ): Promise<ChatCompletionRequestMessage> {
    try {
      let summarizationRequest: ChatCompletionRequestMessage = {
        role: "system",
        content: summarizerPrompt
      };

      // Check if the summary file exists
      if (this._workspace.existsSync(this.memoryPath)) {
        const existingSummaryContent = this._workspace.readFileSync(this.memoryPath);
        const existingSummaryMessage: ChatCompletionRequestMessage = {
          role: "assistant",
          content: existingSummaryContent,
        };
        chatInteractions.push(existingSummaryMessage);
      }

      const messages = [...chatInteractions, summarizationRequest];

      const completion = await agent.createChatCompletion({
        model: env().GPT_MODEL!,
        messages,
        temperature: 0,
        max_tokens: 1000
      });

      // Update the summary file with the new summary
      this._workspace.writeFileSync(
        this.memoryPath,
        completion.data.choices[0].message?.content!
      );

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

  saveChatHistoryToFile(
    chatHistory: ChatCompletionRequestMessage[],
    workspace: Workspace
  ) {
    const chatHistoryStr = chatHistory.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    workspace.writeFileSync("chat-history.txt", chatHistoryStr);
  }
}
