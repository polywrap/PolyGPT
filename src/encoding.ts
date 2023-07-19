import { get_encoding } from "@dqbd/tiktoken";

export const gpt2 = get_encoding("gpt2");

export function countTokens(text: string): number {
  return gpt2.encode(text).length;
}
