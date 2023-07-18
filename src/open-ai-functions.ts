import { WrapLibrary } from "./wrap-library";

import {
  InvokeOptions,
  PolywrapClient
} from "@polywrap/client-js";
import axios from "axios";

type Result =
  | {
    ok: true;
    result: any;
  }
  | {
    ok: false;
    error: string;
  };

export type AgentFunction = (
  client: PolywrapClient,
  ...args: any[]
) => Promise<Result>;

export const functionsDescription = [
  {
    name: "InvokeWrap",
    description: `A function to invoke or execute any wrap method. 
                  It receives an option object with a uri, method and optional args
                  For example
                  Function = InvokeWrap
                  Arguments = Options {
                    uri: <URI Here>,
                    method: <Method Name>,
                    args: <Args if necessary>
                  }`,
    parameters: {
      type: "object",
      properties: {
        options: {
          type: "object",
          description:
            `The options to invoke a wrap method, including the URI, METHOD, ARGS,
            where ARGS is optional, and both Uri and Method are required`,
        },
      },
      required: ["options"],
    },
  },
  {
    name: "LoadWrap",
    description: `A function to fetch the graphql schema for method analysis and introspection. 
                  It receives a wrap name.
                  For example
                  Function = LoadWrap
                  Arguments = Options {
                    name: <Wrap Name Here>
                  }`,
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            `The name of the wrap to load`,
        },
      },
      required: ["options"],
    },
  },
];

export const functionsMap: (library: WrapLibrary.Reader) => Record<string, AgentFunction> = (
  library: WrapLibrary.Reader
) => ({
  InvokeWrap: async (client: PolywrapClient, options: InvokeOptions) => {
    try {
      const result = await client.invoke(options);
      return result.ok
        ? {
          ok: true,
          result: result.value,
        }
        : {
          ok: false,
          error: result.error?.toString() ?? "",
        };
    } catch (e: any) {
      return {
        ok: false,
        error: e,
      };
    }
  },
  LoadWrap: async (_: PolywrapClient, { name }: { name: string }) => {
    try {
      const wrapInfo = await library.getWrap(name);
      const { data: wrapSchemaString } = await axios.get<string>(wrapInfo.abi);

      return {
        ok: true,
        result: wrapSchemaString,
      }
    } catch (e: any) {
      return {
        ok: false,
        error: e,
      };
    }
  },
});
