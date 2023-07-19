import { countTokens, gpt2 } from "./encoding";
import { Logger } from "./logger";
import { env } from "./env";
import { OpenAI } from "./openai";

import {
  ChatCompletionResponseMessage
} from "openai";

/**
 * This function divides a message into chunks of a specified size (in tokens), sends each chunk to the OpenAI API for completion,
 * and then combines and returns the responses.
 *
 * @param {string} message - The message to be chunked and sent to OpenAI.
 * @param {OpenAI} openai - An instance of the OpenAI API.
 * @param {Logger} logger - A logger to be used for printing feedback.
 * 
 * @returns {Promise<ChatCompletionResponseMessage>} - The combined response from all chunks.
 */
export async function chunkAndProcessMessages(
  message: string,
  openai: OpenAI,
  logger: Logger
): Promise<ChatCompletionResponseMessage> {
  let chunkedResponses = [];
  const countOfTokens = countTokens(message);
  logger.info(`Total tokens: ${countOfTokens}`);
  
  const tokens = gpt2.encode(message);
  const chunkSize = env().CHUNKING_TOKENS;
  
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunkedTokens = tokens.slice(i, i + chunkSize);
    let chunkOfContent = new TextDecoder().decode(gpt2.decode(chunkedTokens));

    // Removing excessive white spaces
    chunkOfContent = chunkOfContent.replace(/\s+/g, " ");

    // skip the loop if the chunk of content is empty
    if (!chunkOfContent.trim()) {
      continue;
    }

    const chunkMessage: ChatCompletionResponseMessage = {
      role: "system",
      content: chunkOfContent,
    };

    let chunkCompletion;
    try {
      chunkCompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [chunkMessage],
        temperature: 0,
        max_tokens: 100,
      });
    } catch (error) {
      logger.error("Error in creating chat completion: " + error);
    }

    if (chunkCompletion) {
      chunkedResponses.push(chunkCompletion.data.choices[0].message!);
    }

    logger.info(`Current step: ${i / chunkSize}, Remaining steps: ${(tokens.length - i) / chunkSize}`);
  }

  const combinedResponse: ChatCompletionResponseMessage = {
    role: "system",
    content: chunkedResponses.map(res => res.content).join("\n").replace(/\s+/g, " "),
  };

  return combinedResponse;
}