
import chalk from "chalk";
import dotenv from 'dotenv';
import fs from 'fs';
const clui = require('clui');
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionResponseMessage,
  OpenAIApi,
} from "openai";
import { PolywrapClient, PolywrapClientConfigBuilder, IWrapPackage } from "@polywrap/client-js";
import * as EthProvider from "@polywrap/ethereum-provider-js";
import { dateTimePlugin } from "@polywrap/datetime-plugin-js";

import { Wallet } from "ethers"

import { WrapLibrary } from "./wrap-library";
import { functionsDescription, functionsMap } from "./open-ai-functions";
import {
  logToFile,
  readline,
  logHeader,
  countTokens,
  prettyPrintError,
  saveChatHistoryToFile,
  OPEN_AI_CONFIG,
  WRAP_LIBRARY_URL,
  WRAP_LIBRARY_NAME
} from "./utils";
import { systemPrompts, autopilotPrompt} from "./prompt";
import { summarizeHistory, memoryPath } from "./memory";

let spinner = new clui.Spinner('Thinking...');
const debugMode = process.argv.includes('--debug');


dotenv.config();
export class Agent {
  private _openai = new OpenAIApi(OPEN_AI_CONFIG);
  private _library = new WrapLibrary.Reader(WRAP_LIBRARY_URL, WRAP_LIBRARY_NAME);
  private _client: PolywrapClient;
  private _autoPilotCounter = 0;
  private _autopilotMode = false;
  public _chatHistory: ChatCompletionRequestMessage[] = [];
  public _initializationMessages: ChatCompletionRequestMessage[] = [];
  public _loadwrapData: ChatCompletionRequestMessage[] = [];
  public _chatInteractions: ChatCompletionRequestMessage[] = [];
  
  private constructor() {
    const builder = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys")
      //.setPackage("wrap://ens/datetime.polywrap.eth", dateTimePlugin({}) as IWrapPackage,)
      ;

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
    console.log(chalk.yellow(">> Fetching wraps library..."));

    const availableWraps = await agent._library.getIndex();
    
    console.log("SYSTEM: Cataloging all wraps in the library...");
    console.log(`URL: ${WRAP_LIBRARY_URL}`);
    console.table(availableWraps);
    
    logToFile({
      role: "system",
      content: `Cataloging all wraps in the library:\n\nWrap Library URL: ${WRAP_LIBRARY_URL}\n\n\`\`\`\n${JSON.stringify(availableWraps, null, 2)}\n\`\`\``
    });
    
    console.log(chalk.yellow(`>> Fetching wrap training data...`));
    const wrapInfos = await agent._library.getWraps(availableWraps.wraps);
    const wrapInfosString = JSON.stringify(wrapInfos, null, 2); // Convert wrapInfos to a string


    // Ask user for main goal and save as a chat message
    const userGoal = await new Promise<string>((resolve) => {
      readline.question('Please enter your main goal: ', (goal:string) => {
        resolve(goal);
      });
    });

    logToFile({
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


    // Load the summary from 'summary.md'
    if (debugMode) {
      console.log('Current working directory:', process.cwd());
      console.log('File exists:', fs.existsSync(memoryPath));
      console.log(memoryPath)
    }
    
    if (fs.existsSync(memoryPath)) {
      console.log(chalk.yellow(`>> Loaded Memory...`));
      const summaryContent = fs.readFileSync(memoryPath, 'utf-8');
      const summaryMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: summaryContent,
      };
      agent._initializationMessages.push(summaryMessage);
      messages = [...agent._initializationMessages, ...agent._loadwrapData, ...agent._chatInteractions];
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
    if (this._autopilotMode) {
      console.log(chalk.yellow('>> Running on Autopilot mode'))

    const automationText = `About to execute the following function\n\n${proposedFunction.name} (${proposedFunction.arguments})\n\n(Y/N)\n`;
    console.log(chalk.cyan(automationText))
    logToFile({
      role: "assistant",
      content: "\n```\n"+ automationText+ "\n```\n"
    })
      return Promise.resolve(true);
    }
  
    const confirmationText = "Do you wish to execute the following function?\n\n```" + `${proposedFunction.name} (${proposedFunction.arguments})`+"\n```\n\n(Y/N)\n";
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
      userInput = `Please continue with the next step in the plan.`;
    }
  
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
      readline.question(`Prompt: `, async (userInput: string) => res(userInput))
    });
  }
  
  async sendMessageToAgent(message: string): Promise<ChatCompletionResponseMessage> {
    spinner.start();
  
    try {
      this._chatHistory.push({ role: "user", content: message });
  
      let messages = [...this._initializationMessages, ...this._loadwrapData, ...this._chatInteractions];
  
      // Calculate the total tokens in all messages
      const totalTokens = messages.reduce((total, msg) => total + countTokens(msg.content!), 0);
      if (debugMode) {
        console.log('Total tokens:', totalTokens);
        console.log('Total messages:', messages.length);
      }
  
      if (totalTokens > Number(process.env.ROLLING_SUMMARY_WINDOW!)) {
        console.log('Assistant:', chalk.yellow(">> Summarizing the chat as the total tokens exceeds the current limit..."));
  
        // Use the summary function
        const summary = await summarizeHistory(this._chatInteractions, this._openai);
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
      console.error(chalk.red('Error: '), chalk.yellow(errorMessage));
      logToFile({
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
      // todo: add function calling to history for better memory management
      return response.function_call;
    } else {
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
        content: "\n```" + errorMessage + "\n```\n",
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
        content: `Args:\n\`\`\`json\n${JSON.stringify(functionArgs, null, 2)}\n\`\`\`\nResult:\n\`\`\`json\n${JSON.stringify(functionResponse.result, null, 2)}\n\`\`\``,
      };
  
      if (functionName === "LoadWrap") {
        this._loadwrapData = this._loadwrapData.filter(entry => entry.name !== "LoadWrap")
        this._loadwrapData.push(message);
        return { role: "assistant", content: `Wrap loaded  ${JSON.stringify(functionArgs, null, 2)}` }
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
      saveChatHistoryToFile(agent);
    }
  } catch (e) {
    prettyPrintError(e)
  }
})()


