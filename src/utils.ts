import axios from "axios";
import { WRAPS_LIBRARY_URL } from "./constants";

interface WrapsIndex {
  wraps: string[];
}

interface WrapInfoDTO {
  aliases: string[];
  description: string;
  uri: string;
  abi: string;
  examplePrompts: {
    prompt: string;
    result: {
      uri: string;
      method: string;
      args: Record<string, any>;
    }
  }[]
}

interface WrapInfo extends WrapInfoDTO {
  name: string;
}

export const getWrapsIndex = async (): Promise<WrapsIndex> => {
  const response = await axios.get<WrapsIndex>(`${WRAPS_LIBRARY_URL}/index.json`)

  return response.data
}

export const getWrapInfo = async (name: string): Promise<WrapInfo> => {
  const response = await axios.get<WrapInfoDTO>(`${WRAPS_LIBRARY_URL}/${name}.json`)
  const wrapInfo = response.data

  return {
    ...wrapInfo,
    name,
  }
}

export const getWrapInfos = async (wrapNames: string[]): Promise<WrapInfo[]> => {
  return Promise.all(wrapNames.map((wrapName) => getWrapInfo(wrapName)))
}