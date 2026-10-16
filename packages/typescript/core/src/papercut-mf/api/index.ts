import * as Context from "effect/Context";
import * as Request from "effect/Request";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

import { GroupsContract } from "../../groups/contracts";
import { SharedAccountsContract } from "../../shared-accounts/contracts";
import { UsersContract } from "../../users/contract";
import { separatedString, StringFromUnknown } from "../../utils";

import type { HttpClientError } from "effect/http/HttpClientError";
import type { HttpClientRequest } from "effect/http/HttpClientRequest";
import type { HttpClientResponse } from "effect/http/HttpClientResponse";
import type { Actor } from "../../actors";
import type { ActorsContract } from "../../actors/contract";
import type { Oauth } from "../../oauth";
import type { ServiceShape } from "./layer";

const CommaSeparatedString = separatedString(",");

export const sharedAccountPropertySchemas = {
  "access-groups": CommaSeparatedString.pipe(
    Schema.decodeTo(GroupsContract.Name.pipe(Schema.Array), SchemaTransformation.passthrough()),
  ),
  "access-users": CommaSeparatedString.pipe(
    Schema.decodeTo(UsersContract.Username.pipe(Schema.Array), SchemaTransformation.passthrough()),
  ),
  "account-id": SharedAccountsContract.PapercutMfId,
  balance: Schema.Finite,
  "comment-option": Schema.Literals(["NO_COMMENT", "COMMENT_REQUIRED", "COMMENT_OPTIONAL"]),
  disabled: Schema.Boolean,
  "invoice-option": Schema.Literals([
    "ALWAYS_INVOICE",
    "NEVER_INVOICE",
    "USER_CHOICE_ON",
    "USER_CHOICE_OFF",
  ]),
  notes: Schema.String,
  "overdraft-amount": Schema.Finite,
  pin: StringFromUnknown,
  restricted: Schema.Boolean,
} as const;
export type SharedAccountPropertySchemas = typeof sharedAccountPropertySchemas;

export class PapercutMfApiRequest extends Request.Class<
  HttpClientRequest,
  HttpClientResponse,
  ActorsContract.ForbiddenActorError | HttpClientError | Schema.SchemaError,
  Actor | Oauth.AccessToken
> {}

export class PapercutMfApi extends Context.Service<PapercutMfApi, ServiceShape>()(
  "@printdesk/core/papercut-mf/Api",
) {}
