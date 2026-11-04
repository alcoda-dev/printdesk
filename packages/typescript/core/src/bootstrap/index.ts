import { Lambda } from "@effect-aws/client-lambda";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";

import { ClientsRepository } from "../clients/repository";
import { Hmac } from "../crypto/hmac";
import { LicensesContract } from "../licenses/contract";
import { LicensesManager } from "../licenses/manager";
import { OauthContract } from "../oauth/contract";
import { SstResource } from "../sst/resource";
import { BootstrapContract } from "./contract";

import type { TenantId } from "../utils";

export class Bootstrap extends Context.Service<Bootstrap>()("@printdesk/core/bootstrap/Bootstrap", {
  make: Effect.gen(function* () {
    const lambda = yield* Lambda;
    const licensesManager = yield* LicensesManager;
    const clientsRepository = yield* ClientsRepository;
    const hmac = yield* Hmac;
    const workflow = yield* SstResource.useSync((resource) =>
      resource.Bootstrapper.pipe(Redacted.value),
    );

    const createClient = Effect.fn("Bootstrap.createClient")(function* (
      licenseKeyPair: LicensesContract.KeyPair,
      tenantId: TenantId,
    ) {
      yield* licensesManager.verifyKeyPair(licenseKeyPair).pipe(
        Effect.catchTags({
          NoSuchElementError: () =>
            new LicensesContract.NoSuchLicenseError({ id: licenseKeyPair.id }),
          InvalidSecretError: () =>
            new LicensesContract.InvalidLicenseKeyError({ id: licenseKeyPair.id }),
        }),
        Effect.andThen(licensesManager.isAvailable(licenseKeyPair.id)),
        Effect.filterOrFail(
          Predicate.isTruthy,
          () => new LicensesContract.LicenseConflictError({ id: licenseKeyPair.id }),
        ),
      );

      const { key: bootstrapClientSecret, hash: bootstrapClientSecretHash } = yield* hmac.issue();
      const { id: bootstrapClientId } = yield* clientsRepository.create({
        name: "Bootstrap Client",
        role: "bootstrap",
        secretHash: bootstrapClientSecretHash,
        scopes: ["bootstrap"],
        tenantId,
      });

      return new OauthContract.ClientCredentials({
        id: bootstrapClientId,
        secret: bootstrapClientSecret,
      });
    });

    const invokeWorkflow = Effect.fn("Bootstrap.invokeWorkflow")(
      (payload: BootstrapContract.Payload) =>
        BootstrapContract.Payload.pipe(
          Schema.fromJsonString,
          Schema.encodeEffect,
          (encode) => encode(payload),
          Effect.flatMap((Payload) =>
            lambda.invoke({
              InvocationType: "Event",
              FunctionName: workflow.name,
              Qualifier: workflow.qualifier,
              DurableExecutionName: payload.tenant.id,
              Payload,
            }),
          ),
        ),
    );

    return {
      createClient,
      invokeWorkflow,
    } as const;
  }),
}) {
  public static readonly layer = this.make.pipe(Layer.effect(this));
}
