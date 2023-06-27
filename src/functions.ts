import { InvokeOptions, PolywrapClient, Wrapper } from "@polywrap/client-js";

type Abi = ReturnType<Wrapper['getManifest']>['abi']

// interface FunctionWithArgs {
//   name: string;
//   args: { name: string, type: string, required: boolean }[]
// }

const extractMethodsFromAbi = (abi: Abi): string => {
  const abiMethods = abi.moduleType?.methods ?? [];

  const methods = abiMethods.map((method) => {
    const args = method.arguments?.map(argument => ({
      name: argument.name as string,
      type: "string", // TODO
      required: argument.required ?? false
    })) ?? []

    return {
      name: method.name as string,
      args
    }
  })

  return methods.map(method => 
    `- ${method.name}(${method.args.map((arg, i) => `${arg.name}: ${arg.type}${arg.required ? "" : "?"}${method.args[i + 1] ? ", " : ""}`).join("")})`)
    .join("\n")
}

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
    name: "GetWrapLibrary",
    description: "A function to get a library of available wraps, given a wrap name",
    parameters: {
      type: "object",
      properties: {
        wrapName: {
          type: "string",
          description: "The name of the wrap to get the library for",
        },
      },
      required: ["wrapName"],
    },

  },
  {
    name: "GetFunctionsfromWrap",
    description:
      "A function to get available functions given a wrap's URI",
    parameters: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "The URI of the wrap"
        }
      }
    },
  },
  {
    name: "InvokeWrap",
    description: `A function to invoke or execute any wrap function. 
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
            `The options to invoke a wrap, including the URI, METHOD, ARGS,
            where ARGS is optional, and both Uri and Method are required`,
        },
      },
      required: ["options"],
    },
  },
];

export const functionsMap: Record<string, AgentFunction> = {
  GetWrapLibrary: async (_: PolywrapClient, { wrapName }: { wrapName: string }) => {
    console.log(wrapName)
    const wrapMappings: Record<string, string[]> = {
      datetime: ["plugin/datetime@1.0.0"],
      http: ["plugin/http@1.1.0"], // Returns the entire website so it breaks after the query, apis like duckduckgo also raise errors
      ipfs: ["embed/ipfs-http-client@1.0.0"], // Cant cat a sample IPFS hash (QmTkzDwWqPbnAh5YiV5VwcTLnGdwSNsNTn2aDxdXBFca7D), returns an empty string
      ens: ["wrap://ipfs/QmWG8NJnvGMCosxaUWuRna33MSDR331rByGTdy4EDsVjNL"],
      ethereum: ["plugin/ethereum-provider@2.0.0", "wrap://ipfs/QmNkqWQuTAiZaLSR3VE53uazuAEqZevv1XQtvAYahuyJ6d"], // Dont know how to test this
    };

    const keywords = wrapName.toLowerCase().split(" ");
    const matchingWraps: string[] = [];

    for (const keyword of keywords) {
      if (keyword in wrapMappings) {
        matchingWraps.push(...wrapMappings[keyword]);
      }
    }

    const uniqueWraps = Array.from(new Set(matchingWraps));
    const sortedWraps = uniqueWraps.sort();

    return {
      ok: true,
      result: sortedWraps.toString(),
    } as Result;
  },
  GetFunctionsfromWrap: async (client: PolywrapClient, { uri }: { uri: string }) => {
    const resolutionResult = await client.tryResolveUri({
      uri
    });

    if (resolutionResult.ok) {
      switch (resolutionResult.value.type) {
        case "uri": return {
          ok: false,
          error: `Resolved URI: ${resolutionResult.value.uri.toString()}`
        }
        case "wrapper": return {
          ok: true,
          result: extractMethodsFromAbi(resolutionResult.value.wrapper.getManifest().abi)
        }
        case "package": {
          const manifest = await resolutionResult.value.package.getManifest()

          if (manifest.ok) {
            return {
              ok: true,
              result: extractMethodsFromAbi(manifest.value.abi)
            }
          }

          return {
            ok: false,
            error: "Failed to get manifest for Wrap package"
          }
        }
      }
    }

    return {
      ok: false,
      error: "Failed to resolve wrap or package"
    }
  },
  InvokeWrap: async (client: PolywrapClient, options: InvokeOptions) => {
    console.log("Invoking wrap");
    console.log(options);

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