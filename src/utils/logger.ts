import { ChatCompletionRequestMessage } from "openai";
import winston from "winston";

const getLogFileName = () => {
  // get current date
  const date = new Date();
  
  // format the date to your liking
  const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
  
  // use the formatted date in the filename
  return `chat_${formattedDate}.log`;
}

const logger = winston.createLogger({
  format: winston.format.simple(),
  transports: [
    // use the function to get the filename
    new winston.transports.File({ filename: getLogFileName() }),
  ],
});

export const logToFile = (message: ChatCompletionRequestMessage) => {
  logger.info(`${message.role}: ${message.content}`)
}
