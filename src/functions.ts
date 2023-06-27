import { InvokeOptions, PolywrapClient } from "@polywrap/client-js";

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
];

export const functionsMap: Record<string, AgentFunction> = {
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
};