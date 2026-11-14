import * as Context from "effect/Context";

import type { SstResource } from "../sst/resource";

export class Aws extends Context.Service<Aws, SstResource["Service"]["Aws"]>()(
  "@printdesk/core/aws/Aws",
) {}
