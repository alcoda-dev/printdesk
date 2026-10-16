import type * as ByteSize from "effect/ByteSize";
import type * as Duration from "effect/Duration";
import type * as Cookies from "effect/http/Cookies";

export namespace Constants {
  export const TENANT_ID_PLACEHOLDER = "{{tenant_id}}";

  export const ENTRA_ID_OAUTH_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "User.ReadBasic.All",
  ] as const;

  export const ENTRA_ID_APP_ROLES = [
    "User.ReadBasic.All",
    "GroupMember.Read.All",
    "CustomSecAttributeProvisioning.Read.All",
    "Application.ReadWrite.OwnedBy",
  ] as const;

  export const ENTRA_ID_ADMIN_CONSENT_URL_TEMPLATE =
    "https://login.microsoftonline.com/{organization}/adminconsent?client_id={client-id}";

  export const ENTRA_ID_NON_GALLERY_APPLICATION_TEMPLATE_ID =
    "8adf8e6e-67b2-4cf2-a259-e3dc5476c621";
  export const ENTRA_ID_NON_GALLERY_APPLICATION_SCIM_SYNCHRONIZATION_JOB_TEMPLATE_ID = "scim";

  export const SST_RESOURCE_PREFIX = "SST_RESOURCE_";
  export const VITE_RESOURCE_PREFIX = "VITE_RESOURCE_";

  export const COOKIE_NAMES = {
    ACCESS_TOKEN: "access_token",
    REFRESH_TOKEN: "refresh_token",
  } as const;

  export const COOKIE_OPTIONS = {
    httpOnly: true,
    maxAge: "30 days",
    path: "/",
    sameSite: "lax",
    secure: true,
  } as const satisfies Cookies.Cookie["options"];

  export const URL_PARAM_NAMES = {
    REDIRECT_URI: "redirect_uri",
    TENANT_SLUG: "tenant_slug",
  } as const;

  export const OPENAUTH_CLIENT_IDS = {
    API: "api",
    API_GATEWAY: "api-gateway",
    ASSETS: "assets",
    BOOTSTRAPPER: "bootstrapper",
    INVOICES_PROCESSOR: "invoices-processor",
    PAPERCUT_MF_API_GATEWAY: "papercut-mf-api-gateway",
    PAPERCUT_MF_SYNC: "papercut-mf-sync",
    WEB: "web",
  } as const;
  export type OpenauthClientId = (typeof OPENAUTH_CLIENT_IDS)[keyof typeof OPENAUTH_CLIENT_IDS];

  export const ENTRA_ID = "entra_id";
  export const GOOGLE = "google";
  export const CLIENT_CREDENTIALS = "client_credentials";

  /**
   * - A transaction can modify up to 3,000 rows, regardless of the number of secondary indexes
   * - The 3,000-row limit applies to all DML statements (INSERT, UPDATE, DELETE)
   *
   * See: https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-postgresql-compatibility-unsupported-features.html#working-with-postgresql-compatibility-unsupported-limitations
   */
  export const DB_TRANSACTION_ROW_MODIFICATION_LIMIT = 3_000;

  export const DB_SCHEMA_VERSION = 1;
  export const DB_TRANSACTION_MAX_RETRIES = 10;

  export const DYNAMO_SECONDARY_INDEXES = {
    GSI1: "gsi1",
  } as const;
  export const DYNAMO_KEYS = {
    PK: "pk",
    SK: "sk",
    GSI1_PK: `${DYNAMO_SECONDARY_INDEXES.GSI1}Pk`,
    GSI1_SK: `${DYNAMO_SECONDARY_INDEXES.GSI1}Sk`,
  } as const;
  export const KEY_LITERALS = {
    CALLBACK: "CALLBACK",
    CLIENT: "CLIENT",
    DEPLOYMENT: "DEPLOYMENT",
    INFRA: "INFRA",
    INPUT: "INPUT",
    IP: "IP",
    ORDER: "ORDER",
    OUTPUT: "OUTPUT",
    PAPERCUT_MF_API: "PAPERCUT_MF_API",
    ROOM: "ROOM",
    SERVICE: "SERVICE",
    TENANT: "TENANT",
    USER: "USER",
  } as const;

  export const VARCHAR_LENGTH = 50;

  export const PAPERCUT_MF_API_PATH = "/rpc/api/xmlrpc";
  export const PAPERCUT_MF_API_PAGINATION_LIMIT = 1_000;
  export const PAPERCUT_MF_API_REQUEST_BATCH_SIZE = 50;
  export const PAPERCUT_MF_API_REQUEST_BATCH_DELAY = "100 millis" satisfies Duration.Input;

  export const GRAPH_REQUEST_BATCH_SIZE = 50;
  export const GRAPH_REQUEST_BATCH_DELAY = "100 millis" satisfies Duration.Input;

  export const WEB_BFF_PATHS = {
    login: "/login",
    oauthCallback: "/oauth/callback",
  } as const;

  export const IMAGE_MIME_TYPE_ALLOWLIST = [
    "image/jpeg",
    "image/png",
    "image/svg+xml",
    "image/gif",
  ] as const;
  export const IMAGE_BYTE_SIZE_LIMIT = "250 kB" satisfies ByteSize.Input;

  export const DEFAULT_PAPERCUT_MF_SYNC_CRON_EXPRESSION = "55 1 * * ? *";
  export const DEFAULT_ORDER_OBJECT_MIME_TYPE_ALLOWLIST = ["application/pdf"] as const;
  export const DEFAULT_ORDER_OBJECT_BYTE_SIZE_LIMIT = "10 MB" satisfies ByteSize.Input;

  /** This order of characters is optimized for better gzip and brotli compression. */
  export const NANOID_ALPHABET = "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";
  export const NANOID_LENGTH = 11;

  export const REPLICACHE_LIFETIME = "2 weeks" satisfies Duration.Input;
  export const REPLICACHE_SYNC_STATE_KEY = "control/sync_state";

  export const SOFT_DELETE_LIFETIME = "12 weeks" satisfies Duration.Input;

  export const NANOID_REGEX = new RegExp(
    // oxlint-disable-next-line typescript/no-misused-spread effecttsgo/prefer-effect-array
    `^[${[...NANOID_ALPHABET].toSorted().join("")}]{${NANOID_LENGTH}}$`,
  );
  export const TENANT_SLUG_REGEX = new RegExp(/^[a-z0-9-]+$/);
  export const MONTH_TRUNCATED_ISO_DATE_REGEX = new RegExp(/^\d{4}-(?:0[1-9]|1[0-2])$/u);
  export const ISO_TIMESTAMP_REGEX = new RegExp(
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])[T ](?:0\d|1\d|2[0-3])(?::[0-5]\d){2}(?:\.\d{1,9})?(?:Z|[+-](?:0\d|1\d|2[0-3])(?::?[0-5]\d)?)$/u,
  );
  export const ISO_DATE_REGEX = new RegExp(/^\d{4}-(?:0[1-9]|1[0-2])-(?:[12]\d|0[1-9]|3[01])$/u);
  export const HEX_COLOR_REGEX = new RegExp(/^#(?:[\da-fA-F]{3,4}|[\da-fA-F]{6}|[\da-fA-F]{8})$/u);
  export const IPV4_REGEX = new RegExp(
    /^(?:(?:[1-9]|1\d|2[0-4])?\d|25[0-5])(?:\.(?:(?:[1-9]|1\d|2[0-4])?\d|25[0-5])){3}$/u,
  );

  export const SEPARATOR = String.fromCharCode(0x1f);

  export const DEFAULT_LAYER_MAP_IDLE_TTL = "1 minute" satisfies Duration.Input;

  export const DEFAULT_CACHE_CAPACITY = 10;

  export const FORWARDED_AUTHORIZATION_HEADER_NAME = "x-forwarded-authorization";
}
