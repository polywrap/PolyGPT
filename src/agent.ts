
import chalk from "chalk";

import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionResponseMessage,
  OpenAIApi,
} from "openai";
import { PolywrapClient, PolywrapClientConfigBuilder, IWrapPackage } from "@polywrap/client-js";
import * as EthProvider from "@polywrap/ethereum-provider-js";
import { Wallet } from "ethers"

import { WrapLibrary } from "./wrap-library";
import { functionsDescription, functionsMap } from "./open-ai-functions";
import {
  logToFile,
  readline,
  logHeader,
  OPEN_AI_CONFIG,
  WRAP_LIBRARY_URL,
  WRAP_LIBRARY_NAME
} from "./utils";
import { systemPrompts } from "./prompt";

export class Agent {
  private _openai = new OpenAIApi(OPEN_AI_CONFIG);
  private _library = new WrapLibrary.Reader(WRAP_LIBRARY_URL, WRAP_LIBRARY_NAME);
  private _client: PolywrapClient;
  private _chatHistory: ChatCompletionRequestMessage[] = [];

  private constructor() {
    const builder = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys");

    if (process.env.ETHEREUM_PRIVATE_KEY) {
      builder.setPackage(
        "plugin/ethereum-provider@2.0.0",
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
        }) as IWrapPackage
      );
    }

    const config = builder.build();

    this._client = new PolywrapClient(config)
  }

  static async createAgent(): Promise<Agent> {
    const agent = new Agent();
    logHeader();
    console.log(chalk.yellow(">>Fetching wraps library..."));

    const availableWraps = await agent._library.getIndex()

    console.log(`Available wraps: `);
    console.table(availableWraps);
    logToFile({
      role: "system",
      content: `Available wraps: ${JSON.stringify(availableWraps, null, 2)}`
    });


    console.log(chalk.yellow(`>> Fetching wrap training data...`));
    const wrapInfos = await agent._library.getWraps(availableWraps.wraps);
    const wrapInfosString = JSON.stringify(wrapInfos, null, 2); // Convert wrapInfos to a string

    // Load the initialization prompts
    const initialization_messages = systemPrompts(wrapInfosString);
    const messages: ChatCompletionRequestMessage[] = initialization_messages
    logToFile({
      role: "system",
      content: `>> Initializing Agent...`
    })
    console.log(chalk.yellow(`>> Initializing Agent...`));
    await agent._openai.createChatCompletion({
      model: "gpt-4-0613",
      messages,
      functions: functionsDescription,
      function_call: "auto",
      temperature: 0
    });

    agent._chatHistory.push(...messages);
    console.log(chalk.yellow(">> Agent initialized."))

    return agent
  }


  promptForUserConfirmation(proposedFunction: ChatCompletionRequestMessageFunctionCall): Promise<boolean> {
    const confirmationText = `Do you wish to execute the following function?\n\n${proposedFunction.name} (${proposedFunction.arguments})\n\n(Y/N)\n`;
    const confirmationPrompt = chalk.cyan(confirmationText);
    logToFile({
      role: "assistant",
      content: confirmationText
    })
    return new Promise((res) => {
      readline.question(
        confirmationPrompt,
        async (userInput: string) => {
          logToFile({
            role: "user",
            content: userInput
          })
          return res(userInput === "Y" || userInput === "y");
        }
      )
    });
  }

  async processUserPrompt(userInput: string) {
    logToFile({
      role: "user",
      content: userInput
    })
    const response = await this.sendMessageToAgent(userInput);
    const proposedFunction = this.checkIfFunctionWasProposed(response!);

    if (proposedFunction) {
      const userConfirmedExecution = await this.promptForUserConfirmation(proposedFunction)

      if (userConfirmedExecution) {
        const result = await this.executeProposedFunction(
          proposedFunction
        );

        const resultContent = result.content

        logToFile({
          role: "assistant",
          content: resultContent
        })
        console.log('Assistant:', chalk.blue(resultContent ?? ""));
      } else {
        const message: ChatCompletionRequestMessage = {
          role: "assistant",
          content: "Alright. Will not execute this function",
        }
  
        this._chatHistory.push(message);
        console.log('Assistant:',chalk.blue(message.content ?? ""));
        logToFile(message)
      }
    } else {
      const responseMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: response?.content!,
      }

      logToFile(responseMessage)
      this._chatHistory.push(responseMessage);
      console.log('Assistant:', chalk.blue(responseMessage.content ?? ""));
    }
  }

  getUserInput(): Promise<string> {
    return new Promise((res) => {
      readline.question(`Prompt: `, async (userInput: string) => res(userInput))
    });
  }async sendMessageToAgent(
    message: string
  ): Promise<ChatCompletionResponseMessage> {
    try {
      this._chatHistory.push({ role: "user", content: message });
  
      const completion = await this._openai.createChatCompletion({
        model: "gpt-4-0613",
        messages: this._chatHistory,
        functions: functionsDescription,
        function_call: "auto",
        temperature: 0
      });
  
      return completion.data.choices[0].message!;
    } catch (error: any) {  // specify error type as any to fix TypeScript error
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      console.error(chalk.red('Error: '), chalk.yellow(errorMessage));
      logToFile({
        role: "system",
        content: errorMessage
      });
      throw error;  // Re-throwing the error in case it needs to be caught elsewhere
    }
}

  checkIfFunctionWasProposed(
    response: ChatCompletionResponseMessage
  ): ChatCompletionRequestMessageFunctionCall | undefined {
    if (response.function_call) {
      // todo: add function calling to history for better memory management
      return response.function_call;
    } else {
      //console.log(chalk.yellow("-> No function call used"));
      this._chatHistory.push({ role: "assistant", content: response.content! });
    }
  }

  async executeProposedFunction(
    functionProposed: ChatCompletionRequestMessageFunctionCall,
    attemptsRemaining = 5
  ): Promise<ChatCompletionResponseMessage> {
    if (attemptsRemaining == 0) {
      const message: ChatCompletionRequestMessage = {
        role: "assistant",
        content: "Sorry, couldn't process your request",
      };
      this._chatHistory.push(message);
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
  
      console.log(chalk.red(`The last attempt was unsuccessful. This is the error message: ${functionResponse.error}. Retrying.... Attempts left: ${attemptsRemaining}`));

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
      const message: ChatCompletionRequestMessage = {
        role: "function",
        name: functionName,
        content: `Args: ${JSON.stringify(functionArgs, null, 2)}. Result: ${JSON.stringify(functionResponse.result, null, 2)}`,
      };

      if (functionName === "LoadWrap") {
        this._chatHistory = this._chatHistory.filter(entry => entry.name !== "LoadWrap")
        this._chatHistory.push(message);
        return { role: "assistant", content: `Wrap loaded` }
      }

      this._chatHistory.push(message);
      return message;
    }
  }
}

(async () => {
  try {
    const agent = await Agent.createAgent();

    while (true) {
      const userInput = await agent.getUserInput();
      await agent.processUserPrompt(userInput)
    }
  } catch (e) {
    console.log(e)
  }
})()
