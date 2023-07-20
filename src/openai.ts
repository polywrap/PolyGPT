import {
  ChatCompletionRequestMessage,
  ChatCompletionResponseMessage,
  ChatCompletionRequestMessageFunctionCall,
  Configuration,
  OpenAIApi
} from "openai";

export {
  ChatCompletionResponseMessage as OpenAIResponse,
  ChatCompletionRequestMessageFunctionCall as OpenAIFunctionCall
};

export class OpenAI {
  private _configuration: Configuration;
  private _api: OpenAIApi;

  constructor(
    private _apiKey: string,
    private _defaultModel: string
  ) {
    this._configuration = new Configuration({
      apiKey: this._apiKey
    });
    this._api = new OpenAIApi(this._configuration);
  }

  createChatCompletion(options: {
    messages: ChatCompletionRequestMessage[];
    model?: string;
    functions?: any;
    temperature?: number
    max_tokens?: number
  }) {
    console.log("HERERERE");
    return this._api.createChatCompletion({
      messages: options.messages,
      model: options.model || this._defaultModel,
      functions: options.functions,
      function_call: options.functions ? "auto" : undefined,
      temperature: options.temperature || 0,
      max_tokens: options.max_tokens
    });
  }
}
