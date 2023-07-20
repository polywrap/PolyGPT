import { env } from "./env";
import { Logger } from "./logger";
import { Workspace } from "./workspace";
import { Chat, Message, MessageType } from "./chat";
import * as Prompts from "./prompts";
import {
  OpenAI,
  OpenAIResponse,
  OpenAIFunctionCall
} from "./openai";
import {
  WrapLibrary,
  getWrapClient
} from "./wrap";

import { PolywrapClient } from "@polywrap/client-js";

// TODO: look at this
import { functionsDescription, functionsMap } from "./wrap/open-ai-functions";

export interface AgentConfig {
  debugMode?: boolean;
  reset?: boolean;
}

export class Agent {
  private _logger: Logger;
  private _workspace: Workspace;

  private _chat: Chat;
  private _openai: OpenAI;

  private _wraps: WrapLibrary.Wrap[];
  private _library: WrapLibrary.Reader;
  private _client: PolywrapClient;

  private _autoPilotCounter = 0;
  private _autoPilotMode = false;

  private constructor(private _config: AgentConfig = {}) {
    this._logger = new Logger();
    this._workspace = new Workspace();

    this._openai = new OpenAI(
      env().OPENAI_API_KEY,
      env().GPT_MODEL
    );
    this._chat = new Chat(
      this._logger,
      this._workspace
    );

    this._wraps = [];
    this._library = new WrapLibrary.Reader(
      env().WRAP_LIBRARY_URL,
      env().WRAP_LIBRARY_NAME
    );
    this._client = getWrapClient(
      env().ETHEREUM_PRIVATE_KEY
    );

    // Reset chat history
    if (this._config.reset) {
      this._chat.reset();
    }
  }

  static async create(config: AgentConfig = {}): Promise<Agent> {
    const agent = new Agent(config);

    // Log agent header
    agent._logger.logHeader();

    // Load wraps from library
    await agent._loadWraps();

    // Initialize the agent's chat
    agent._initializeChat();

    // Ask for the user's goal
    await agent._askUserForGoal();

    return agent;
  }

  public async run(): Promise<void> {
    try {
      while (true) {
        // Ask the user for input
        await this._askUserForPrompt();

        // Get a response from the AI
        const response = await this._askAiForResponse();

        // Process response, and extract function call
        const functionCall = this._processAiResponse(response);

        if (functionCall) {
          // Get confirmation from the user
          const confirmation = await this._askUserForConfirmation(
            functionCall
          );

          if (confirmation) {
            // Execute function calls
            await this._executeFunctionCall(functionCall);
          } else {
            // Execute a NOOP
            this._executeNoop(functionCall);
          }
        }

        // Finally, call cleanup on the chat, giving it a chance
        // to summarize "temporary" messages if needed
        await this._chat.cleanup();
      }
    } catch (err) {
      this._logger.error("Unrecoverable error encountered.", err);
    }
  }

  private async _loadWraps(): Promise<void> {
    this._logger.notice(
      `>> Fetching wrap library index @ ${env().WRAP_LIBRARY_URL}`
    );

    try {
      // Fetch the root "index" file
      const wrapIndex = await this._library.getIndex();
      this._wraps = await this._library.getWraps(wrapIndex.wraps);

      // Log the names of all known wraps
      const knownWraps = JSON.stringify(wrapIndex.wraps, null, 2);
      this._logger.success(
        `Known Wraps:\n${knownWraps}`
      );
    } catch (err) {
      this._logger.error("Failed to load wrap library.", err);
    }
  }

  private _initializeChat(): void {
    this._chat.add(
      "persistent",
      Prompts.initializeAgent(this._wraps)
    );
  }

  private async _askUserForGoal(): Promise<void> {
    const goal = await this._logger.question(
      "Please enter your main goal: "
    );
    this._chat.add("persistent", {
      role: "user",
      content: `The user has the following goal: ${goal}`
    });
  }

