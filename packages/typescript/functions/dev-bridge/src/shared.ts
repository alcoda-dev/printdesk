import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

const PortToString = Schema.Port.pipe(
  Schema.encodeTo(Schema.String, SchemaTransformation.numberFromString),
);

export const devServerPortHeaderName = "x-dev-server-port";

export const ProxyHeaders = Schema.StructWithRest(
  Schema.Struct({ [devServerPortHeaderName]: PortToString }),
  [Schema.Record(Schema.String, Schema.Union([PortToString, Schema.String]))],
);
