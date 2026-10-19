import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { ServiceShape } from "./layer";

export class PastMutationError extends Schema.TaggedError<
  PastMutationError,
  { readonly brand: unique symbol }
>()("PastMutationError", { mutationId: Schema.Int }) {
  public get log() {
    return Effect.log(
      `[ReplicachePusher]: Mutation "${this.mutationId}" already processed - skipping`,
    );
  }
}

export class ReplicachePusher extends Context.Service<ReplicachePusher, ServiceShape>()(
  "@printdesk/core/replicache/ReplicachePusher",
) {}
