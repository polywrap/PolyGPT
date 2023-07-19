import { Logger } from "./logger";
import { Workspace } from "./workspace";
import { OpenAI } from "./openai";
import { summarizerPrompt } from "./prompt";

import chalk from "chalk";
import {
  ChatCompletionRequestMessage as Message
} from "openai";

export { Message };

export type MessageType =
  | "persistent"
  | "temporary";

export class History {
  private _msgs: Record<MessageType, Message[]> = {
    "persistent": [],
    "temporary": []
  };

  constructor(
    private _logger: Logger,
    private _workspace: Workspace,
    private _saveFile: string = ".history",
    private _summaryFile: string = ".summary"
  ) { }

  get saveFile(): string {
    return this._saveFile;
  }

  get summaryFile(): string {
    return this._summaryFile;
  }

  get persistentMsgs(): Message[] {
    return this._msgs["persistent"];
  }

  reset() {
    this._workspace.writeFileSync(
      this._summaryFile, ""
    );
  }

  save(
    history: Message[],
    workspace: Workspace
  ) {
    const historyStr = history.map(msg => `${msg.role}: ${msg.content}`).join("\n");
    workspace.writeFileSync(this._saveFile, historyStr);
  }

  add(
    type: MessageType,
    msg: Message | Message[]
  ) {
    if (Array.isArray(msg)) {
      this._msgs[type].push(...msg);
    } else {
      this._msgs[type].push(msg);
    }
  }




  // TODO: maybe move this
  async summarize(
    chatInteractions: Message[],
    openai: OpenAI,
  ): Promise<Message> {
    try {
      let summarizationRequest: Message = {
        role: "system",
        content: summarizerPrompt
      };

      // Check if the summary file exists
      if (this._workspace.existsSync(this._summaryFile)) {
        const existingSummaryContent = this._workspace.readFileSync(this._summaryFile);
        const existingSummaryMessage: Message = {
          role: "assistant",
          content: existingSummaryContent,
        };
        chatInteractions.push(existingSummaryMessage);
      }

      const messages = [...chatInteractions, summarizationRequest];

      const completion = await openai.createChatCompletion({
        messages,
        temperature: 0,
        max_tokens: 1000
      });

      // Update the summary file with the new summary
      this._workspace.writeFileSync(
        this._summaryFile,
        completion.data.choices[0].message?.content!
      );

      return completion.data.choices[0].message!;
    } catch (error: any) {
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      this._logger.error(chalk.red("Error: ") + chalk.yellow(errorMessage));
      this._logger.logMessage({
        role: "system",
        content: errorMessage
      });
      throw error;
    }
  }
}
