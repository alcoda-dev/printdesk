import * as DateTime from "effect/DateTime";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as Struct from "effect/Struct";

import { AttributesContract } from "../attributes/contract";
import { CloudflareContract } from "../cloudflare/contract";
import { PapercutMfContract } from "../papercut-mf/contract";
import { CallbackId, EntityId } from "../utils";
import { Constants } from "../utils/constants";

export namespace InfraContract {
  export class InputItem extends Schema.Class<InputItem>("InputItem")({
    [Constants.DYNAMO_KEYS.PK]: AttributesContract.TenantIdFromString,
    [Constants.DYNAMO_KEYS.SK]: AttributesContract.InfraInput,
    [Constants.DYNAMO_KEYS.GSI1_PK]: AttributesContract.TenantDeploymentIdFromString,
    [Constants.DYNAMO_KEYS.GSI1_SK]: AttributesContract.InfraInput,
    callbackId: CallbackId.pipe(Schema.OptionFromNullOr),
    papercutMfConfig: PapercutMfContract.Config,
    updatedAt: Schema.DateTimeUtcFromString.pipe(Schema.withConstructorDefault(DateTime.now)),
  }) {}

  export const InputKey = InputItem.mapFields(
    Struct.pick([Constants.DYNAMO_KEYS.PK, Constants.DYNAMO_KEYS.SK]),
  );

  export class OutputItem extends Schema.Class<OutputItem>("OutputItem")({
    [Constants.DYNAMO_KEYS.PK]: AttributesContract.TenantIdFromString,
    [Constants.DYNAMO_KEYS.SK]: AttributesContract.InfraOutput,
    [Constants.DYNAMO_KEYS.GSI1_PK]: AttributesContract.TenantDeploymentIdFromString,
    [Constants.DYNAMO_KEYS.GSI1_SK]: AttributesContract.InfraOutput,
    papercutMfApiTunnelId: CloudflareContract.TunnelId.pipe(Schema.OptionFromNullOr),
    deployedAt: Schema.DateTimeUtcFromString,
  }) {}

  export const OutputPrimaryKey = OutputItem.mapFields(
    Struct.pick([Constants.DYNAMO_KEYS.PK, Constants.DYNAMO_KEYS.SK]),
  );

  export const OutputSecondaryKey = OutputItem.mapFields(
    Struct.pick([Constants.DYNAMO_KEYS.GSI1_PK, Constants.DYNAMO_KEYS.GSI1_SK]),
  );

  export class NotDeployedError
    extends Schema.TaggedError<NotDeployedError>()("InfraNotDeployedError", {
      deploymentId: EntityId,
    })
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(NotDeployedError)(this, { status: 409 });
  }
}
