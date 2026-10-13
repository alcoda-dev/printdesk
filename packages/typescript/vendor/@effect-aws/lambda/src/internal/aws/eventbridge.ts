import { emptyResponseMapper } from "../utils.js";

import type { EventBridgeEvent } from "../../Types.js";
import type { EventSource } from "../types.js";

const getRequestValuesFromEventBridge = (event: EventBridgeEvent<string, unknown>) => {
  const method = "POST";
  const headers = { host: "events.amazonaws.com" };
  const body = event;

  return {
    method,
    headers,
    body,
  };
};

export default {
  getRequest: getRequestValuesFromEventBridge,
  getResponse: emptyResponseMapper,
} as EventSource<EventBridgeEvent<string, unknown>>;
