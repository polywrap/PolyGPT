import { get_encoding } from "@dqbd/tiktoken";

const enc = get_encoding("gpt2");

// Utility function to count the tokens in a string
export function countTokens(text: string): number {
  return enc.encode(text).length;
}
