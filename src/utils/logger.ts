import { ChatCompletionRequestMessage } from "openai";
import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [
    new winston.transports.File({ filename: 'chat.log' }),
  ],
});

export const logToFile = (message: ChatCompletionRequestMessage) => {
  logger.info(`${message.role}: ${message.content}`)
}