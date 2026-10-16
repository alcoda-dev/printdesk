import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as HttpApiSchema from "effect/http-api/HttpApiSchema";
import * as Schema from "effect/Schema";

import { BootstrapContract } from "../bootstrap/contract";
import { LicensesContract } from "../licenses/contract";

export namespace Bootstrap {
  export class Group extends HttpApiGroup.make("Bootstrap").add(
    HttpApiEndpoint.post("bootstrap", "/", {
      payload: BootstrapContract.Payload,
      success: Schema.Void.pipe(HttpApiSchema.status(202)),
      error: [
        LicensesContract.LicenseConflictError,
        LicensesContract.InvalidLicenseKeyError,
        LicensesContract.NoSuchLicenseError,
      ],
    }),
  ) {}

  export class Api extends HttpApi.make("BootstrapApi").add(Group) {}
}
