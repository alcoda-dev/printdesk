import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Atom from "effect/reactivity/Atom";
import * as Struct from "effect/Struct";

import { Bff } from "../bff/contract";

export const userActorAtomRuntime = FetchHttpClient.layer.pipe(Atom.runtime);

export const userActorAtom = userActorAtomRuntime.atom(
  HttpClient.HttpClient.pipe(
    Effect.flatMap((httpClient) => HttpApiClient.group(Bff, { httpClient, group: "Auth" })),
    Effect.flatMap((auth) => auth.me()),
  ),
);

export const actorAtom = Atom.make((get) =>
  get.resultOnce(userActorAtom).pipe(Effect.map(Struct.get("wrap"))),
);
