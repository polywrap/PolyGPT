import {
  PolywrapClient,
  PolywrapClientConfigBuilder,
  IWrapPackage
} from "@polywrap/client-js";
import { dateTimePlugin } from "@polywrap/datetime-plugin-js";
import * as EthProvider from "@polywrap/ethereum-provider-js";
import { Wallet } from "ethers"

export function getWrapClient(
  ethereumPrivateKey: string | undefined
): PolywrapClient {
  const builder = new PolywrapClientConfigBuilder()
    .addBundle("web3")
    .addBundle("sys")

  if (ethereumPrivateKey) {
    builder.setPackages({
      "plugin/datetime":
        dateTimePlugin({}) as IWrapPackage,

      "plugin/ethereum-provider@2.0.0":
        EthProvider.plugin({
          connections: new EthProvider.Connections({
            networks: {
              goerli: new EthProvider.Connection({
                signer: new Wallet(ethereumPrivateKey),
                provider:
                  "https://goerli.infura.io/v3/b00b2c2cc09c487685e9fb061256d6a6",
              }),
            },
            defaultNetwork: "goerli"
          }),
        }) as IWrapPackage}
    );
  }

  const config = builder.build();

  return new PolywrapClient(config);
}