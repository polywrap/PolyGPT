import {
  env,
  Logger,
  Workspace
} from "./sys";
import {
  WrapLibrary,
  getWrapClient
} from "./wrap";
import {
  Chat,
  Message,
  MessageType
} from "./chat";
import {
  OpenAI,
  OpenAIResponse,
  OpenAIFunctionCall,
  functions,
  functionDescriptions,
} from "./openai";
import * as Prompts from "./prompts";

import { PolywrapClient } from "@polywrap/client-js";
import { EXIT_COMMAND } from "./constants";

export interface AgentConfig {
  logger: Logger;
  autoPilot: boolean;
} 

export class Agent {
  private _logger: Logger;
  private _workspace: Workspace;

  private _chat: Chat;
  private _openai: OpenAI;

  private _library: WrapLibrary.Reader;
  private _client: PolywrapClient;

  private _autoPilotCounter = 0;
  private _autoPilotMode = false;

  private constructor(config: AgentConfig) {
    this._logger = config.logger;
    this._workspace = new Workspace();

    this._openai = new OpenAI(
      env().OPENAI_API_KEY,
      env().GPT_MODEL
    );
    this._chat = new Chat(
      env().CONTEXT_WINDOW_TOKENS,
      this._logger,
      this._workspace,
      this._openai
    );

    this._library = new WrapLibrary.Reader(
      env().WRAP_LIBRARY_URL,
      env().WRAP_LIBRARY_NAME
    );

    this._client = getWrapClient(
      this._workspace,
      env().ETHEREUM_PRIVATE_KEY
    );

    if (config.autoPilot) {
      this._enterAutoPilotMode(Number.MAX_VALUE);
    }
  }

  static async create(config?: Partial<AgentConfig>): Promise<Agent> {
    const agent = new Agent({
      logger: config?.logger ?? new Logger(),
      autoPilot: config?.autoPilot ?? false
    });

    // Log agent header
    agent._logger.logHeader();

    // Learn wraps from library
    await agent._learnWraps();

    // Initialize the agent's chat
    await agent._initializeChat();

    return agent;
  }

  public async* run(goal: string): AsyncGenerator<StepOutput, RunResult, string | undefined> {
    this._chat.add("persistent", {
      role: "user",
      content: `The user has the following goal: ${goal}`
    });

    let askForPrompt = false;

    try {
      while (true) {
        if (askForPrompt) {
          // Ask the user for input
          let shouldExit = yield* this._askUserForPrompt();

          if (shouldExit) {
            const message = "Exiting...";
            this._logger.notice(message);
            return RunResult.ok(message);
          }
        }

        // Get a response from the AI
        const response = await this._askAiForResponse();

        // Process response, and extract function call
        const functionCall = this._processAiResponse(response);

        let executedFunctionCall = false;

        if (functionCall) {
          // Get confirmation from the user
          let confirmation = yield* this._askUserForConfirmation(functionCall);

          if (confirmation) {
            // Execute function calls
            yield* this._executeFunctionCall(functionCall);
            executedFunctionCall = true;
          } else {
            // Execute a NOOP
            yield* this._executeNoop(functionCall);
          }
        } else {
          yield StepOutput.message(response.content ?? "");
        }

        askForPrompt = !executedFunctionCall && !this._isInAutoPilotMode();
      }
    } catch (err) {
      const message = "Unrecoverable error encountered.";
      this._logger.error(message, err);
      
      return RunResult.error(message);
    }
  }

  private async _learnWraps(): Promise<void> {
    this._logger.notice(
      `> Fetching wrap library index @ ${env().WRAP_LIBRARY_URL}\n`
    );

    try {
      // Get all wraps in the library
      const index = await this._library.loadWraps();

      // Log the names of all known wraps and save the wrap descriptions
      this._logger.success(`Library:\n${JSON.stringify(index, null, 2)}`);
    } catch (err) {
      this._logger.error("Failed to load wrap library.", err);
    }
  }

  private async _initializeChat(): Promise<void> {
    this._chat.add(
      "persistent",
      Prompts.initializeAgent(
        Object.values(this._library.wraps)
      )
    );
  }

  private async* _askUserForPrompt(): AsyncGenerator<StepOutput, boolean, string | undefined> {
    let response = yield StepOutput.prompt("Prompt: ");

    if (!response) {
      throw new Error("User response is undefined.");
    }

    if (response === EXIT_COMMAND) {
      return true;
    }
    
    // Append to temporary chat history
    this._chat.add("temporary", {
      role: "user",
      content: response
    });

    this._enterAutoPilotModeIfRequested(response);

    return false;
  }

