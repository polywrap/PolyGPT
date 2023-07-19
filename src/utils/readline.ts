import * as read from "readline";

export const readline = read.createInterface({
  input: process.stdin,
  output: process.stdout,
});
