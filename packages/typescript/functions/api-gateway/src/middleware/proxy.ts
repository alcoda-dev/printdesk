import { Constants } from "@printdesk/core/utils/constants";
import * as Boolean from "effect/Boolean";
import * as HashSet from "effect/HashSet";
import * as Record from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as String from "effect/String";
import { every } from "hono/combine";
import { createMiddleware } from "hono/factory";
import { proxy as honoProxy } from "hono/proxy";

import { assets } from "../lib/assets";
import { lambda } from "../lib/aws";
import { resource } from "../lib/sst";
import { ratelimit } from "./ratelimit";

import type { BlankInput } from "hono/types";

const services = {
  api: {
    baseUrl: new URL(resource.Api.pipe(Redacted.value).url),
    customFetch: (req) => lambda.fetch(req, { redirect: "manual" }),
  },
  auth: {
    baseUrl: new URL(resource.Issuer.pipe(Redacted.value).url),
    customFetch: (req) => lambda.fetch(req, { redirect: "manual" }),
  },
  assets: {
    baseUrl: new URL("https://assets.printdesk.internal"),
    customFetch: (req) => assets.fetch(req),
  },
} satisfies Record<string, { baseUrl: URL; customFetch: (req: Request) => Promise<Response> }>;

const headerRemovalFilterSet = HashSet.make<ReadonlyArray<Lowercase<string>>>(
  Constants.FORWARDED_AUTHORIZATION_HEADER_NAME,
  "cf-connecting-ip",
  "cf-ipcountry",
  "cf-ray",
  "x-forwarded-for",
  "x-real-ip",
);

export const proxy = (service: keyof typeof services) =>
  every(
    ratelimit(service),
    createMiddleware<BlankInput, `/${string}/:path{.+}`>(function (c) {
      const { baseUrl, customFetch } = services[service];

      const url = new URL(c.req.param("path"), baseUrl);
      url.search = new URL(c.req.url).search;

      const headers = new Headers(
        Record.filter(c.req.header(), (_, name) =>
          headerRemovalFilterSet.pipe(HashSet.has(String.toLowerCase(name)), Boolean.not),
        ),
      );
      const authorization = c.req.header("Authorization");
      if (authorization) headers.set(Constants.FORWARDED_AUTHORIZATION_HEADER_NAME, authorization);

      return honoProxy(url, {
        customFetch,
        headers,
        raw: c.req.raw,
      });
    }),
  );
