import * as Redacted from "effect/Redacted";

import { CryptoContract } from "../crypto/contract";
import { EntityId } from "../utils";
import { Constants } from "../utils/constants";
import { OauthContract } from "./contract";

import type { Provider } from "@openauthjs/openauth/provider/provider";
import type { ClientsContract } from "../clients/contract";

export type ClientCredentialsProviderVerifyResult = Pick<
  typeof ClientsContract.Table.Model.Type,
  "role" | "scopes" | "tenantId" | "identityProviderId"
>;

export type ClientCredentialsProviderProperties = ClientCredentialsProviderVerifyResult &
  Pick<typeof ClientsContract.Table.Model.Type, "id">;

export interface ClientCredentialsProviderConfig {
  verify: (
    credentials: OauthContract.ClientCredentials,
    requestedScopes?: Array<string>,
  ) => Promise<ClientCredentialsProviderVerifyResult>;
}

export const ClientCredentialsProvider = (
  config: ClientCredentialsProviderConfig,
): Provider<ClientCredentialsProviderProperties> => ({
  type: Constants.CLIENT_CREDENTIALS,
  init: () => undefined,
  async client(input) {
    const id = EntityId.make(input.clientID);

    const result = await config.verify(
      new OauthContract.ClientCredentials({
        id,
        secret: CryptoContract.Secret.make(Redacted.make(input.clientSecret)),
      }),
      // oxlint-disable-next-line effecttsgo/prefer-effect-string
      input.params.scope?.split(" ").filter(Boolean),
    );

    return { ...result, id };
  },
});
