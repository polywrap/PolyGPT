import { Logger } from "./logger";
import { Workspace } from "./workspace";
import { OpenAI } from "./openai";
import { summarizerPrompt } from "./prompts";

import {
  ChatCompletionRequestMessage as Message
} from "openai";
import { get_encoding } from "@dqbd/tiktoken";

const gpt2 = get_encoding("gpt2");

export { Message };

export type MessageType =
  | "persistent"
  | "temporary";

interface MessageLog {
  tokens: number;
  msgs: Message[];
}

export class Chat {
  private _msgLogs: Record<MessageType, MessageLog> = {
    "persistent": {
      tokens: 0,
      msgs: []
    },
    "temporary": {
      tokens: 0,
      msgs: []
    }
  };

  constructor(
    private _contextWindowTokens: number,
    private _summaryTokens: number,
    private _logger: Logger,
    private _workspace: Workspace,
    private _openai: OpenAI,
    private _msgsFile: string = ".msgs",
  ) { }

  get messages(): Message[] {
    return [
      ...this._msgLogs["persistent"].msgs,
      ...this._msgLogs["temporary"].msgs
    ];
  }

  public add(
    type: MessageType,
    msg: Message | Message[]
  ) {
    const msgLog = this._msgLogs[type];
    const msgs = Array.isArray(msg) ? msg : [msg];

    for (const msg of msgs) {
      const tokens = gpt2.encode(msg.content || "").length;
      msgLog.tokens += tokens;
      msgLog.msgs.push(msg);
    }

    // Save the full log to disk
    this._save();
  }

  public async fitToContextWindow(): Promise<void> {
    const msgLogs = this._msgLogs;
    const totalTokens = () =>
      msgLogs["persistent"].tokens +
      msgLogs["temporary"].tokens;

    if (totalTokens() < this._contextWindowTokens) {
      return;
    }

    this._logger.notice(`! Max Tokens Exceeded (${totalTokens()} / ${this._contextWindowTokens})`);

    // Start with "temporary" messages
    await this._summarize("temporary");

    if (totalTokens() < this._contextWindowTokens) {
      return;
    }

    // Move onto "persistent" messages
    await this._summarize("persistent");
  }

  private _save() {
    this._workspace.writeFileSync(
      this._msgsFile,
      JSON.stringify(this._msgLogs, null, 2)
    );
  }

  private async _summarize(
    msgType: MessageType
  ): Promise<MessageLog> {
    // Add a final message, instructing the AI to summarize the chat
    this.add(msgType, {
      role: "system",
      content: summarizerPrompt
    });

    const msgLog = this._msgLogs[msgType];

    this._logger.notice(`>> Summarizing "${msgType}" Messages (Tokens: ${msgLog.tokens})`);
    this._logger.spinner.start();

    const response = await this._openai.createChatCompletion({
      messages: msgLog.msgs,
      temperature: 0,
      max_tokens: this._summaryTokens
    });

    const message = response.data.choices[0].message!;
    const tokens = gpt2.encode(message.content || "").length;

    const newLog: MessageLog = {
      tokens,
      msgs: [message]
    };

    this._logger.spinner.stop();

    return newLog;
  }
}
