import { makeResource } from "@printdesk/core/sst/client/resource";
import { env } from "cloudflare:workers";

export const resource = makeResource({ env });
