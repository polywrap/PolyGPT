import { PolywrapClient, PolywrapClientConfigBuilder } from "@polywrap/client-js";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionResponseMessage,
  Configuration,
  OpenAIApi,
} from "openai";
import axios from "axios"
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

interface WrapsIndex {
  wraps: string[];
}

export interface WrapInfoDTO {
  aliases: string[];
  description: string;
  uri: string;
  abi: string;
  examplePrompts: {
    prompt: string;
    result: {
      uri: string;
      method: string;
      args: Record<string, any>;
    }
  }[]
}

interface WrapInfo extends WrapInfoDTO {
  name: string;
}

export const WRAPS_LIBRARY_URL = `https://raw.githubusercontent.com/polywrap/agent-wrap-library/master/wraps`

const getWrapsIndex = async (): Promise<WrapsIndex> => {
  const response = await axios.get<WrapsIndex>(`${WRAPS_LIBRARY_URL}/index.json`)

  return response.data
}

const getWrapInfos = async (wrapNames: string[]): Promise<WrapInfo[]> => {
  return Promise.all(wrapNames.map(async (wrapName) => {
    const response = await axios.get<WrapInfoDTO>(`${WRAPS_LIBRARY_URL}/${wrapName}.json`)
    const wrapInfo = response.data

    return {
      ...wrapInfo,
      name: wrapName,
    }
  }))
}


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
    console.log("Fetching wraps library...")

    const availableWraps = await getWrapsIndex()

    console.log(`Available wraps: ${availableWraps.wraps.map(w => `\n- ${w}`)}\n`)

    console.log(`Fetching wrap training data...`)
    const wrapInfos = await getWrapInfos(availableWraps.wraps)
    const wrapInfosString = JSON.stringify(wrapInfos, null, 2); // Convert wrapInfos to a string

    const agent = new Agent()

    const messages: ChatCompletionRequestMessage[] = [{
      role: "system",
      content: `Your name is PolyGPT. 
      You have a set of wraps which are groups of methods that you can call on demand.
      First you need to map what a user wants to do to a wrap. Each wrap has its own distinct "uri". Each method that you try to invoke from the same wrap,
      will have the same "uri". In order to know the methods available from this wrap and the args they require, you will need to call LoadWrapper and pass
      the wrapper name to it. This will return a GraphQL schema string, which describes the wrap's data types. Available methods and their signatures are always listed here inside of the
      'Module' type.
      
      Then you need to select a method to invoke, from the ones that the selected wrap has; based on the user's intention.
      Finally you will call InvokeWrap. InvokeWrap requires 3 arguments: a uri, which will be the selected wrapper's uri; a method, which will be
      name of the method you selected for invocation from the ones available from the chosen wrapper, and an optional "args" which is a json that
      varies according to the method's signature. You will map the user's given arguments to the "args" property if the method requires it`},
    {
      role: "system",
      content: `I will now give you a list of JSONs that contain information on the available wraps that exist for you to call InvokeWrap with. Each JSON
      contains:
      - name: human readable name to identify the wrap
      - description: description of what the wrap is for, and what it can do
      - aliases: alternative names for the wrap
      - uri: the uri you will use for InvokeWrap if you decide to invoke this wrap
      - examplePrompts: array of example prompts a user can give you when wanting to use this wrap, and the 'InvokeWrap' arguments that should result from it.
      
      Here are the JSONs:
      
      ${wrapInfosString}`
    },
    {
      role: "system", content: `You will now be transferred to your next user. They will give you an input in natural language and you will attempt to execute InvokeWrap
    based on the prompt if the users wants to do something. You will also be able to answer questions without executing InvokeWrap`},
    ]

    console.log(`Initializing Agent...`)
    const response = await agent._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages,
      functions: functionsDescription,
      function_call: "auto",
      temperature: 0
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
      temperature: 0
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

      if (functionName === "LoadWrap") {
        this._chatHistory = this._chatHistory.filter(entry => entry.name !== "LoadWrap")
      }
      
      this._chatHistory.push(message);

      if (functionName === "LoadWrap") {
        return { role: "assistant", content: `Wrap loaded` }
      }

      return message;
    }
  }
}

(async () => {
  const agent = await Agent.createAgent();
  agent.promptForUserInput();
})()