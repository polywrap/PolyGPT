import { IWrapPackage, PolywrapClient, PolywrapClientConfigBuilder } from "@polywrap/client-js";
import { Wallet } from "ethers"
import * as EthProvider from "@polywrap/ethereum-provider-js";
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageFunctionCall,
  ChatCompletionResponseMessage,
  OpenAIApi,
} from "openai";
import { functionsDescription, functionsMap } from "./functions";
import { OPEN_AI_CONFIG } from "./constants";
import { getWrapInfos, getWrapsIndex, readline } from "./utils";
import { logToFile } from "./logger";

class Agent {
  private _openai = new OpenAIApi(OPEN_AI_CONFIG);
  private _client: PolywrapClient;
  private _chatHistory: ChatCompletionRequestMessage[] = [];

  private constructor() {
    const config = new PolywrapClientConfigBuilder()
      .addBundle("web3")
      .addBundle("sys")
      .setPackage(
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
      )
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
    await agent._openai.createChatCompletion({
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

  promptForUserConfirmation(proposedFunction: ChatCompletionRequestMessageFunctionCall): Promise<boolean> {
    const confirmationPrompt = `Do you wish to execute the following function?\n\n${proposedFunction.name} (${proposedFunction.arguments})\n\n(Y/N)\n`
    logToFile({
      role: "assistant",
      content: confirmationPrompt
    })
    return new Promise((res) => {
      readline.question(
        confirmationPrompt,
        async (userInput: string) => {
          logToFile({
            role: "user",
            content: userInput
          })
          return res(userInput === "Y" || userInput === "y")
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
        console.log(resultContent);
      } else {
        const message: ChatCompletionRequestMessage = {
          role: "assistant",
          content: "Alright. Will not execute this function",
        }
  
        this._chatHistory.push(message);
        console.log(message.content)
        logToFile(message)
      }
    } else {
      const responseMessage: ChatCompletionRequestMessage = {
        role: "assistant",
        content: response?.content!,
      }

      logToFile(responseMessage)
      this._chatHistory.push(responseMessage);
    }
  }

  getUserInput(): Promise<string> {
    return new Promise((res) => {
      readline.question(`Prompt: `, async (userInput: string) => res(userInput))
    });
  }

  async sendMessageToAgent(
    message: string
  ): Promise<ChatCompletionResponseMessage> {
    this._chatHistory.push({ role: "user", content: message });

    const completion = await this._openai.createChatCompletion({
      model: "gpt-3.5-turbo-0613",
      messages: this._chatHistory,
      functions: functionsDescription,
      function_call: "auto",
      temperature: 0
    });

    return completion.data.choices[0].message!;
  }

  checkIfFunctionWasProposed(
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