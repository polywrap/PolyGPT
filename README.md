# PolyGPT

**An autonomous agent that can learn new capabilities on-demand**.  

![learning-agent](./imgs/learning-agent.png)

Learning is accomplished via [wraps](https://docs.polywrap.io/concepts/wraps): utility modules that the agent can import at run-time.

Whenever the agent is unable to accomplish a task, it searches for a wrap that may contain the functionality it is missing. These wraps are discovered within a ["wrap library"](./wrap-library/): a collection of simple JSON files describing wraps that can be downloaded. Wrap libraries can be published as stand-alone repositories, allowing multiple developers to collaborate on new collections of capabilities that agents can make use of.

Join the [discord](https://discord.polywrap.io) for help using PolyGPT, or integrating wraps into your own agents!

**Star ⭐** if you like what you see :grin:

# Examples

| Goal | Wraps Used |  
|-|-|  
| [Get the Bitcoin price from coindesk](./examples/07-24-btc-price-lookup-and-save.md) | [http](./wrap-library/http.json)</br>[filesystem](./wrap-library/filesystem.json) |  
| [Summarize the contents of https://polywrap.io in 100 words, and write what you learn to a polywrap.md file](./examples/07-25-summarize-site-to-file.md) | [web-scraper](./wrap-library/web-scraper.json)</br>[filesystem](./wrap-library/filesystem.json) |  
| [Who owns the domain vitalik.eth and how much ETH do they have?</br>Write this result to a file named "balances.csv", with columns: "ens", "address", and "balance".](./examples/07-25-ens-lookup-to-csv.md) | [ens](./wrap-library/ens.json)</br>[ethers](./wrap-library/ethers.json)</br>[filesystem](./wrap-library/filesystem.json) |  

# Getting Started

## Setup  

1. Clone the repository  
    ```
    git clone https://github.com/polywrap/polygpt
    ```  
2. Copy the `.env.template` file and rename it to `.env`  
    ```
    cp .env.template .env
    ```  
3. Find the line that says `OPENAI_API_KEY=`, and add your unique OpenAI API Key  
    ```
    OPENAI_API_KEY=sk-...
    ```  
4. Use the correct version of Node.JS  
    ```
    nvm install && nvm use
    ```  
5. Install all dependencies
    ```
    yarn install
    ```  
6. Run PolyGPT!
    ```
    yarn start
    ```  

NOTE: Please remember that this is a prototype. Its main purpose is to demonstrate how wraps can be used for agent learning.

## Special Prompts  

| Prompt | Description |
|-|-|
| `!auto N` | Allow the agent to execute on "autopilot" for `N` number of steps |

## Workspace

Once PolyGPT is run, there will be a `./workspace` directory created. This is the root directory for the agent. Any files will be read & written from this directory.

## Logging

Logs are printed to the console, and to a new file for each run within the `./chats` directory. Accomplish something cool!? Share your agent's log by: moving it to the `./examples` directory, giving it a meaningful name, and creating a pull-request on GitHub!

## Debugging

PolyGPT keeps an up-to-date version of all messages being sent to the OpenAI API in the `./workspace/.msgs` file. All of these messages will be sent to OpenAI on each chat completion. This is useful because as the message log grows, summarizations are performed upon the message history to fit them within a maximum context window token limit.

## GPT-4

While using the `gpt-3.5-turbo-0613` model will work, we highly recommend using the `gpt-4-0613` model. It will double the context window size to 8k tokens. The GPT 4 model will be available to more accounts [soon](https://openai.com/blog/gpt-4-api-general-availability).

## Ethereum Integrations

To interact with the Ethereum network using PolyGPT, you can optionally add your wallet's private key to the `.env` file. We recommend using a **development wallet** that contains only a small amount of funds to pay for any gas needed.

**Warning:** PolyGPT is still a prototype, we cannot guarantee that errors will not occur. We also realize that having your private key written in plain text is not a best practice, so we highly recommend you only add a private key to a development accounts which only has funds that you're willing to lose. Wallet integration will be improved in the future so that raw private key usage is not required.

# Collaborating

We are eager to work with the community to continue improving this agent, and building more wraps. If you're interested in contributing, we welcome pull-requests! Here are some ways you can contribute:

- **Bug Fixes:** If you spot a bug or an error, feel free to fix it and submit a PR. Please include a description of the bug and how your code fixes it.
- **Feature Additions:** We are open to new features! If you have an idea, please share it on our [discord](https://discord.polywrap.io), or make an issue in this repo.
- **Documentation:** Good documentation makes for a good project. If you spot areas in our docs that can be improved, or if something is not documented and should be, feel free to make these changes.

Remember, the best way to submit these changes is via a pull-request. If you're new to Github, you can learn about PRs [here](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/about-pull-requests).

Also, please feel free to join our [discord](https://discord.com/invite/Z5m88a5qWu) and discuss your ideas or ask any questions. We are an open, welcoming community and we'd love to hear from you!
