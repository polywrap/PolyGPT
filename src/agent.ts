import { InvokeOptions, PolywrapClient, PolywrapClientConfigBuilder } from "@polywrap/client-js";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionRequestMessageRoleEnum,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import dotenv from "dotenv";
import { functionsDescription, functionsMap } from "./functions";

dotenv.config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});


class Agent {
  private _openai = new OpenAIApi(configuration);
  private _client: PolywrapClient;
  private _chatHistory: ChatCompletionRequestMessage[] = [];

  private constructor() {
    const config = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys")
      .build()

    this._client = new PolywrapClient(config)
  }

  static async createAgent(): Promise<Agent> {
    console.log("Initializing agent...")
    const agent = new Agent()

    const messages: ChatCompletionRequestMessage[] = [{
      role: "system",
      content: `Your name is PolyGPT. 
      You have a set of wraps which are groups of functions that you can call on demand.
      First you need to call the function GetWrapLibrary, then GetFunctionFromWrap and finally InvokeWrap. 
        1.GetWrapLibrary should return a list of unique string identifiers for each wrap possible; 
          each string identifier will be called Uri. 
        2.GetFunctionFromWrap will select one of the functions from the selected wrap. 
        3.Finally, InvokeWrap will execute the selected function from the previous step and map user 
          input to the selected function's arguments.

      When using InvokeWrap, don't add any optional args by default, unless you're sure the user gave them to you.
      
      You will respond with 'Acknowledged' and you will have to solve problems with your LLM knowledge`},
    {role: "assistant", content: "Acknowledged"}, 
    {role: "system", content: `You will now be transferred to your next user. They will give you an input in natural language,
      and you should use your wrap functions when needed`},  
  ]

    await agent._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages,
      functions: functionsDescription,
      function_call: "auto",
    });

    agent._chatHistory.push(...messages);
    console.log("Agent initialized.")

    return agent
  }

  promptForUserConfirmation(proposedFunction: ChatCompletionRequestMessageFunctionCall) {
    return readline.question(
      `Do you wish to execute the following function?

    Name: ${proposedFunction.name}
    Arguments: ${proposedFunction.arguments}

    (Y/N)
  `,
      async (userInput: string) => {
        if (userInput === "Y" || userInput === "y") {
          const result = await this.executeProposedFunction(
            proposedFunction
          );
          console.log(result.content);

          return this.promptForUserInput();
        }

        this._chatHistory.push({
          role: "assistant",
          content: "Alright. Will not execute this function",
        });
        return this.promptForUserInput();
      }
    );
  }

  promptForUserInput() {
    readline.question("Human feedback: ", async (userInput: string) => {
      try {
        if (userInput === "history") {
          console.log(this._chatHistory)
          return this.promptForUserInput()
        }

        const response = await this.sendMessageToAgent(userInput);
        const proposedFunction = this.processAgentResponse(response!);

        if (proposedFunction) {
          this.promptForUserConfirmation(proposedFunction)
        } else {
          this._chatHistory.push({
            role: "assistant",
            content: response?.content!,
          });

          return this.promptForUserInput();
        }
      } catch (e) {
        console.log(e);
      }
    });
  }

  async sendMessageToAgent(
    message: string
  ): Promise<ChatCompletionResponseMessage | undefined> {
    this._chatHistory.push({ role: "user", content: message });

    const completion = await this._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages: this._chatHistory,
      functions: functionsDescription,
      function_call: "auto",
    });

    return completion.data.choices[0].message;
  }

  processAgentResponse(
    response: ChatCompletionResponseMessage
  ): ChatCompletionRequestMessageFunctionCall | undefined {
    if (response.function_call) {
      // todo: add function calling to history for better memory management
      return response.function_call;
    } else {
      console.log("-> No function call used");
      console.log("Assistant: ", response.content);
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

    const functionResponse = await functionsMap[functionName](
      this._client,
      functionArgs
    );

    console.log(functionResponse)

    if (!functionResponse.ok) {
      console.log(
        `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}. Retrying.... Attempts left: ${attemptsRemaining}`
      );
      const response = (await this.sendMessageToAgent(
        `The last attempt was unsuccessful. This is the error message: ${functionResponse.error}`
      ))!;
      const proposedFunction = this.processAgentResponse(response);

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
      this._chatHistory.push(message);
      return message;
    }
  }
}

(async () => {
  const agent = await Agent.createAgent();
  agent.promptForUserInput();
})()