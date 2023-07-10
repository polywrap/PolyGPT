# GPT Agent Learning Demo
![Demo Gif](./public/demo.gif)



PolyGPT is an autonomous agent that learns new capabilities on-demand. The project utilizes Polywrap to implement capabilities as dynamically fetchable WebAssembly modules called Wraps, which update the agent via OpenAI's Functions API. This approach ensures that the agent remains efficient and lightweight, while having access to a wide range of capabilities. Current capabilities include web scraping, local filesystem access, Ethereum transactions, and more.

Mark the repo with a Star ⭐ if you like it!
---



# Getting started
Open your terminal window and run the following commands
1. `git clone https://github.com/polywrap/gpt-agent-learning-demo.git`
2. Update your .env file with the appropriate keys for OpenAI and your Ethereum Private Key
3. `yarn install` will get all dependencies installed
4. `yarn start` will run the agent loop

Then you can start interacting with the bot by filling in the main goal, and then an initial Prompt.

## Example Goals:

The bot will initially request a main goal to achieve, here are some examples:

- Write a detailed workout plan for 60 minutes called workout.md
- Research what is https://polywrap.io potential user market
- Query https://api.example.com/data with the POST method
- Get the current gas price for ethereum network
- Send an ethereum transaction to `0xEthereumAddress` with 10% of my current funds

## Autopilot Mode 

To enable Autopilot and let the model execute freely the next operations sent the Prompt: `auto -N` where `N` is the amount of automatic stepts you want the agent to take.

This command will trigger mostly execution steps where the agent loads wrappers and executes theirs functions.

We recommend oversight of the Autopilot mode as it will probably steer away from its main goal or waste tokens when it goes on loops.

## Chat Logs

The bot should be outputting conversations in a [`chats.log`](/chats/) file with the entire chat history to be easily shared with the community. To find this file check the chats folder after running the agent.

Here are some cool chats that showcase the utility of this agent:
  1. [Web scraper researches polywrap](./example-chat-logs/07-06-web-scraper-research-polywrap.log)
  1. [Ethereum Sign Message](./example-chat-logs/07-04-ethereum-sign-message.log)
  2. [Filesystem Create Flask App](./example-chat-logs/07-04-filesystem-create-flask-app.log)
  3. [Ethereum Send Transaction](./example-chat-logs/07-05-ethereum-send-transaction.log)

# Key Concepts
## Wraps
Wraps are groups of methods that the agent can execute on demand. They are the core components of the Polywrap framework, designed to be portable and composable. This means they can run in any environment and can easily and safely call into one another.

The agent first needs to `LoadWrap` in order to learn its methods, and then it can `InvokeWrap` to execute them.

Before an agent can use a Wrap, it first needs to load it. This process allows the agent to learn the methods and capabilities of the Wrap. This is done using the LoadWrap function.

Once a Wrap is loaded, the agent can then invoke it to execute its methods. This is done using the InvokeWrap function.


Wraps are developed in a standardized way, allowing them to be easily composed, resulting in even more sophisticated Wraps. They can run on any platform that has the Polywrap client installed. Wraps do not have to be bundled into applications. Instead, they can be safely fetched and run at runtime, allowing applications to stay in-sync with web3 protocol upgrades. This makes it possible for applications on any platform, written in any language, to read and write data to Web3 protocols.

## Wrap Library

All wraps are stored in a [Wrap Library](./wraps/) which will be maintained in parallel, adding more commands to the agent on startup.

## Functions 

The agent consists of only 2 versatile functions that are exposed to the user. They leverage the polywrap client and showcase its versatility.

### LoadWrap(name:string)

The `LoadWrap` function fetches a wrap from the library using its `name`, allowing the agent to access its methods. Once a wrap is loaded, the agent can provide you with information on how to interact with it. Note that loading a new wrap will replace the currently loaded wrap.

```
Prompt: Load the http wrap

Do you wish to execute the following function?

    Name: LoadWrap
    Arguments: {
  "name": "http"
}

    (Y/N)
```


### InvokeWrap(options: object)
The `InvokeWrap` function calls a method from the loaded wrap using the [`PolywrapClient`](https://github.com/polywrap/javascript-client). The function takes an `options` object which must include a `uri` and a `method`. You can also pass `args` in the `options` object that will be used by the selected method.
```
Prompt: Invoke the GET method wit the url https://api.example.com/data

Do you wish to execute the following function?

    Name: InvokeWrap
    Arguments: {
  "uri": "wrap://plugin/http@1.1.0",
  "method": "get",
  "args": {
    "url": "https://api.example.com/data",
    "request": {
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}

    (Y/N)
```

  

# Memory: Rolling summary

This agent uses a simple rolling memory which keeps track of the most recent messages in a short `summary.md` in the workspace. This file helps the bot keep on track towards its goals and also being aware of the previous taken steps.

In order to reset the memory you can always `yarn start --wipe-memory`

To see the implementation of the module check [`memory.ts`](./src/memory.ts)

Configure the size of the rolling summary in the `.env`. We recommend a setting a minimum of 500 and a maximum 1500 if you're using `gpt-3.5-turbo-0613` or 3500 with `gpt-4-0613` as your base model.

# Collaborating

We are eager to work with the community to continue improving this agent. If you're interested in contributing, we welcome Pull Requests! Here are some ways you can contribute:

- **Bug Fixes:** If you spot a bug or an error, feel free to fix it and submit a PR. Please include a description of the bug and how your code fixes it.
- **Feature Additions:** We are open to new features! If you have an idea, please share it on our [discord](https://discord.com/invite/Z5m88a5qWu) first. That way, we can discuss it as a community. If the idea is approved, you can go ahead and add it.
- **Documentation:** Good documentation makes for a good project. If you spot areas in our docs that can be improved, or if something is not documented and should be, feel free to make these changes.

Remember, the best way to submit these changes is via a Pull Request. If you're new to Github, you can learn about PRs [here](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests).

Also, please feel free to join our [discord](https://discord.com/invite/Z5m88a5qWu) and discuss your ideas or ask any questions. We are an open, welcoming community and we'd love to hear from you!

## Debug mode

To run in debug mode just run 

  `yarn start --debug`


# Resources and Links

[Discord](https://discord.com/invite/Z5m88a5qWu)  |  [Wrap Library](https://github.com/polywrap/agent-wrap-library)  |  [Polywrap Docs](https://docs.polywrap.io)  |  [ChatGPT Docs](https://platform.openai.com/docs/guides/gpt/function-calling)
