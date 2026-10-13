import { emptyResponseMapper } from "../utils.js";

import type { KinesisStreamEvent } from "../../Types.js";
import type { EventSource } from "../types.js";

const getRequestValuesFromKinesis = (event: KinesisStreamEvent) => {
  const method = "POST";
  const headers = { host: "kinesis.amazonaws.com" };
  const body = event;

  return {
    method,
    headers,
    body,
  };
};

export default {
  getRequest: getRequestValuesFromKinesis,
  getResponse: emptyResponseMapper,
} as EventSource<KinesisStreamEvent>;
