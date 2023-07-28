> Fetching wrap library index @ https://raw.githubusercontent.com/polywrap/polygpt/testing/wrap-library

```
    ____        __      __________  ______
   / __ \____  / /_  __/ ____/ __ \/_  __/
  / /_/ / __ \/ / / / / / __/ /_/ / / /   
 / ____/ /_/ / / /_/ / /_/ / ____/ / /    
/_/    \____/_/\__, /\____/_/     /_/     
              /____/                      
```

Support: https://discord.polywrap.io

Known Wraps:
[
  "ethers",
  "http",
  "ipfs",
  "filesystem",
  "web-scraper",
  "ens",
  "safe-factory"
]

**System**: Please enter your main goal: 

**User**: Get the Bitcoin price from coindesk

**System**: Do you wish to execute the following function?

```
LearnWrap ({
  "name": "http"
})
```

(Y/N)

**User**: y

> Learnt wrap: http


**Assistant**: To get the Bitcoin price from coindesk using the `http` wrap, you can use the `get` method of the `Module` type.

Here is an example of how to invoke the `get` method:

```json
{
  "uri": "plugin/http@1.1.0",
  "method": "get",
  "args": {
    "url": "https://api.coindesk.com/v1/bpi/currentprice/BTC.json"
  }
}
```

This will make a GET request to the specified URL and return the response, which will include the Bitcoin price.

Please note that the response will be in the form of a JSON object, so you may need to parse the response to extract the Bitcoin price value.

**User**: do this

**System**: Do you wish to execute the following function?

```
InvokeWrap ({
  "uri": "plugin/http@1.1.0",
  "method": "get",
  "args": {
    "url": "https://api.coindesk.com/v1/bpi/currentprice/BTC.json"
  }
})
```

(Y/N)

**User**: y

**Function**: Args:
```json
{
  "uri": "plugin/http@1.1.0",
  "method": "get",
  "args": {
    "url": "https://api.coindesk.com/v1/bpi/currentprice/BTC.json"
  }
}
```
Result:
```json
{
  "status": 200,
  "statusText": "OK",
  "headers": {},
  "body": "{\"time\":{\"updated\":\"Jul 24, 2023 21:32:00 UTC\",\"updatedISO\":\"2023-07-24T21:32:00+00:00\",\"updateduk\":\"Jul 24, 2023 at 22:32 BST\"},\"disclaimer\":\"This data was produced from the CoinDesk Bitcoin Price Index (USD). Non-USD currency data converted using hourly conversion rate from openexchangerates.org\",\"bpi\":{\"USD\":{\"code\":\"USD\",\"rate\":\"29,153.9232\",\"description\":\"United States Dollar\",\"rate_float\":29153.9232},\"BTC\":{\"code\":\"BTC\",\"rate\":\"1.0000\",\"description\":\"Bitcoin\",\"rate_float\":1}}}"
}
```

**Assistant**: The Bitcoin price from coindesk is $29,153.9232.

**User**: Thank you :) please write this to a file named btc-price.txt

**System**: Do you wish to execute the following function?

```
LearnWrap ({
  "name": "filesystem"
})
```

(Y/N)

**User**: y

> Learnt wrap: filesystem


**System**: Do you wish to execute the following function?

```
InvokeWrap ({
  "uri": "plugin/file-system@1.0.0",
  "method": "writeFile",
  "args": {
    "path": "btc-price.txt",
    "data": "29,153.9232"
  }
})
```

(Y/N)

**User**: y

**Function**: Args:
```json
{
  "uri": "plugin/file-system@1.0.0",
  "method": "writeFile",
  "args": {
    "path": "/home/jelli/Dev/Repos/wrap/PolyGPT/workspace/btc-price.txt",
    "data": "29,153.9232"
  }
}
```
Result:
```json
true
```

**Assistant**: The Bitcoin price has been successfully written to a file named "btc-price.txt".
