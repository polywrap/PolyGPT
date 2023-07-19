import { Memory } from "./memory";
import { Workspace } from "./workspace";
import {
  functionsDescription,
  functionsMap
} from "./open-ai-functions";
import {
  systemPrompts,
  autopilotPrompt
} from "./prompt";
import {
  Logger,
  readline,
  countTokens,
  chunkAndProcessMessages,
  OPEN_AI_CONFIG,
  WRAP_LIBRARY_URL,
  WRAP_LIBRARY_NAME,
  spinner
} from "./utils";
import {
  WrapLibrary
} from "./wrap-library";

import chalk from "chalk";
import dotenv from "dotenv";
import { Wallet } from "ethers"
import fs from "fs";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionResponseMessage,
  OpenAIApi,
} from "openai";
import {
  PolywrapClient,
  PolywrapClientConfigBuilder,
  IWrapPackage
} from "@polywrap/client-js";
import { dateTimePlugin } from "@polywrap/datetime-plugin-js";
import * as EthProvider from "@polywrap/ethereum-provider-js";

dotenv.config();

export interface AgentConfig {
  debugMode?: boolean;
  reset?: boolean;
}

export class Agent {
  private _memory: Memory;
  private _workspace: Workspace;
  private _logger: Logger = new Logger();

  private _openai = new OpenAIApi(OPEN_AI_CONFIG);
  private _library = new WrapLibrary.Reader(WRAP_LIBRARY_URL, WRAP_LIBRARY_NAME);
  private _client: PolywrapClient;
  private _autoPilotCounter = 0;
  private _autopilotMode = false;
  private _chatHistory: ChatCompletionRequestMessage[] = [];
  private _initializationMessages: ChatCompletionRequestMessage[] = [];
  private _loadwrapData: ChatCompletionRequestMessage[] = [];
  private _chatInteractions: ChatCompletionRequestMessage[] = [];

  private constructor(private _config: AgentConfig = {}) {
    this._workspace = new Workspace();
    this._memory = new Memory(this._workspace);

    if (this._config.reset) {
      this._memory.reset();
    }

    const builder = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys")

    if (process.env.ETHEREUM_PRIVATE_KEY) {
      builder.setPackages({

        "plugin/datetime":
          dateTimePlugin({}) as IWrapPackage,

        "plugin/ethereum-provider@2.0.0":
          EthProvider.plugin({
            connections: new EthProvider.Connections({
              networks: {
                goerli: new EthProvider.Connection({
                  signer: new Wallet(process.env.ETHEREUM_PRIVATE_KEY as string),
                  provider:
                    "https://goerli.infura.io/v3/b00b2c2cc09c487685e9fb061256d6a6",
                }),
              },
              defaultNetwork: "goerli"
            }),
          }) as IWrapPackage}
      );
    }

    const config = builder.build();

    this._client = new PolywrapClient(config)
  }

  private log(infoOrMsg: string | ChatCompletionRequestMessage): void {
    if (typeof infoOrMsg === "string") {
      this._logger.info(infoOrMsg);
    } else {
      this._logger.logMessage(infoOrMsg);
    }
  }

  private error(msg: string): void {
    this._logger.error(msg);
  }

  static async create(config: AgentConfig = {}): Promise<Agent> {
    const agent = new Agent(config);
    agent._logger.logHeader();
    agent.log(chalk.yellow(">> Fetching wraps library..."));

    const availableWraps = await agent._library.getIndex();

    agent.log("SYSTEM: Cataloging all wraps in the library...");
    agent.log(`URL: ${WRAP_LIBRARY_URL}`);

    agent.log({
      role: "system",
      content: `Cataloging all wraps in the library:\n\nWrap Library URL: ${
        WRAP_LIBRARY_URL}\n\n\`\`\`\n${JSON.stringify(availableWraps, null, 2)}\n\`\`\``
    });

    agent.log(chalk.yellow(`>> Fetching wrap training data...`));
    const wrapInfos = await agent._library.getWraps(availableWraps.wraps);
    const wrapInfosString = JSON.stringify(wrapInfos, null, 2);

    // Ask user for main goal and save as a chat message
    const userGoal = await new Promise<string>((resolve) => {
      readline.question("Please enter your main goal: ", (goal: string) => {
        resolve(goal);
      });
    });

    agent.log({
      role: "user",
      content: userGoal
    })
    const userGoalMessage: ChatCompletionRequestMessage = {
      role: "user",
      content: `The user has defined the following goal: ${userGoal}`,
    };

    // Load the initialization prompts
    const initialization_messages = systemPrompts(wrapInfosString);
    let messages: ChatCompletionRequestMessage[] = initialization_messages
    agent._initializationMessages.push(...messages);
    agent._initializationMessages.push(userGoalMessage);

    if (agent._config.debugMode) {
      agent.log("Current working directory: " + process.cwd());
      agent.log("File exists: " + fs.existsSync(agent._memory.memoryPath));
      agent.log(agent._memory.memoryPath)
    }

    if (fs.existsSync(agent._memory.memoryPath)) {
      agent.log(chalk.yellow(">> Loaded Memory..."));
      const summaryContent = fs.readFileSync(agent._memory.memoryPath, "utf-8");
      const summaryMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: summaryContent,
      };
      agent._initializationMessages.push(summaryMessage);
      messages = [...agent._initializationMessages, ...agent._loadwrapData, ...agent._chatInteractions];
    }

