import { emptyResponseMapper } from "../utils.js";

import type { DynamoDBStreamEvent } from "../../Types.js";
import type { EventSource } from "../types.js";

const getRequestValuesFromDynamoDB = (event: DynamoDBStreamEvent) => {
  const method = "POST";
  const headers = { host: "dynamodb.amazonaws.com" };
  const body = event;

  return {
    method,
    headers,
    body,
  };
};

export default {
  getRequest: getRequestValuesFromDynamoDB,
  getResponse: emptyResponseMapper,
} as EventSource<DynamoDBStreamEvent>;
