import { OpenAIApi, ChatCompletionResponseMessage } from 'openai';
import { countTokens } from '../utils/token-counter';
import { get_encoding } from "@dqbd/tiktoken";

const enc = get_encoding("gpt2");

const chunkSize = Number(process.env.CHUNKING_TOKENS!);

export async function chunkAndProcessMessages(
  message: string,
  openai: OpenAIApi,
): Promise<ChatCompletionResponseMessage> {
  let chunkedResponses = [];
  const countOfTokens = countTokens(message);
  console.log("Count of tokens: ", countOfTokens);

  // Check token generation
  const tokens = enc.encode(message);
  console.log("Tokens: ", tokens);

  // Confirm chunkSize value
  console.log("Chunk Size: ", chunkSize);

  for (let i = 0; i < tokens.length; i += chunkSize) {
    const chunkedTokens = tokens.slice(i, i + chunkSize);
    
    // Validate loop indexing
    console.log("Slice indices: ", i, i + chunkSize);
    console.log("Tokens length: ", tokens.length);

    const chunkOfContent = new TextDecoder().decode(enc.decode(chunkedTokens));
    console.log("Chunk of content: ", chunkOfContent);

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
      console.log("Error details: ", JSON.stringify(error, getCircularReplacer()));
    }

    if (chunkCompletion) {
      chunkedResponses.push(chunkCompletion.data.choices[0].message!);
    }
  }

  const combinedResponse: ChatCompletionResponseMessage = {
    role: "system",
    content: chunkedResponses.map(res => res.content).join('\n'),
  };

  return combinedResponse;
}

// This function will handle circular structures
function getCircularReplacer() {
  const seen = new WeakSet();
  return (key: string, value: any) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}
