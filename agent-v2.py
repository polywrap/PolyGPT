import asyncio
import json
import os
from pathlib import Path
from typing import cast
from prettytable import PrettyTable

import nest_asyncio
import openai
from dotenv import load_dotenv
from polywrap_client import ClientConfig, PolywrapClient
from polywrap_client_config_builder import PolywrapClientConfigBuilder
from polywrap_core import InvokerOptions, Uri, UriPackageOrWrapper, UriResolver
from polywrap_http_plugin import http_plugin
from polywrap_uri_resolvers import (
    FsUriResolver,
    RecursiveResolver,
    SimpleFileReader,
    StaticResolver,
    UriResolverAggregator,
)

nest_asyncio.apply()

load_dotenv()

import argparse

# Create the parser
parser = argparse.ArgumentParser(description='Process some integers.')

# Add the arguments
parser.add_argument('--debug', action='store_true', help='Enable debug mode')

# Parse the arguments
args = parser.parse_args()

def create_function_table(functions):
    # Define the table
    table = PrettyTable()

    # Specify the Column Names while initializing the Table
    table.field_names = ["Function Name", "Description"]

    # Add rows
    for function in functions:
        table.add_row([function["name"], function["description"]])

    return table

def print_help():
    print("Welcome to Polywrap Agent Help!")
    print("""
    - This program serves as an interface for a user to interact with OpenAI's ChatGPT model and invoke tools through Polywrap, a protocol for using WebAssembly packages on the web.
    - The user can input questions or commands, and the program uses ChatGPT to understand and execute them. It integrates Polywrap Python client, which enables invoking various WebAssembly packages (tools). This is made possible by defining several functions that can handle certain tasks (e.g., invoking tools, fetching tool libraries, multiplying large numbers using a polywrap package, etc.).
    - The debug mode can be turned on by running this script with the `--debug` flag.""")
    print("Commands:")
    print("quit: Quit the program.")
    print("help: Print this help message.")
    table = create_function_table(functions)
    print(table)
    


# Set the debug variable
debug = args.debug

print(f'Debug mode is: {"On" if debug else "Off"}')



ipfs_wrapper_path = Path(
    "fs//Users/robertohenriquez/pycode/polywrap/hackathon/Auto-GPT/autogpt/auto_gpt_workspace/wrappers/ipfs-http-client"
)


resolver = RecursiveResolver(
    UriResolverAggregator(
        [
            cast(UriResolver, FsUriResolver(file_reader=SimpleFileReader())),
            cast(
                UriResolver,
                StaticResolver(
                    {
                        Uri(
                            "wrap://ens/wraps.eth:http@1.1.0", ipfs_wrapper_path
                        ): http_plugin()
                    }
                ),
            ),
        ]
    )
)
config = ClientConfig(resolver=resolver)
client = PolywrapClient(config)

openai.api_key = os.getenv("OPENAI_API_KEY")


def polywrap_bignumber(base_number, factor):
    """Multiplies a base number by a factor to get a new number"""
    uri = Uri.from_str(
        f"fs//Users/robertohenriquez/pycode/cloud/AGI/Auto-GPT/autogpt/auto_gpt_workspace/wrappers/bignumber"
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

def return_tasks_performed(amount=5):
    return tasks_performed[-amount:][::-1]




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
    {
        "name": "return_tasks_performed",
            "description": "Returns list of an amount of tasks performed by the agent. By default its just 5 most recent tasks.",
            "parameters": {
        "type": "object",
        "properties": {
            "amount": {
                "type": "number",
                "description": "The amount of tasks to return",
            },
        },
        "required": [],
},

    },
]

tasks_performed = []

async def agent_loop(question, functions, chat_history=None):
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
            updated_chat_history = [{"role": "assistant", "content": str(function_response)}]
            chat_history.extend(updated_chat_history)
            
            # Add a record of the function call to the tasks_performed list
            tasks_performed.append({
                "function_name": function_name,
                "arguments": function_args,
                "response": function_response
            })
        except Exception as e:
            error_message = str(e)
            updated_chat_history = [
                {"role": "assistant", "content": f"Error: {error_message}"}
            ]
            chat_history.extend(updated_chat_history)
    else:
        print("-> No function call used")
        chat_history.append({"role": "assistant", "content": message["content"]})
        return response, chat_history

    return response, chat_history


# Example usage



async def main_loop(functions):
    print('Welcome to the Polywrap Agent!')

    table = create_function_table(functions)
    print(table)
    print("Enter a command, or 'help' for help.")

    chat_history = []
    while True:
        try:
            question = input("Command: ")
            if question.lower() == "quit":
                break
            elif question.lower() == "help":
                print_help()
                continue

            print("Thinking, please wait...")
            response, chat_history = await agent_loop(question, functions, chat_history)
            if debug:
                print(response)
            print(f"Assistant: {chat_history[-1]['content']}")

        except Exception as e:
            print(f"Error: {str(e)}")



# Main program execution
if __name__ == "__main__":
    asyncio.run(main_loop(functions))