  private _enterAutoPilotModeIfRequested(prompt: string): void {
    // Check if the user has entered the !auto special prompt
    const autoPilotMatch = prompt.match(/^!auto (\d+)$/);
    if (autoPilotMatch) {
      this._enterAutoPilotMode(parseInt(autoPilotMatch[1], 10));
    }
  }

  private _enterAutoPilotMode(autoPilotCounter: number): void {
    this._autoPilotCounter = autoPilotCounter;
    this._autoPilotMode = true;
    this._chat.add("temporary", {
      role: "system",
      content: "Entering autopilot mode. Please continue with the next step in the plan."
    });
  }

  private _isInAutoPilotMode(): boolean {
    // If we're in auto-pilot, don't ask the user
    if (this._autoPilotMode && this._autoPilotCounter > 0) {
      this._autoPilotCounter--;

      if (this._autoPilotCounter <= 0) {
        this._autoPilotMode = false;
        this._autoPilotCounter = 0;
      }

      return true;
    }

    return false;
  }

  private async _askAiForResponse(): Promise<OpenAIResponse> {
    try {
      // Ensure the chat fits within the LLM's context window
      // before we make an API call, ensuring we don't overflow
      await this._chat.fitToContextWindow();

      this._logger.spinner.start();

      const completion = await this._openai.createChatCompletion({
        messages: this._chat.messages,
        functions: functionDescriptions,
        temperature: 0,
        max_tokens: env().MAX_TOKENS_PER_RESPONSE
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

  private async* _askUserForConfirmation(
    functionCall: OpenAIFunctionCall,
  ): AsyncGenerator<StepOutput, boolean, string | undefined> {
    const functionCallStr =
    `\`\`\`\n${functionCall.name} (${functionCall.arguments})\n\`\`\`\n`;

    if (this._autoPilotMode) {
      this._logger.notice("> Running in AutoPilot mode \n");
      this._logger.info(
        `About to execute the following function:\n\n${functionCallStr}`
      );
      
      return true;
    } else {
      let response = yield StepOutput.question(
        "Do you wish to execute the following function?\n\n" +
        `${functionCallStr}\n(Y/N)\n`
      );

      if (!response) {
        throw new Error("User response is undefined.");
      }

      return ["y", "Y", "yes", "Yes", "yy"].includes(response);
    }
  }

  private async* _executeFunctionCall(
    functionCall: OpenAIFunctionCall
  ): AsyncGenerator<StepOutput, void, string | undefined> {
    const name = functionCall.name!;
    const args = functionCall.arguments
      ? JSON.parse(functionCall.arguments)
      : undefined;

    const functionToCall = (functions(
      this._library,
      this._client
    ) as any)[name];

    const response = await functionToCall(args);

    // If the function call was unsuccessful
    if (!response.ok) {
      const message = `The function failed, this is the error: ${response.error}`;
      // Record the specifics of the failure
      this._logMessage(
        "system",
        `The function failed, this is the error: ${response.error}`
      );
      yield StepOutput.message(message);
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

    if (name === "LearnWrap") {
      const wrap = await this._library.getWrap(args?.name);

      this._chat.add("persistent", {
        role: "system",
        content: `Loaded Wrap: ${args.name}\nDescription: ${wrap.description}`
      });
      this._chat.add("temporary", message);

      const output = `\n> 🧠 Learnt a wrap: ${args?.name}\n> Description: ${wrap.description} \n> Repo: ${wrap.repo}\n`;
      this._logger.success(output);

      yield StepOutput.message(output);
    } else {
      this._chat.add("temporary", message);
      this._logger.action(message);

      yield StepOutput.message(message.content ?? "");
    }
  }

  private async* _executeNoop(
    functionCall: OpenAIFunctionCall
  ): AsyncGenerator<StepOutput, void, string | undefined> {
    const message = `The user asked to not execute the function "${functionCall.name}".`;
    this._logMessage(
      "assistant",
      message
    );

    yield StepOutput.message(message);
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

export class RunResult {
  message?: string;
  isError?: boolean;

  constructor(message?: string, isError?: boolean) {
    this.message = message;
    this.isError = isError;
  }

  static ok(msg?: string): RunResult {
    return new RunResult(msg);
  }

  static error(msg?: string): RunResult {
    return new RunResult(msg, true);
  }
}

export enum PromptType {
  None,
  Prompt,
  Question,
}

export class StepOutput {
  message: string;
  promptType: PromptType;

  constructor(message: string, promptType?: PromptType) {
    this.message = message;
    this.promptType = promptType ?? PromptType.None;
  }

  static message(msg: string): StepOutput {
    return new StepOutput(msg);
  }

  static prompt(msg: string): StepOutput {
    return new StepOutput(msg, PromptType.Prompt);
  }

  static question(msg: string): StepOutput {
    return new StepOutput(msg, PromptType.Question);
  }
}
