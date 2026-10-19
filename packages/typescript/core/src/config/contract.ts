import * as Schema from "effect/Schema";

import { PapercutMfContract } from "../papercut-mf/contract";

export namespace ConfigContract {
  export class SetPapercutMfApiAuthTokenPayload extends Schema.Class<
    SetPapercutMfApiAuthTokenPayload,
    { readonly brand: unique symbol }
  >("SetPapercutMfApiAuthTokenPayload")({ token: PapercutMfContract.ApiAuthToken }) {}
}
