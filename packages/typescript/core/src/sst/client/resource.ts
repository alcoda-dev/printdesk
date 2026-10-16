import * as Array from "effect/Array";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";

import { Constants } from "../../utils/constants";

import type { Resource } from "sst/resource";

// oxlint-disable-next-line typescript/no-explicit-any
type Env = Record<string, any>;

type ResourceKey<
  TKey extends string,
  TPrefix extends string,
  TPrefixedOnly extends boolean,
> = TKey extends `${TPrefix}${infer TSuffix}`
  ? TSuffix
  : TPrefixedOnly extends true
    ? never
    : string extends TKey
      ? never
      : TKey;

export type RedactedResource<
  TEnv extends Env,
  TPrefix extends string,
  TPrefixedOnly extends boolean,
> = {
  readonly [TKey in keyof TEnv as ResourceKey<TKey & string, TPrefix, TPrefixedOnly>]: ResourceKey<
    TKey & string,
    TPrefix,
    TPrefixedOnly
  > extends keyof Resource
    ? Redacted.Redacted<Resource[ResourceKey<TKey & string, TPrefix, TPrefixedOnly>]>
    : Redacted.Redacted<TEnv[TKey]>;
};

export function makeResource<
  TEnv extends Env,
  TPrefix extends string = typeof Constants.SST_RESOURCE_PREFIX,
  TPrefixedOnly extends boolean = false,
>({
  env,
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  prefix = Constants.SST_RESOURCE_PREFIX as TPrefix,
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  prefixedOnly = false as TPrefixedOnly,
}: {
  env: TEnv;
  prefix?: TPrefix;
  prefixedOnly?: TPrefixedOnly;
}) {
  const target = Array.reduce(
    Record.toEntries(env),
    // oxlint-disable-next-line typescript/no-explicit-any
    Record.empty<string, any>(),
    function (target, [key, value]) {
      if (key.startsWith(prefix))
        target[key.slice(prefix.length)] = Redacted.make(JSON.parse(value));
      else if (!prefixedOnly) target[key] = Redacted.make(value);
      return target;
    },
  );

  return new Proxy(target, {
    get(target, key: string) {
      if (key in target) return target[key];

      throw new Error(`Resource "${key}" is not linked.`);
    },
    getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true }),
    ownKeys: () => Record.keys(target),
  }) as RedactedResource<TEnv, TPrefix, TPrefixedOnly>;
}
