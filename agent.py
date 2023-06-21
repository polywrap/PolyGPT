import openai
import json
import os 

from dotenv import load_dotenv
from polywrap_client import PolywrapClient
from typing import cast

from pathlib import Path
from polywrap_client import PolywrapClient, ClientConfig
from polywrap_core import Uri, InvokerOptions, UriPackageOrWrapper, UriResolver
from polywrap_client_config_builder import PolywrapClientConfigBuilder
from polywrap_uri_resolvers import FsUriResolver,SimpleFileReader, StaticResolver, RecursiveResolver
from polywrap_uri_resolvers import UriResolverAggregator
from polywrap_http_plugin import http_plugin


import asyncio

import nest_asyncio

nest_asyncio.apply()

load_dotenv()

ipfs_wrapper_path = Path("fs//Users/robertohenriquez/pycode/polywrap/hackathon/Auto-GPT/autogpt/auto_gpt_workspace/wrappers/ipfs-http-client")


resolver = RecursiveResolver(
        UriResolverAggregator(
            [
                cast(UriResolver, FsUriResolver(file_reader=SimpleFileReader())),
                cast(UriResolver, StaticResolver({Uri("wrap://ens/wraps.eth:http@1.1.0", ipfs_wrapper_path): http_plugin()})),
            ]
        )
    )
config = ClientConfig(resolver=resolver)
client = PolywrapClient(config)

openai.api_key = os.getenv("OPENAI_API_KEY")


def polywrap_bignumber(base_number, factor):
    """Multiplies a base number by a factor to get a new number"""
    uri = Uri.from_str(
        f'fs//Users/robertohenriquez/pycode/cloud/AGI/Auto-GPT/autogpt/auto_gpt_workspace/wrappers/bignumber'
    )
    args = {
        "arg1": str(base_number),  # The base number
        "obj": {
            "prop1": str(factor),  # multiply the base number by this factor
        },
    }
    options: InvokerOptions[UriPackageOrWrapper] = InvokerOptions(
        uri=uri, method="method", args=args, encode_result=False
    )
    print(asyncio.run(client.invoke(options)))
    result = asyncio.run(client.invoke(options))
    return f"the result is {result}"

def fetch_tool_library(tool_name):
    """a mapping of keywords to tools that ChatGPT will be able to use through the polywrap python client"""
    # Mapping of keywords to tools
    tool_mappings = {
        "ipfs": ["wrap/ipfs"],
        "http": ["wrap/http"],
        "ens": ["wrap/ens"],
        "ethers": ["wrap/ethers"],
        "ethereum": ["wrap/ethers"],
    }
    
    # Check if the tool_name has any keywords
    keywords = tool_name.lower().split()
    matching_tools = []
    
    for keyword in keywords:
        if keyword in tool_mappings:
            matching_tools.extend(tool_mappings[keyword])
    
    # Remove duplicates and sort the tools alphabetically
    matching_tools = sorted(list(set(matching_tools)))
    
    return str(matching_tools)

def invoke_tool(options):
    """The invoker function that Chat GPT uses to invoke tools with polywrap"""
    
    uri = Uri.from_str(options["tool_uri"])
    args = options["arguments"]
    method = options["method"]
    options: InvokerOptions[UriPackageOrWrapper] = InvokerOptions(
        uri=uri, method=method, args=args, encode_result=False
    )
    print(asyncio.run(client.invoke(options)))
    result = asyncio.run(client.invoke(options))
    return f"SUCCESS! The result is: {result}"



question = "Find what tools are available for ipfs"
# Define the functions for our ChatGPT Agent

functions = [
    {
        "name": "polywrap_bignumber",
        "description": "Use this function every time you need to make a multiplication",
        "parameters": {
            "type": "object",
            "properties": {
                "base_number": {
                    "type": "number",
                    "description": "The base number",
                },
                "factor": {
                    "type": "number",
                    "description": "The factor to multiply the base number",
                },
            },
            "required": ["base_number", "factor"],
        },
    },
    {
        "name": "fetch_tool_library",
        "description": "Fetches information about a specific tool from the tool library, given the tool name.",
        "parameters": {
            "type": "object",
            "properties": {
                "tool_name": {
                    "type": "string",
                    "description": "The name of the tool to fetch",
                },
            },
            "required": ["tool_name"],
        },
    },
    {
        "name": "invoke_tool",
        "description": "Invokes the given tool with the specified arguments",
        "parameters": {
            "type": "object",
            "properties": {
                "options": {
                    "type": "object",
                    "description": "The options to pass to the tool, including the tool_uri and the arguments",
                },
            },
            "required": ["tool_uri", "options"],
        },
    },
]






def agent_loop(question, functions, chat_history=None):
    """
    A simple agent loop that can be used to continue a conversation with ChatGPT, using the polywrap python client to invoke tools
    
    Args:
        question (str): The question to ask ChatGPT
        functions (list): The list of functions to use with ChatGPT 
        chat_history (list): The chat history to use with ChatGPT
    
    Returns:
        response (dict): The response from ChatGPT which sometimes is empty #TODO fix this
        chat_history (list): The updated chat history to be used in the follow up call to the agent loop
    """
    if chat_history is None:
        chat_history = []

    chat_history.append({"role": "user", "content": question})

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-0613",
        messages=chat_history,
        functions=functions,
        function_call="auto",
    )

    message = response["choices"][0]["message"]

    if message.get("function_call"):
        print("-> Using a function call now")
        function_name = message["function_call"]["name"]
        function_args_string = message["function_call"]["arguments"]
        function_args = json.loads(function_args_string)

        try:
            function_response = globals()[function_name](**function_args)
            updated_chat_history = [{"role": "assistant", "content": function_response}]
            chat_history.extend(updated_chat_history)
        except Exception as e:
            error_message = str(e)
            updated_chat_history = [{"role": "assistant", "content": f"Error: {error_message}"}]
            chat_history.extend(updated_chat_history)
    else:
        print("-> No function call used")
        chat_history.append({"role": "assistant", "content": message["content"]})
        return response, chat_history

    return response, chat_history


# Example usage
question = "Find what tools are available for ipfs in the skill library"
response, chat_history = agent_loop(question, functions)

print(chat_history)

# Continue the conversation
new_question = "Call the function invoke_tool to the received URI with the arguments: {method: get, arguments: {hash: 'Qm11234'}, tool_uri: <the found URI>}"
response, chat_history = agent_loop(new_question, functions, chat_history)

# Continue the conversation further if needed
print(chat_history, response)

# Example usage
for i in range(2):
    new_question = "Try to call the invoke_tool function again with the provided feedback until you get the success result"
    response, chat_history = agent_loop(new_question, functions, chat_history)

print(chat_history)


