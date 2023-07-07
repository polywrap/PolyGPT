# GPT Agent Learning Demo

This project uses the OpenAI Functions API in combination with Polywrap to create an agent that can learn new capabilities on demand! Polywrap is powered by Wraps, portable and composable software modules that can operate in any environment.

Mark the repo with a Star ⭐ if you like it!
---

# Getting started
Open your terminal window and run the following commands
1. `git clone https://github.com/polywrap/gpt-agent-learning-demo.git`
2. Update your .env file with the appropriate keys for OpenAI and your Ethereum Private Key
3. `yarn install` will get all dependencies installed
4. `yarn start` will run the agent loop

Then you can start interacting with the bot by filling in the Prompt.

## Example prompts:

- Load the filesystem wrap and write a detailed workout plan for 60 minutes called workout.md
- Load the browser wrap and research what is https://polywrap.io potential user market
- Load the http wrap and query https://api.example.com/data with the POST method
- Load the ethereum wrap and get the Chain ID
- Load the ethereum wrap and get the current gas price
- Load the ethereum wrap and send a transaction to `0xEthereumAddress` with 10% of my current funds


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

### Wrap Library

All wraps are stored in a [Wrap Library](https://github.com/polywrap/agent-wrap-library) which will be maintained in parallel, adding more commands to the agent on startup.

## Functions 

The agent consists of only 2 versatile functions that are exposed to the user.

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

  
# Collaborating

We are eager to work with the community to continue improving this agent. If you're interested in contributing, we welcome Pull Requests! Here are some ways you can contribute:

- **Bug Fixes:** If you spot a bug or an error, feel free to fix it and submit a PR. Please include a description of the bug and how your code fixes it.
- **Feature Additions:** We are open to new features! If you have an idea, please share it on our [discord](https://discord.com/invite/Z5m88a5qWu) first. That way, we can discuss it as a community. If the idea is approved, you can go ahead and add it.
- **Documentation:** Good documentation makes for a good project. If you spot areas in our docs that can be improved, or if something is not documented and should be, feel free to make these changes.

Remember, the best way to submit these changes is via a Pull Request. If you're new to Github, you can learn about PRs [here](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests).

Also, please feel free to join our [discord](https://discord.com/invite/Z5m88a5qWu) and discuss your ideas or ask any questions. We are an open, welcoming community and we'd love to hear from you!

# Resources and Links

[Discord](https://discord.com/invite/Z5m88a5qWu)  |  [Wrap Library](https://github.com/polywrap/agent-wrap-library)  |  [Polywrap Docs](https://docs.polywrap.io)  |  [ChatGPT Docs](https://platform.openai.com/docs/guides/gpt/function-calling)
