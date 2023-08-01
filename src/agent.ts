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

export class Agent {
  private _goal: string | undefined;

  private _logger: Logger;
  private _workspace: Workspace;

  private _chat: Chat;
  private _openai: OpenAI;

  private _wraps: WrapLibrary.Wrap[];
  private _library: WrapLibrary.Reader;
  private _client: PolywrapClient;
  private _knownWraps: { [key: string]: {description: string, repo: string} };
  // If the agent executed a function last iteration
  private _executedLastIteration = false;

  private _autoPilotCounter = 0;
  private _autoPilotMode = false;

  private constructor() {
    this._logger = new Logger();
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

    this._wraps = [];
    this._library = new WrapLibrary.Reader(
      env().WRAP_LIBRARY_URL,
      env().WRAP_LIBRARY_NAME
    );
    this._knownWraps = {};

    this._client = getWrapClient(
      this._workspace,
      env().ETHEREUM_PRIVATE_KEY
    );
  }

  static async create(): Promise<Agent> {
    const agent = new Agent();

    // Log agent header
    agent._logger.logHeader();

    // Learn wraps from library
    await agent._learnWraps();

    // Initialize the agent's chat
    agent._initializeChat();

    return agent;
  }
  
  public async run(): Promise<void> {
    try {
      while (true) {
        let response: OpenAIResponse | null = null;
        let functionCall: OpenAIFunctionCall | undefined = undefined;
        do {
          if (!this._executedLastIteration) {
            // Ask the user for input
            await this._askUserForPrompt();
          }
  
          // Get a response from the AI
          response = await this._askAiForResponse();
  
          // Process response, and extract function call
          functionCall = this._processAiResponse(response);
  
          if (functionCall) {
            // Check if the function exists, prompt for approval, and execute
            await this._executeFunctionIfExists(functionCall);
          }
        } while (this._executedLastIteration && functionCall);
  
        this._executedLastIteration = false;
      }
    } catch (err) {
      this._logger.error("Unrecoverable error encountered.", err);
    }
  }
  

  private async _learnWraps(): Promise<void> {
    this._logger.notice(
      `> Fetching wrap library index @ ${env().WRAP_LIBRARY_URL}\n`
    );

    try {
      // Fetch the root "index" file
      const wrapIndex = await this._library.getIndex();
      this._wraps = await this._library.getWraps(wrapIndex.wraps);

      // Log the names of all known wraps and save the wrap descriptions
      const knownWraps = JSON.stringify(wrapIndex.wraps, null, 2);
      this._logger.success(`Known Wraps:\n${knownWraps}`);
      for (let wrap of this._wraps) {
        // Save the wrap, its description and repo
        this._knownWraps[wrap.name] = {"description":wrap.description, "repo":wrap.repo};
      }
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
    this._goal = goal;
  }

  private async _askUserForPrompt(): Promise<void> {
    // If the user has not defined a goal, ask for it
    if (!this._goal) {
      await this._askUserForGoal();
      return;
    }

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
    const prompt = await this._logger.prompt(
      "Prompt: "
    );

    // Append to temporary chat history
    this._chat.add("temporary", {
      role: "user",
      content: prompt
    });

    // Check if the user has entered the !auto special prompt
    const autoPilotMatch = prompt.match(/^!auto (\d+)$/);
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
      // Ensure the chat fits within the LLM's context window
      // before we make an API call, ensuring we don't overflow
      await this._chat.fitToContextWindow();

      this._logger.spinner.start();

      const completion = await this._openai.createChatCompletion({
        messages: this._chat.messages,
        functions: functionDescriptions,
        temperature: 0,
        max_tokens: Number(env().OPENAI_API_KEY)
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
    if (this._autoPilotMode) {
      const functionCallStr =
        `\`\`\`\n${functionCall.name} (${functionCall.arguments})\n\`\`\`\n`;
      this._logger.notice("> Running in AutoPilot mode \n");
      this._logger.info(
        `Automatically executing the following function:\n\n${functionCallStr}`
      );
      return true; // <== Always return true if in autopilot mode
    } else {
      const functionCallStr =
        `\`\`\`\n${functionCall.name} (${functionCall.arguments})\n\`\`\`\n`;
      const query =
        "Do you wish to execute the following function?\n\n" +
        `${functionCallStr}\n(Y/N)\n`;
      const response = await this._logger.question(query);
    
      return ["y", "Y", "yes", "Yes", "yy"].includes(response);
    }
  }
  

  private async _executeFunctionCall(
    functionCall: OpenAIFunctionCall
  ): Promise<void> {
    const name = functionCall.name!;
    const args = functionCall.arguments
    ? JSON.parse(functionCall.arguments)
    : undefined;

    const functionToCall = (functions(
      this._library, 
      this._client
    ) as any)[name];
    
    const response = await functionToCall(args);

    this._executedLastIteration = true;

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

    if (name === "LearnWrap") {
      const wrapDescription = this._knownWraps[args?.name];

      this._chat.add("persistent", {
        role: "system",
        content: `Loaded Wrap: ${args.name}\nDescription: ${wrapDescription}`
      });
      this._chat.add("temporary", message);
      this._logger.success(`\n> 🧠 Learnt a wrap: ${args?.name}\n> Description: ${wrapDescription["description"]} \n> Repo: ${wrapDescription["repo"]}\n`);
    } else {
      this._chat.add("temporary", message);
      this._logger.action(message);
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

  private async _executeFunctionIfExists(
    functionCall: OpenAIFunctionCall
  ): Promise<void> {
    const name = functionCall.name!;
    const functionToCall = (functions(
      this._library, 
      this._client
    ) as any)[name];
  
    if (typeof functionToCall !== 'function') {
      this._logMessage("system", `The model tried to execute a function (${name}) which is not defined in PolyGPT, only "LearnWrap" and "InvokeWrap" can be called.`);
      // Set the flag to ask the model again
      this._executedLastIteration = true;
      return;
    }
  
    // Prompt for approval, execute the function, and handle the response.
    const confirmation = await this._askUserForConfirmation(functionCall);
    if (confirmation) {
      await this._executeFunctionCall(functionCall);
    } else {
      this._executeNoop(functionCall);
      this._executedLastIteration = false;
    }
  }
  
}

