import { OpenAIApi, ChatCompletionResponseMessage } from 'openai';
import { countTokens } from '../utils/token-counter';
import { get_encoding } from "@dqbd/tiktoken";

const enc = get_encoding("gpt2");

const chunkSize = Number(process.env.CHUNKING_TOKENS!);

/**
 * This function divides a message into chunks of a specified size (in tokens), sends each chunk to the OpenAI API for completion,
 * and then combines and returns the responses.
 *
 * @param {string} message - The message to be chunked and sent to OpenAI.
 * @param {OpenAIApi} openai - An instance of the OpenAI API.
 * 
 * @returns {Promise<ChatCompletionResponseMessage>} - The combined response from all chunks.
 */
export async function chunkAndProcessMessages(
  message: string,
  openai: OpenAIApi,
): Promise<ChatCompletionResponseMessage> {
  let chunkedResponses = [];
  const countOfTokens = countTokens(message);
  console.log(`Total tokens: ${countOfTokens}`);
  
  const tokens = enc.encode(message);
  
  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunkedTokens = tokens.slice(i, i + chunkSize);
    let chunkOfContent = new TextDecoder().decode(enc.decode(chunkedTokens));

    // Removing excessive white spaces
    chunkOfContent = chunkOfContent.replace(/\s+/g, ' ');

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
      console.log("Error in creating chat completion: ", error);
    }

    if (chunkCompletion) {
      chunkedResponses.push(chunkCompletion.data.choices[0].message!);
    }

    console.log(`Current step: ${i / chunkSize}, Remaining steps: ${(tokens.length - i) / chunkSize}`);
  }

  const combinedResponse: ChatCompletionResponseMessage = {
    role: "system",
    content: chunkedResponses.map(res => res.content).join('\n').replace(/\s+/g, ' '),
  };

  return combinedResponse;
}
