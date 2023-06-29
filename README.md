# GPT Agent Learning Demo
Using the OpenAI Functions API in combination with Polywrap to create an agent that can learn new capabilities on-the-fly.

Mark the repo with a Star ⭐ if you like it!

---
# Wraps
Wraps are groups of methods that the agent can execute on the fly.

The agent first needs to `LoadWrap` in order to learn its methods, and then it can `InvokeWrap` to execute them.

<!-- TODO: Provide examples of methods -->

# Getting started

1. `git clone <TODO>` <!-- TODO: Replace with correct git repo URL -->
2. `yarn update` <!-- TODO: Verify the update command and its parameters -->
3. `yarn start` <!-- TODO: Add a brief explanation of what this command does -->
4. Then you can start interacting with the bot.

<!-- TODO: Provide a small interaction example -->

# Usecase examples:
<!-- TODO: Provide a few real-life use case examples -->

# Functions 

- LoadWrap(name:string)
  - This function takes the name of the wrap to be loaded from the wrap library, for example, you can load the `http` or the `ipfs` wraps to get access to their methods.
  - After loading a wrap, you can ask the agent questions on how to use the loaded wrap and it will give you a description of how to interact with the specific methods.
  - The Loading of wraps is unique, in the sense that it can have only one wrap loaded at the same time, and when you load a new wrap the old one is removed, while keeping the chat history.

- InvokeWrap(options: object)
  - This function uses the [`PolywrapClient`](https://github.com/polywrap/javascript-client) to call a method of the wrap.
  - It takes in a single options object which should also include always an `uri` and a `method`. It's also possible to include `args` in the input to the options which will be passed to the method selected.

  
# Print Chat History Commands

- By just saying `history`, the Terminal will print the chat history to see what is being processed by the agent's memory. You can use this to see which wrap is loaded in memory, and notice that when you load another wrap, that new wrap is loaded while the old one is removed.

### Chat Logs

The bot should be outputting a .txt file with the chat logs to be easily shared with the community.
<!-- TODO: Add location of .txt file, how it can be accessed, and share options -->

## Collaborating

We are eager to work with the community to continue improving this agent. If you're interested in contributing, we welcome Pull Requests! Here are some ways you can contribute:

- **Bug Fixes:** If you spot a bug or an error, feel free to fix it and submit a PR. Please include a description of the bug and how your code fixes it.
- **Feature Additions:** We are open to new features! If you have an idea, please share it on our [discord](https://discord.com/invite/Z5m88a5qWu) first. That way, we can discuss it as a community. If the idea is approved, you can go ahead and add it.
- **Documentation:** Good documentation makes for a good project. If you spot areas in our docs that can be improved, or if something is not documented and should be, feel free to make these changes.

Remember, the best way to submit these changes is via a Pull Request. If you're new to Github, you can learn about PRs [here](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests).

Also, please feel free to join our [discord](https://discord.com/invite/Z5m88a5qWu) and discuss your ideas or ask any questions. We are an open, welcoming community and we'd love to hear from you!

# Resources and Links

[Discord](https://discord.com/invite/Z5m88a5qWu) | [Wrap Library]()  <!-- TODO: Add URL for Wrap Library --> |  [Polywrap Docs](https://docs.polywrap.io)  |  [ChatGPT Functions Docs](https://platform.openai.com/docs/guides/gpt/function-calling)