  private async _askUserForPrompt(): Promise<void> {
    // If we're in auto-pilot, don't ask the user
    if (this._autoPilotMode && this._autoPilotCounter > 0) {
      this._autoPilotCounter--;

      if (this._autoPilotCounter <= 0) {
        this._autoPilotMode = false;
        this._autoPilotCounter = 0;
      }
      return;
    }

    // Receive user input
    const prompt = await this._logger.question(
      "Prompt: "
    );

    // Append to temporary chat history
    this._chat.add("temporary", {
      role: "user",
      content: prompt
    });

    // Check if the user has entered the auto-pilot
    const autoPilotMatch = prompt.match(/^auto -(\d+)$/);
    if (autoPilotMatch) {
      this._autoPilotCounter = parseInt(autoPilotMatch[1], 10);
      this._autoPilotMode = true;
      this._chat.add("temporary", {
        role: "system",
        content: "Entering autopilot mode. Please continue with the next step in the plan."
      });
    }
  }

  private async _askAiForResponse(): Promise<OpenAIResponse> {
    try {
      this._logger.spinner.start();

      const completion = await this._openai.createChatCompletion({
        messages: this._chat.messages,
        functions: functionsDescription,
        temperature: 0,
        max_tokens: 500
      });

      this._logger.spinner.stop();

      if (completion.data.choices.length < 1) {
        throw Error("Chat completion choices length was 0...");
      }

      const choice = completion.data.choices[0];

      if (!choice.message) {
        throw Error(
          `Chat completion message was undefined: ${JSON.stringify(choice, null, 2)}`
        );
      }

      return choice.message;
    } catch (err) {
      this._logger.spinner.stop();
      throw err;
    }
  }

  private _processAiResponse(
    response: OpenAIResponse
  ): OpenAIFunctionCall | undefined {
    if (response.function_call) {
      return response.function_call;
    }

    this._logMessage("assistant", response.content!);

    return undefined;
  }

  private async _askUserForConfirmation(
    functionCall: OpenAIFunctionCall
  ): Promise<boolean> {

    const functionCallStr =
      `\`\`\`\n${functionCall.name} (${functionCall.arguments})\n\`\`\`\n`;

    if (this._autoPilotMode) {
      this._logger.notice(">> Running in AutoPilot mode");
      this._logger.info(
        `About to execute the following function:\n\n${functionCallStr}`
      );
      return Promise.resolve(true);
    }

    const query =
      "Do you wish to execute the following function?\n\n" +
      `${functionCallStr}\n(Y/N)\n`;

    const response = await this._logger.question(query);

    return ["y", "Y", "yes", "Yes"].includes(response);
  }

  private async _executeFunctionCall(
    functionCall: OpenAIFunctionCall
  ): Promise<void> {
    const name = functionCall.name!;
    const args = functionCall.arguments
      ? JSON.parse(functionCall.arguments)
      : undefined;

    const response = await functionsMap(this._library)[name](
      this._client,
      args
    );

    // If the function call was unsuccessful
    if (!response.ok) {
      // Record the specifics of the failure
      this._logMessage(
        "system",
        `The function failed, this is the error: ${response.error}`
      );
      return;
    }

    // The function call succeeded, record the results
    const argsStr = JSON.stringify(args, null, 2);
    const resultStr = JSON.stringify(response.result, null, 2);
    const functionCallSummary =
      `Args:\n\`\`\`json\n${argsStr}\n\`\`\`\n` +
      `Result:\n\`\`\`json\n${resultStr}\n\`\`\`\n`;

    const message: Message = {
      role: "function",
      name,
      content: functionCallSummary
    };

    this._logger.message(message);

    if (name === "LoadWrap") {
      this._chat.add("persistent", message);
    } else {
      this._chat.add("temporary", message);
    }
  }

  private _executeNoop(
    functionCall: OpenAIFunctionCall
  ): void {
    this._logMessage(
      "assistant",
      `The user asked to not execute the function "${functionCall.name}".`
    );
  }

  private _logMessage(
    role: Message["role"],
    content: string,
    type: MessageType = "temporary",
  ): void {
    const message: Message = { role, content };
    this._chat.add(type, message);
    this._logger.message(message);
  }
}
