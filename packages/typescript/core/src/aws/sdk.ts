import { ServiceException } from "@smithy/smithy-client";
import * as Cause from "effect/Cause";
import * as Data from "effect/Data";

export class SdkError extends Data.TaggedError("SdkError")<globalThis.Error> {}

export const catchServiceExceptions = <const TTags extends ReadonlyArray<string>>(
  ...tags: TTags
): ((
  e: unknown,
) =>
  | { [TIndex in keyof TTags]: ServiceException & { _tag: TTags[TIndex] } }[number]
  | Cause.TimeoutError
  | SdkError) =>
  function (e: unknown) {
    if (ServiceException.isInstance(e) && tags.includes(e.name)) {
      class TaggedException extends Data.TaggedError(e.name)<ServiceException> {}

      return new TaggedException(e);
    }

    if (e instanceof globalThis.Error) {
      if (e.name === "TimeoutError") {
        return new Cause.TimeoutError(e.message);
      }

      return new SdkError(e);
    }

    throw e;
  };
