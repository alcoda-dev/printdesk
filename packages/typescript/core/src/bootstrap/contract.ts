import * as Array from "effect/Array";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { IdentityProvidersContract } from "../identity/contract";
import { LicensesContract } from "../licenses/contract";
import { PapercutMfContract } from "../papercut-mf/contract";
import { TenantsContract } from "../tenants/contract";
import { EntityId } from "../utils";

export namespace BootstrapContract {
  export class Payload extends Schema.Class<Payload, { readonly brand: unique symbol }>(
    "BootstrapPayload",
  )({
    licenseKeyPair: LicensesContract.KeyPairFromString,
    tenant: TenantsContract.Table.Model.mapFields(
      Struct.pick(["name", "slug", "tenantId"]),
    ).mapFields(Struct.renameKeys({ tenantId: "id" })),
    identityProviders: IdentityProvidersContract.Table.Model.mapFields(
      Struct.pick(["kind", "externalId"]),
    ).pipe(
      Schema.NonEmptyArray,
      Schema.check(
        Schema.makeFilter((providers) =>
          Array.length(Array.dedupeWith(providers, (a, b) => a.kind === b.kind)) !==
          Array.length(providers)
            ? ["Identity provider kind must be unique"]
            : [],
        ),
      ),
    ),
    papercutMf: Schema.Struct({
      apiAuthToken: PapercutMfContract.ApiAuthToken,
      config: PapercutMfContract.EnabledConfig.mapFields(Struct.omit(["enabled"])),
    }).pipe(Schema.OptionFromOptional),
    clientId: EntityId,
  }) {}
}
