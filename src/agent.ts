
import chalk from "chalk";
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();
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
  prettyPrintError,
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
  private _initializationMessages: ChatCompletionRequestMessage[] = [];
  private _loadwrapData: ChatCompletionRequestMessage[] = [];
  private _chatInteractions: ChatCompletionRequestMessage[] = [];

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
    agent._initializationMessages.push(...messages);

    // Load the summary from 'summary.md'
    if (fs.existsSync('summary.md')) {
      const summaryContent = fs.readFileSync('summary.md', 'utf-8');
      const summaryMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: summaryContent,
      }
      agent._initializationMessages.push(summaryMessage);
    }

    logToFile({
      role: "system",
      content: `>> Initializing Agent...`
    })
    console.log(chalk.yellow(`>> Initializing Agent...`));
    await agent._openai.createChatCompletion({
      model: process.env.GPT_MODEL!,
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
  async summarizeHistory(): Promise<ChatCompletionRequestMessage> {
    try {
      let summarizationRequest: ChatCompletionRequestMessage = {
        role: "system",
        content: `
        You are PolyGPT, a model capable of invoking wrap functions and perform a wide range of tasks that ChatGPT couldnt do before. Please make a concise summary plan of execution considering all of the previous interactions and keep track of all relevant information and key data to be used by you again in the future.`
      }
      const messages = [...this._chatInteractions, summarizationRequest];
      
      const completion = await this._openai.createChatCompletion({
        model: process.env.GPT_MODEL!,
        messages,
        temperature: 0,
        max_tokens: 300
      });

      // Write the summary to 'summary.md'
      fs.writeFile('summary.md', completion.data.choices[0].message?.content!, (err) => {
        if (err) {
          throw err;
        }
      });

      this._chatInteractions = [];

      return completion.data.choices[0].message!;
    } catch (error: any) {
      const errorMessage = `Error: ${JSON.stringify(error?.response?.data, null, 2)}`;
      console.error(chalk.red('Error: '), chalk.yellow(errorMessage));
      logToFile({
        role: "system",
        content: errorMessage
      });
      throw error;
    }
}


  async processUserPrompt(userInput: string) {
    // Save user input to chat interactions
    const userMessage: ChatCompletionRequestMessage = {
      role: "user",
      content: userInput
    };
    this._chatInteractions.push(userMessage);
  
    // Log the user input to file
    logToFile(userMessage);
  
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
        logToFile(assistantResponse)
  
        console.log('Assistant:', chalk.blue(resultContent ?? ""));
      } else {
        const message: ChatCompletionRequestMessage = {
          role: "assistant",
          content: "Alright. Will not execute this function",
        }
    
        this._chatInteractions.push(message);
        console.log('Assistant:',chalk.blue(message.content ?? ""));
        logToFile(message)
      }
    } else {
      const responseMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: response?.content!,
      }
  
      // Save assistant's response to chat interactions
      this._chatInteractions.push(responseMessage);
  
      // Log the assistant's response to file
      logToFile(responseMessage)
  
      console.log('Assistant:', chalk.blue(responseMessage.content ?? ""));
    }
  }
  

  saveChatHistoryToFile(filename: string) {
    const combinedChatHistory = [
      ...this._chatHistory, 
      ...this._loadwrapData.map(data => ({ role: data.role, content: data.content }))
    ];
  
    const chatHistoryStr = combinedChatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n');
    fs.writeFileSync(filename, chatHistoryStr, 'utf-8');
    console.log(chalk.green(`Chat history saved to ${filename}`));
  }
  
  getUserInput(): Promise<string> {
    return new Promise((res) => {
      readline.question(`Prompt: `, async (userInput: string) => res(userInput))
    });
  }
  
  
  async sendMessageToAgent(
    message: string
  ): Promise<ChatCompletionResponseMessage> {
    try {
      this._chatHistory.push({ role: "user", content: message });
  
      let messages = [...this._initializationMessages, ...this._loadwrapData, ...this._chatInteractions];
  
      // Calculate the total tokens in all messages
      const totalTokens = messages.reduce((total, msg) => total + this.countTokens(msg.content!), 0);
      console.log(' total tokens: ', totalTokens) 
      console.log(' total messages: ', messages.length)
      if (totalTokens > Number(process.env.ROLLING_SUMMARY_WINDOW!)) {
        console.log('Assistant:', chalk.yellow("Summarizing the chat as the total tokens exceeds the current limit..."));
  
        // Use the summary function
        const summary = await this.summarizeHistory();
        let messages = [...this._initializationMessages, ...this._loadwrapData, summary, message];
      }
  
      const completion = await this._openai.createChatCompletion({
        model: process.env.GPT_MODEL!,
        messages,
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
  
  // Utility function to count the tokens in a string
  countTokens(text: string): number {
    return text.split(' ').length;  // Very basic token counting, may not be accurate for all languages
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
      this._chatInteractions.push(message);  // Add error message to chat interactions
      this._chatHistory.push(message);
      logToFile(message);  // log to file when out of attempts
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
      console.log(chalk.red(errorMessage));
  
      const systemMessage: ChatCompletionRequestMessage = {
        role: "system",
        content: errorMessage,
      };
      
      // Logging error message to the file
      logToFile(systemMessage);
      
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
      const message: ChatCompletionRequestMessage = {
        role: "function",
        name: functionName,
        content: `Args: ${JSON.stringify(functionArgs, null, 2)}. Result: ${JSON.stringify(functionResponse.result, null, 2)}`,
      };
  
      if (functionName === "LoadWrap") {
        this._loadwrapData = this._loadwrapData.filter(entry => entry.name !== "LoadWrap")
        this._loadwrapData.push(message);
        return { role: "assistant", content: `Wrap loaded` }
      }
  
      this._chatInteractions.push(message);  // Add function result to chat interactions
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
      await agent.processUserPrompt(userInput);
      agent.saveChatHistoryToFile('chat-history.txt');
    }
  } catch (e) {
    prettyPrintError(e)
  }
})()

