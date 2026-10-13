import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Scope from "effect/Scope";

/**
 * @since 0.3.0
 */
import type {
  HttpRequest,
  HttpResponse,
  HttpHandlerOptions,
  RequestHandler as ClientRequestHandler,
  RequestHandlerOutput,
} from "@aws-sdk/types";
import type * as Cause from "effect/Cause";
import type { RuntimeOptions } from "./internal/httpHandler.js";

const TypeId = Symbol.for("@effect-aws/commons/RequestHandler");

type RequestHandlerConstructorProps = {
  readonly handle: (
    request: HttpRequest,
    handlerOptions?: HttpHandlerOptions,
  ) => Effect.Effect<RequestHandlerOutput<HttpResponse>, Cause.TimeoutError, Scope.Scope>;
};

/**
 * @since 0.3.0
 * @category model
 */
export interface RequestHandler extends RequestHandlerConstructorProps {
  readonly [TypeId]: typeof TypeId;
}

/**
 * @since 0.3.0
 * @category tag
 */
export const RequestHandler = Context.Service<RequestHandler>("@effect-aws/commons/RequestHandler");

const proto = {
  [TypeId]: TypeId,
};

/**
 * @since 0.3.0
 * @category constructors
 */
export const make = (options: RequestHandlerConstructorProps): RequestHandler =>
  Object.assign(Object.create(proto), options);

/**
 * @since 0.3.0
 * @category adapters
 */
export const toClientRequestHandler = (
  requestHandler: RequestHandler,
  config: RuntimeOptions,
): ClientRequestHandler<HttpRequest, HttpResponse, HttpHandlerOptions> => {
  const runPromise = Effect.runPromiseWith(config.runtime);
  const scoped = Scope.provide(config.scope);

  class HttpHandler implements ClientRequestHandler<HttpRequest, HttpResponse, HttpHandlerOptions> {
    // oxlint-disable-next-line class-methods-use-this
    public handle(request: HttpRequest, options: HttpHandlerOptions = {}) {
      return runPromise(requestHandler.handle(request, options).pipe(scoped), {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        signal: options.abortSignal as AbortSignal,
      });
    }
  }

  return new HttpHandler();
};
