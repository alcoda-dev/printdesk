import { serve } from "@hono/node-server";

import { fetch, host, port } from "./server";

serve({ fetch, hostname: host.toString(), port });
