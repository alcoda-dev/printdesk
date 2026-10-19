import {
  InvalidAccessTokenError as OpenauthInvalidAccessTokenError,
  InvalidAuthorizationCodeError as OpenauthInvalidAuthorizationCodeError,
  InvalidRefreshTokenError as OpenauthInvalidRefreshTokenError,
} from "@openauthjs/openauth/error";
import * as Array from "effect/Array";
import * as Duration from "effect/Duration";
import * as HttpServerRespondable from "effect/http/HttpServerRespondable";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Record from "effect/Record";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Struct from "effect/Struct";
import * as Tuple from "effect/Tuple";

import { ActorsContract } from "../actors/contract";
import { ClientsContract } from "../clients/contract";
import { CryptoContract } from "../crypto/contract";
import { IdentityProvidersContract } from "../identity/contract";
import { TenantsContract } from "../tenants/contract";
import { UsersContract } from "../users/contract";
import { EntityId } from "../utils";
import { Constants } from "../utils/constants";

export namespace OauthContract {
  export class MultipleAuthenticationMethodsError
    extends Schema.TaggedError<
      MultipleAuthenticationMethodsError,
      { readonly brand: unique symbol }
    >()("MultipleAuthenticationMethodsError", {})
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(MultipleAuthenticationMethodsError)(this, { status: 400 });
  }

  export class OpenauthError
    extends Schema.TaggedError<OpenauthError, { readonly brand: unique symbol }>()(
      "OpenauthError",
      { cause: Schema.Defect() },
      { httpApiStatus: 500 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(OpenauthError)(this, { status: 500 });
  }

  export class AccessDeniedError
    extends Schema.TaggedError<AccessDeniedError, { readonly brand: unique symbol }>()(
      "OauthAccessDeniedError",
      {
        reason: Schema.Union([
          ClientsContract.InvalidStatusError,
          IdentityProvidersContract.NotFoundError,
          UsersContract.NotFoundError,
          UsersContract.InvalidStatusError,
          TenantsContract.InvalidStatusError,
        ]).pipe(Schema.toTaggedUnion("_tag")),
      },
    )
    implements HttpServerRespondable.Respondable
  {
    // oxlint-disable-next-line class-methods-use-this
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.json({ error: "access_denied" }, { status: 403 });
  }

  export class InvalidClientError
    extends Schema.TaggedError<InvalidClientError, { readonly brand: unique symbol }>()(
      "InvalidClientError",
      {
        id: ClientsContract.Table.Model.fields.id,
        reason: Schema.Union([
          CryptoContract.InvalidSecretError,
          ClientsContract.NotFoundError,
        ]).pipe(Schema.toTaggedUnion("_tag")),
      },
    )
    implements HttpServerRespondable.Respondable
  {
    // oxlint-disable-next-line class-methods-use-this
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.json({ error: "invalid_client" }, { status: 401 });
  }

  export class InvalidScopeError
    extends Schema.TaggedError<InvalidScopeError, { readonly brand: unique symbol }>()(
      "InvalidScopeError",
      {
        scopes: Schema.String.pipe(Schema.Array),
      },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.json(
        {
          error: "invalid_scope",
          // oxlint-disable-next-line effecttsgo/prefer-effect-array
          error_description: `Invalid requested scopes: ${this.scopes.join(", ")}`,
        },
        { status: 400 },
      );
  }

  export class InvalidAuthorizationCodeError
    extends Schema.TaggedError<InvalidAuthorizationCodeError, { readonly brand: unique symbol }>()(
      "InvalidAuthorizationCodeError",
      { cause: Schema.instanceOf(OpenauthInvalidAuthorizationCodeError) },
      { httpApiStatus: 400 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidAuthorizationCodeError)(this, { status: 400 });
  }

  export class InvalidAccessTokenError
    extends Schema.TaggedError<InvalidAccessTokenError, { readonly brand: unique symbol }>()(
      "InvalidAccessTokenError",
      { cause: Schema.instanceOf(OpenauthInvalidAccessTokenError) },
      { httpApiStatus: 401 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidAccessTokenError)(this, { status: 401 });
  }

  export class InvalidRefreshTokenError
    extends Schema.TaggedError<InvalidRefreshTokenError, { readonly brand: unique symbol }>()(
      "InvalidRefreshTokenError",
      { cause: Schema.instanceOf(OpenauthInvalidRefreshTokenError) },
      { httpApiStatus: 401 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidRefreshTokenError)(this, { status: 401 });
  }

  export class TokensError extends Schema.TaggedError<
    TokensError,
    { readonly brand: unique symbol }
  >()("TokensError", { cause: Schema.Defect() }) {}

  export class InvalidAudienceError
    extends Schema.TaggedError<InvalidAudienceError, { readonly brand: unique symbol }>()(
      "InvalidAudienceError",
      {
        expected: IdentityProvidersContract.Audience,
        received: IdentityProvidersContract.Audience,
      },
    )
    implements HttpServerRespondable.Respondable
  {
    // oxlint-disable-next-line class-methods-use-this
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.json(
        { error: "invalid_token", error_description: "Audience mismatch" },
        { status: 401 },
      );
  }

  interface Actable<TTag extends typeof ActorsContract.Actor.fields.properties.Type._tag> {
    actor: Extract<typeof ActorsContract.Actor.fields.properties.Type, { _tag: TTag }>;
  }

  export class ClientSubject
    extends Schema.TaggedClass<ClientSubject, { readonly brand: unique symbol }>()(
      "ClientSubject",
      {
        ...Struct.omit(ActorsContract.ClientActor.fields, ["_tag"]),
        scopes: Schema.NonEmptyString.pipe(Schema.Array, Schema.optional),
      },
    )
    implements Actable<typeof ActorsContract.ClientActor.Type._tag>
  {
    public get actor() {
      return new ActorsContract.ClientActor(Struct.omit(this, ["_tag"]));
    }
  }

  export class UserSubject
    extends Schema.TaggedClass<UserSubject, { readonly brand: unique symbol }>()(
      "UserSubject",
      Struct.omit(ActorsContract.UserActor.fields, ["_tag"]),
    )
    implements Actable<typeof ActorsContract.UserActor.Type._tag>
  {
    public get actor() {
      return new ActorsContract.UserActor(Struct.omit(this, ["_tag"]));
    }
  }

  export const subjects = {
    [ClientSubject.fields._tag.schema.literal]: ClientSubject.pipe(Schema.toStandardSchemaV1),
    [UserSubject.fields._tag.schema.literal]: UserSubject.pipe(Schema.toStandardSchemaV1),
  };

  export const Subject = Schema.Union(
    Array.map(
      Record.toEntries(subjects),
      ([type, properties]) =>
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        Schema.Struct({ type: Schema.Literal(type), properties }) as {
          readonly [TKey in keyof typeof subjects]: Schema.Struct<{
            type: Schema.Literal<TKey>;
            properties: (typeof subjects)[TKey];
          }>;
        }[keyof typeof subjects],
    ),
  );
  export type Subject = typeof Subject.Type;

  export class Tokens extends Schema.Class<Tokens, { readonly brand: unique symbol }>("Tokens")({
    access: Schema.NonEmptyString.pipe(Schema.RedactedFromValue),
    refresh: Schema.NonEmptyString.pipe(Schema.RedactedFromValue),
    expiresIn: Schema.Finite.pipe(
      Schema.decodeTo(Schema.Duration, {
        decode: SchemaGetter.transform(Duration.seconds),
        encode: SchemaGetter.transform(Duration.toSeconds),
      }),
      Schema.optional,
    ),
  }) {}

  export class AuthorizeError extends Schema.TaggedError<
    AuthorizeError,
    { readonly brand: unique symbol }
  >()("AuthorizeError", { cause: Schema.Defect() }, { httpApiStatus: 500 }) {}

  export class AuthorizeSuccess extends Schema.Class<
    AuthorizeSuccess,
    { readonly brand: unique symbol }
  >("AuthorizeSuccess")({
    challenge: Schema.Struct({
      state: Schema.NonEmptyString,
      verifier: Schema.NonEmptyString.pipe(Schema.optional),
    }),
    url: Schema.URLFromString,
  }) {}

  export class ExchangeError
    extends Schema.TaggedError<ExchangeError, { readonly brand: unique symbol }>()(
      "ExchangeError",
      { cause: Schema.Defect() },
      { httpApiStatus: 500 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(ExchangeError)(this, { status: 500 });
  }

  export class ExchangeSuccess extends Schema.Class<
    ExchangeSuccess,
    { readonly brand: unique symbol }
  >("ExchangeSuccess")({ tokens: Tokens }) {}

  export class RefreshError extends Schema.TaggedError<
    RefreshError,
    { readonly brand: unique symbol }
  >()("RefreshError", { cause: Schema.Defect() }) {}

  export class RefreshSuccess extends Schema.Class<
    RefreshSuccess,
    { readonly brand: unique symbol }
  >("RefreshSuccess")({ tokens: Tokens.pipe(Schema.OptionFromOptional) }) {}

  export class VerifyError
    extends Schema.TaggedError<VerifyError, { readonly brand: unique symbol }>()(
      "VerifyError",
      { cause: Schema.Defect() },
      { httpApiStatus: 500 },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(VerifyError)(this, { status: 500 });
  }

  export class ClientCredentials extends Schema.Class<
    ClientCredentials,
    { readonly brand: unique symbol }
  >("ClientCredentials")({ id: EntityId, secret: CryptoContract.Secret }) {}

  export class ClientCredentialsError extends Schema.TaggedError<
    ClientCredentialsError,
    { readonly brand: unique symbol }
  >()("ClientCredentialsError", { cause: Schema.Defect() }) {}

  export const VerifySuccess = Schema.Struct({
    tokens: Tokens.pipe(Schema.OptionFromOptional),
    audience: Schema.NonEmptyString,
    subject: Subject,
  }).pipe(Schema.encodeKeys({ audience: "aud" }));

  export const bearer = "Bearer " as const;
  export const BearerToken = Schema.TemplateLiteralParser([
    Schema.Literal(bearer),
    Schema.NonEmptyString,
  ]).pipe(
    Schema.decodeTo(Tokens.fields.access, {
      decode: SchemaGetter.transform(Tuple.get(1)),
      encode: SchemaGetter.transform((token) => Tuple.make(bearer, token)),
    }),
  );

  export const AuthCookies = Tokens.mapFields(Struct.pick(["access", "refresh"]))
    .mapFields(Struct.renameKeys({ access: "accessToken", refresh: "refreshToken" }))
    .mapFields(Struct.assign({ _tag: Schema.tagDefaultOmit("AuthCookies") }))
    .pipe(
      Schema.encodeKeys({
        accessToken: Constants.COOKIE_NAMES.ACCESS_TOKEN,
        refreshToken: Constants.COOKIE_NAMES.REFRESH_TOKEN,
      }),
    );

  export const Cookies = Schema.Union([Schema.Struct({}), AuthCookies]);

  export const AuthHeaders = Schema.Struct({
    _tag: Schema.tagDefaultOmit("AuthHeaders"),
    accessToken: BearerToken,
  }).pipe(Schema.encodeKeys({ accessToken: "authorization" }));

  export class InvalidCookiesError
    extends Schema.TaggedError<InvalidCookiesError, { readonly brand: unique symbol }>()(
      "InvalidCookiesError",
      { cause: Schema.instanceOf(Schema.SchemaError) },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidCookiesError)(this, { status: 400 });
  }

  export class InvalidHeadersError
    extends Schema.TaggedError<InvalidHeadersError, { readonly brand: unique symbol }>()(
      "InvalidHeadersError",
      { cause: Schema.instanceOf(Schema.SchemaError) },
    )
    implements HttpServerRespondable.Respondable
  {
    public [HttpServerRespondable.symbol] = () =>
      HttpServerResponse.schemaJson(InvalidHeadersError)(this, { status: 400 });
  }
}
