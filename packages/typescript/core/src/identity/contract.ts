import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Struct from "effect/Struct";

import { GroupsContract } from "../groups/contracts";
import { TablesContract } from "../tables/contract";
import { UsersContract } from "../users/contract";
import { Constants } from "../utils/constants";

import type { IdentityProvidersTable } from "./sql";

export namespace IdentityProvidersContract {
  export class ClientCredentials extends Schema.Class<
    ClientCredentials,
    { readonly brand: unique symbol }
  >("ClientCredentials")({
    id: Schema.NonEmptyString,
    secret: Schema.NonEmptyString.pipe(Schema.RedactedFromValue),
  }) {}

  export const Kind = Schema.Literals([Constants.ENTRA_ID, Constants.GOOGLE]);
  export type Kind = typeof Kind.Type;

  export const Audience = Schema.NonEmptyString.pipe(Schema.brand("IdentityProviderAudience"));
  export type Audience = typeof Audience.Type;

  export const ExternalId = Schema.NonEmptyString.pipe(Schema.brand("IdentityProviderExternalId"));
  export type ExternalId = typeof ExternalId.Type;

  export class IdToken extends Schema.Class<IdToken, { readonly brand: unique symbol }>(
    "IdentityProviderIdToken",
  )({
    kind: Kind,
    audience: Audience,
    externalId: ExternalId,
    userExternalId: UsersContract.ExternalId,
  }) {}

  export const EntraIdIdToken = Schema.Struct({
    aud: Schema.NonEmptyString,
    oid: Schema.NonEmptyString,
    tid: Schema.NonEmptyString,
  }).pipe(
    Schema.decodeTo(IdToken, {
      decode: SchemaGetter.transform((payload) =>
        Struct.renameKeys(Struct.assign(payload, { kind: Constants.ENTRA_ID } as const), {
          aud: "audience",
          oid: "userExternalId",
          tid: "externalId",
        }),
      ),
      encode: SchemaGetter.transform(
        Struct.renameKeys({ audience: "aud", externalId: "tid", userExternalId: "oid" }),
      ),
    }),
  );

  export const GoogleIdToken = Schema.Struct({
    aud: Schema.NonEmptyString,
    sub: Schema.NonEmptyString,
    hd: Schema.NonEmptyString,
  }).pipe(
    Schema.decodeTo(IdToken, {
      decode: SchemaGetter.transform((payload) =>
        Struct.renameKeys(Struct.assign(payload, { kind: Constants.GOOGLE } as const), {
          aud: "audience",
          sub: "userExternalId",
          hd: "externalId",
        }),
      ),
      encode: SchemaGetter.transform(
        Struct.renameKeys({ audience: "aud", externalId: "hd", userExternalId: "sub" }),
      ),
    }),
  );

  export class User extends Schema.Opaque<User, { readonly brand: unique symbol }>()(
    UsersContract.Table.Model.mapFields(
      Struct.pick(["displayName", "email", "externalId", "username"]),
    ),
  ) {}

  export const EntraIdUser = Schema.Struct({
    id: Schema.String,
    displayName: Schema.String,
    mail: Schema.String,
    userPrincipalName: Schema.String,
  }).pipe(
    Schema.decodeTo(User, {
      decode: SchemaGetter.transform(
        Struct.renameKeys({
          id: "externalId",
          displayName: "displayName",
          mail: "email",
          userPrincipalName: "username",
        }),
      ),
      encode: SchemaGetter.transform(
        Struct.renameKeys({
          displayName: "displayName",
          email: "mail",
          externalId: "id",
          username: "userPrincipalName",
        }),
      ),
    }),
  );

  export class Group extends Schema.Opaque<Group, { readonly brand: unique symbol }>()(
    GroupsContract.Table.Model.mapFields(Struct.pick(["externalId", "name"])),
  ) {}

  export const EntraIdGroup = Schema.Struct({
    displayName: Schema.String,
    id: Schema.String,
  }).pipe(
    Schema.decodeTo(Group, {
      decode: SchemaGetter.transform(Struct.renameKeys({ displayName: "name", id: "externalId" })),
      encode: SchemaGetter.transform(Struct.renameKeys({ externalId: "id", name: "displayName" })),
    }),
  );

  export class Table extends TablesContract.Table<IdentityProvidersTable>("identity_providers")(
    {
      ...TablesContract.BaseModel.fields,
      kind: Kind,
      externalId: ExternalId,
    },
    ["create", "read", "delete"],
    [],
  ) {}

  export class NotFoundError extends Schema.TaggedError<
    NotFoundError,
    { readonly brand: unique symbol }
  >()("IdentityProviderNotFoundError", Table.Dto.mapFields(Struct.pick(["kind", "externalId"]))) {}

  export class NotImplementedError
    extends Schema.TaggedError<NotImplementedError, { readonly brand: unique symbol }>()(
      "IdentityProviderNotImplementedError",
      { kind: Kind },
      { httpApiStatus: 501 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(NotImplementedError)(this, { status: 501 });
  }
}