    agent.log({
      role: "system",
      content: ">> Initializing Agent..."
    });
    await agent._openai.createChatCompletion({
      model: process.env.GPT_MODEL!,
      messages,
      functions: functionsDescription,
      function_call: "auto",
      temperature: 0
    });

    agent._chatInteractions.push(...messages);
    agent.log(chalk.yellow(">> Agent initialized."))

    return agent
  }

  async run(): Promise<void> {
    try {
      while (true) {
        const userInput = await this.getUserInput();
        await this.processUserPrompt(userInput);
        this._memory.saveChatHistoryToFile([
          ...this._initializationMessages,
          ...this._loadwrapData,
          ...this._chatInteractions
        ], this._workspace);
      }
    } catch (e) {
      this._logger.prettyPrintError(e)
    }
  }

  promptForUserConfirmation(proposedFunction: ChatCompletionRequestMessageFunctionCall): Promise<boolean> {
    if (this._autopilotMode) {
      this.log(chalk.yellow(">> Running on Autopilot mode"))

      const automationText = `About to execute the following function\n\n${proposedFunction.name} (${proposedFunction.arguments})\n\n(Y/N)\n`;
      this.log({
        role: "assistant",
        content: "\n```\n" + automationText + "\n```\n"
      })
      return Promise.resolve(true);
    }

    const confirmationText = "Do you wish to execute the following function?\n\n```" + `${proposedFunction.name} (${proposedFunction.arguments})`+"\n```\n\n(Y/N)\n";
    const confirmationPrompt = chalk.cyan(confirmationText);
    this.log({
      role: "assistant",
      content: confirmationText
    })
    return new Promise((res) => {
      readline.question(
        confirmationPrompt,
        async (userInput: string) => {
          this.log({
            role: "user",
            content: userInput
          })
          return res(userInput === "Y" || userInput === "y" || userInput === "yy");
        }
      )
    });
  }

  async processUserPrompt(userInput: string): Promise<ChatCompletionRequestMessage | void> {
    // Check if the user has entered the autopilot command
    const autopilotMatch = userInput.match(/^auto -(\d+)$/);
    if (autopilotMatch) {
      this._autoPilotCounter = parseInt(autopilotMatch[1], 10);
      this._autopilotMode = true;
      userInput = "Entering autopilot mode. Please continue with the next step in the plan.";
    }

    // Save user input to chat interactions
    const userMessage: ChatCompletionRequestMessage = {
      role: "user",
      content: userInput
    };
    this._chatInteractions.push(userMessage);

    // Log the user input to file
    this.log(userMessage);

    const response = await this.sendMessageToAgent(userInput);
    const proposedFunction = this.checkIfFunctionWasProposed(response!);

    if (proposedFunction) {
      const userConfirmedExecution = await this.promptForUserConfirmation(proposedFunction)

      if (userConfirmedExecution) {
        const result = await this.executeProposedFunction(proposedFunction);

        const resultContent = result.content

        // Save assistant's response to chat interactions
        const assistantResponse: ChatCompletionRequestMessage = {
          role: "assistant",
          content: resultContent!
        };
        this._chatInteractions.push(assistantResponse);

        // Log the assistant's response to file
        this.log(assistantResponse)
      } else {
        const message: ChatCompletionRequestMessage = {
          role: "assistant",
          content: "Alright. Will not execute this function",
        }

        this._chatInteractions.push(message);
        this.log(message);
      }
    } else {
      const responseMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: response?.content!,
      }

      // Save assistant's response to chat interactions
      this._chatInteractions.push(responseMessage);

      // Log the assistant's response to file
      this.log(responseMessage)
    }

    // If in autopilot mode and there are remaining iterations, automatically re-prompt the user
    if (this._autopilotMode && this._autoPilotCounter > 0) {
      this._autoPilotCounter--;
      let autopilotAnswer: ChatCompletionRequestMessage | void = await this.processUserPrompt(autopilotPrompt);
      if (autopilotAnswer) {
        this._chatInteractions.push(autopilotAnswer);
      }
      return autopilotAnswer;
    } else if (this._autoPilotCounter === 0) {
      this._autopilotMode = false;
    }

    return undefined; 
  }

  getUserInput(): Promise<string> {
    return new Promise((res) => {
      readline.question("Prompt: ", async (userInput: string) => res(userInput))
    });
  }

  async sendMessageToAgent(message: string): Promise<ChatCompletionResponseMessage> {
    spinner.start();

    try {
      this._chatInteractions.push({ role: "user", content: message });

      let messages = [...this._initializationMessages, ...this._loadwrapData, ...this._chatInteractions];

      // Calculate the total tokens in all messages
      const totalTokens = messages.reduce((total, msg) => total + countTokens(msg.content!), 0);
      if (this._config.debugMode) {
        this.log("Total tokens: " +  totalTokens);
        this.log("Total messages: " +  messages.length);
      }

      if (totalTokens > Number(process.env.ROLLING_SUMMARY_WINDOW!)) {
        this.log("Assistant: " + chalk.yellow(">> Summarizing the chat as the total tokens exceeds the current limit..."));

        const summary = await this._memory.summarize(
          this._chatInteractions,
          this._openai,
          this._logger
        );
        this._chatInteractions = [];
        messages = [...this._initializationMessages, ...this._loadwrapData, summary, { role: "user", content: message }];
      }

      const completion = await this._openai.createChatCompletion({
        model: process.env.GPT_MODEL!,
        messages,
        functions: functionsDescription,
        function_call: "auto",
        temperature: 0,
        max_tokens: 500,
      });
      spinner.stop();
      return completion.data.choices[0].message!;
    } catch (error: any) {
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      this.error(chalk.red("Error: ") +  chalk.yellow(errorMessage));
      this.log({
        role: "system",
        content: errorMessage
      });

      spinner.stop();
      throw error;
    }
  }

  checkIfFunctionWasProposed(
    response: ChatCompletionResponseMessage
  ): ChatCompletionRequestMessageFunctionCall | undefined {
    if (response.function_call) {
      return response.function_call;
    } else {
      this._chatInteractions.push({ role: "assistant", content: response.content! });
      return undefined;
    }
  }

  async executeProposedFunction(
    functionProposed: ChatCompletionRequestMessageFunctionCall,
    attemptsRemaining = 5
  ): Promise<ChatCompletionResponseMessage> {
    // If out of attempts...
    if (attemptsRemaining == 0) {
      const message: ChatCompletionRequestMessage = {
        role: "assistant",
        content: "Sorry, couldn't process your request",
      };
      this._chatInteractions.push(message);
      this.log(message);
      return message;
    }

    const functionName = functionProposed.name!;
    const functionArgs = functionProposed.arguments
      ? JSON.parse(functionProposed.arguments)
      : undefined;

    const functionResponse = await functionsMap(this._library)[functionName](
      this._client,
      functionArgs
    );

    if (!functionResponse.ok) {
      const errorMessage = `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}. Retrying.... Attempts left: ${attemptsRemaining}`;
      this.log(chalk.red(errorMessage));

      const systemMessage: ChatCompletionRequestMessage = {
        role: "system",
        content: "\n```" + errorMessage + "\n```\n",
      };

      // Logging error message to the file
      this.log(systemMessage);

      // Add error message to chat interactions
      this._chatInteractions.push(systemMessage);  

      const response = (await this.sendMessageToAgent(
        `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}`
      ))!;
      const proposedFunction = this.checkIfFunctionWasProposed(response);

      if (proposedFunction) {
        return await this.executeProposedFunction(
          proposedFunction,
          attemptsRemaining - 1
        );
      }

      return response;
    } else {
      let messageContent = `Args:\n\`\`\`json\n${JSON.stringify(functionArgs, null, 2)}\n\`\`\`\nResult:\n\`\`\`json\n${JSON.stringify(functionResponse.result, null, 2)}\n\`\`\``;

      // Check if the message content is longer than CHUNKING_TOKENS, if so, apply chunking
      const tokenCount = countTokens(messageContent);
      if (tokenCount > Number(process.env.CHUNKING_TOKENS!)) {
        this.log("Found chunking opportunity for function response");

        // update messageContent with chunked and processed content
        const combinedResponse = await chunkAndProcessMessages(messageContent, this._openai, this._logger);
        messageContent = combinedResponse.content!;
      }

      const message: ChatCompletionRequestMessage = {
        role: "function",
        name: functionName,
        content: messageContent,
      };

      if (functionName === "LoadWrap") {
        this._loadwrapData = this._loadwrapData.filter(entry => entry.name !== "LoadWrap")
        this._loadwrapData.push(message);
        return { role: "assistant", content: `Wrap loaded  ${JSON.stringify(functionArgs, null, 2)}` }
      }

      // Add function result to chat interactions
      this._chatInteractions.push(message);
      this._chatHistory.push(message);
      return message;
    }
  }
}
