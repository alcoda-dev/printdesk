import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

export namespace Spa {
  export class Group extends HttpApiGroup.make("Spa").add(HttpApiEndpoint.get("assets", "*")) {}

  export class Api extends HttpApi.make("SpaApi").add(Group) {}
}
