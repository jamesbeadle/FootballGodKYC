import type { OptionIdentity } from "./identity";
import { Actor, HttpAgent } from "@dfinity/agent";

export class ActorFactory {
  static createActor(
    idlFactory: any,
    canisterId: string = "",
    identity: OptionIdentity = null,
    options: any = null,
  ) {
    const hostOptions = {
      host:`https://${canisterId}.icp-api.io`,
      identity: identity,
    };

    if (!options) {
      options = {
        agentOptions: hostOptions,
      };
    } else if (!options.agentOptions) {
      options.agentOptions = hostOptions;
    } else {
      options.agentOptions.host = hostOptions.host;
    }

    const agent = new HttpAgent({ ...options.agentOptions });

    if (process.env.DFX_NETWORK !== "ic") {
      agent.fetchRootKey().catch((err) => {
        console.warn(
          "Unable to fetch root key. Ensure your local replica is running",
        );
        console.error(err);
      });
    }

    return Actor.createActor(idlFactory, {
      agent,
      canisterId: canisterId,
      ...options?.actorOptions,
    });
  }

  static getAgent(
    canisterId: string = "",
    identity: OptionIdentity = null,
    options: any = null,
  ): HttpAgent {
    const hostOptions = {
      host:
        process.env.DFX_NETWORK === "ic"
          ? `https://${canisterId}.icp-api.io`
          : `http://localhost:8080/?canisterId=b77ix-eeaaa-aaaaa-qaada-cai`,
      identity: identity,
    };

    if (!options) {
      options = {
        agentOptions: hostOptions,
      };
    } else if (!options.agentOptions) {
      options.agentOptions = hostOptions;
    } else {
      options.agentOptions.host = hostOptions.host;
    }

    return new HttpAgent({ ...options.agentOptions });
  }

}
