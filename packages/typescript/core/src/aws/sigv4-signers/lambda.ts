import { AwsClient } from "aws4fetch";
import * as Struct from "effect/Struct";

export class LambdaWebFunctionClient extends AwsClient {
  public constructor(...[opts]: ConstructorParameters<typeof AwsClient>) {
    super({ ...opts, service: opts.service ?? "lambda" });
  }

  public override fetch(...[input, init]: Parameters<AwsClient["fetch"]>) {
    const request =
      input instanceof Request ? input : new Request(input.toString(), init ?? undefined);

    if (init?.headers)
      for (const [key, value] of new Headers(init.headers)) request.headers.set(key, value);

    request.headers.set("x-amz-content-sha256", "UNSIGNED-PAYLOAD");

    return super.fetch(request, { redirect: "manual", ...Struct.omit(init ?? {}, ["headers"]) });
  }
}
