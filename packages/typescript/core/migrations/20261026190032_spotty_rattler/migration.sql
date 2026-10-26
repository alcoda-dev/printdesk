CREATE TABLE "announcements" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"room_id" char(11) NOT NULL,
	"author_id" char(11) NOT NULL,
	CONSTRAINT "announcements_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "clients" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"name" varchar(50) NOT NULL,
	"secret_hash" varchar(113) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"role" varchar(50) NOT NULL,
	"scopes" jsonb NOT NULL,
	"callback_id" text,
	"identity_provider_id" char(11),
	CONSTRAINT "clients_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "comments" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"order_id" char(11) NOT NULL,
	"author_id" char(11) NOT NULL,
	"content" text NOT NULL,
	"internal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "comments_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "delivery_options" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" varchar(50) NOT NULL,
	"details_label" varchar(50),
	"cost" numeric,
	"room_id" char(11) NOT NULL,
	CONSTRAINT "delivery_options_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "group_memberships" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"group_id" char(11) NOT NULL,
	"user_id" char(11) NOT NULL,
	CONSTRAINT "group_memberships_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "groups" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"external_id" text NOT NULL,
	"identity_provider_id" char(11) NOT NULL,
	CONSTRAINT "groups_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "groups_name_tenant_id_unique" UNIQUE("name", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "identity_providers" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"kind" varchar(50) NOT NULL,
	"external_id" text NOT NULL,
	CONSTRAINT "identity_providers_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"line_items" jsonb NOT NULL,
	"status" varchar(50) DEFAULT 'processing' NOT NULL,
	"charged_at" timestamp,
	"order_id" char(11) NOT NULL,
	CONSTRAINT "invoices_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "charged_status" CHECK (
		(
			(
				(
					("status" = 'charged')
					and (("charged_at" is not null))
				)
			)
			or (
				(
					("status" <> 'charged')
					and (("charged_at" is null))
				)
			)
		)
	)
);

--> statement-breakpoint
CREATE TABLE "licenses" (
	"id" char(11) PRIMARY KEY,
	"key_hash" varchar(113) NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);

--> statement-breakpoint
CREATE TABLE "order_object_metadata" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"order_id" char(11) NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"status" varchar(50) NOT NULL,
	CONSTRAINT "order_object_metadata_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "order_object_metadata_order_id_filename_tenant_id_unique" UNIQUE("order_id", "filename", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "orders" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"short_id" integer,
	"customer_id" char(11) NOT NULL,
	"manager_id" char(11),
	"operator_id" char(11),
	"product_id" char(11) NOT NULL,
	"shared_account_id" char(11),
	"room_workflow_status_id" char(11),
	"shared_account_workflow_status_id" char(11),
	"delivery_option_id" char(11),
	"attributes" jsonb,
	"approved_at" timestamp,
	CONSTRAINT "orders_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "status_validity" CHECK (
		(
			("status" = 'draft')
			or (
				(
					("status" = 'submitted')
					and (("attributes" is not null))
					and (("delivery_option_id" is not null))
				)
			)
		)
	),
	CONSTRAINT "workflow_status_id_xor" CHECK (
		("room_workflow_status_id" is null) <> ("shared_account_workflow_status_id" is null)
	)
);

--> statement-breakpoint
CREATE TABLE "products" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"room_id" char(11) NOT NULL,
	"config" jsonb NOT NULL,
	CONSTRAINT "products_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "replicache_client_groups" (
	"id" uuid,
	"tenant_id" char(11),
	"user_id" char(11) NOT NULL,
	"client_version" integer NOT NULL,
	"client_view_version" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "replicache_client_groups_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "replicache_client_view_entries" (
	"client_group_id" uuid,
	"client_view_version" integer NOT NULL,
	"entity" varchar(50),
	"entity_id" char(11),
	"entity_version" integer,
	"tenant_id" char(11),
	CONSTRAINT "replicache_client_view_entries_pkey" PRIMARY KEY(
		"client_group_id",
		"entity",
		"entity_id",
		"tenant_id"
	)
);

--> statement-breakpoint
CREATE TABLE "replicache_client_views" (
	"client_group_id" uuid,
	"version" integer,
	"client_version" integer NOT NULL,
	"tenant_id" char(11),
	CONSTRAINT "replicache_client_views_pkey" PRIMARY KEY("client_group_id", "version", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "replicache_clients" (
	"id" uuid,
	"tenant_id" char(11),
	"client_group_id" uuid NOT NULL,
	"last_mutation_id" bigint DEFAULT 0 NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "replicache_clients_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "replicache_meta" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL
);

--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'draft' NOT NULL,
	"details" text,
	CONSTRAINT "rooms_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "rooms_name_tenant_id_unique" UNIQUE("name", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "shared_account_customer_access" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"customer_id" char(11) NOT NULL,
	"shared_account_id" char(11) NOT NULL,
	CONSTRAINT "shared_account_customer_access_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "shared_account_group_customer_access" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"group_id" char(11) NOT NULL,
	"shared_account_id" char(11) NOT NULL,
	CONSTRAINT "shared_account_group_customer_access_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "shared_account_manager_access" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"manager_id" char(11) NOT NULL,
	"shared_account_id" char(11) NOT NULL,
	CONSTRAINT "shared_account_manager_access_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "shared_accounts" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"origin" varchar(50) DEFAULT 'internal' NOT NULL,
	"name" text NOT NULL,
	"review_threshold" numeric,
	"papercut_mf_id" bigint,
	CONSTRAINT "shared_accounts_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "shared_accounts_name_papercut_mf_id_tenant_id_unique" UNIQUE("name", "papercut_mf_id", "tenant_id"),
	CONSTRAINT "origin_papercut_mf_id" CHECK (
		(
			(
				(
					("origin" = 'papercut')
					and (("papercut_mf_id" is not null))
				)
			)
			or (
				(
					("origin" = 'internal')
					and (("papercut_mf_id" is null))
				)
			)
		)
	)
);

--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"slug" varchar(50) NOT NULL,
	"name" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'setup' NOT NULL,
	"last_papercut_sync_at" timestamp,
	"license_id" char(11) NOT NULL,
	CONSTRAINT "tenants_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "tenant_id" CHECK ("id" = "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "users" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"username" text NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"identity_provider_id" char(11) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"role" varchar(50) DEFAULT 'customer' NOT NULL,
	CONSTRAINT "users_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "users_username_identity_provider_id_tenant_id_unique" UNIQUE("username", "identity_provider_id", "tenant_id"),
	CONSTRAINT "users_external_id_identity_provider_id_tenant_id_unique" UNIQUE(
		"external_id",
		"identity_provider_id",
		"tenant_id"
	),
	CONSTRAINT "users_email_identity_provider_id_tenant_id_unique" UNIQUE("email", "identity_provider_id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "room_workflows" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"room_id" char(11) NOT NULL,
	CONSTRAINT "room_workflows_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "shared_account_workflows" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"shared_account_id" char(11) NOT NULL,
	CONSTRAINT "shared_account_workflows_pkey" PRIMARY KEY("id", "tenant_id")
);

--> statement-breakpoint
CREATE TABLE "workflow_statuses" (
	"id" char(11),
	"tenant_id" char(11),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"charging" boolean NOT NULL,
	"color" varchar(9),
	"index" smallint NOT NULL,
	"shared_account_workflow_id" char(11),
	"room_workflow_id" char(11),
	CONSTRAINT "workflow_statuses_pkey" PRIMARY KEY("id", "tenant_id"),
	CONSTRAINT "workflow_statuses_room_workflow_id_index_unique" UNIQUE("room_workflow_id", "index"),
	CONSTRAINT "workflow_statuses_shared_account_workflow_id_index_unique" UNIQUE("shared_account_workflow_id", "index"),
	CONSTRAINT "workflow_xor" CHECK (
		("shared_account_workflow_id" is null) <> ("room_workflow_id" is null)
	)
);

--> statement-breakpoint
CREATE UNIQUE INDEX "clients_id_index" ON "clients" ("id");

--> statement-breakpoint
CREATE INDEX "comments_order_id_index" ON "comments" ("order_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "group_memberships_group_id_user_id_tenant_id_index" ON "group_memberships" ("group_id", "user_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "group_memberships_group_id_tenant_id_index" ON "group_memberships" ("group_id", "tenant_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "groups_external_id_tenant_id_index" ON "groups" ("external_id", "tenant_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "identity_providers_kind_tenant_id_index" ON "identity_providers" ("kind", "tenant_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "identity_providers_external_id_tenant_id_index" ON "identity_providers" ("external_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "invoices_order_id_index" ON "invoices" ("order_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "licenses_key_hash_index" ON "licenses" ("key_hash");

--> statement-breakpoint
CREATE INDEX "orders_customer_id_index" ON "orders" ("customer_id");

--> statement-breakpoint
CREATE INDEX "orders_shared_account_id_index" ON "orders" ("shared_account_id");

--> statement-breakpoint
CREATE INDEX "orders_room_workflow_status_id_index" ON "orders" ("room_workflow_status_id");

--> statement-breakpoint
CREATE INDEX "orders_shared_account_workflow_status_id_index" ON "orders" ("shared_account_workflow_status_id");

--> statement-breakpoint
CREATE INDEX "products_status_index" ON "products" ("status");

--> statement-breakpoint
CREATE INDEX "products_room_id_index" ON "products" ("room_id");

--> statement-breakpoint
CREATE INDEX "replicache_client_groups_updated_at_index" ON "replicache_client_groups" ("updated_at");

--> statement-breakpoint
CREATE UNIQUE INDEX "replicache_client_view_entries_client_group_id_client_view_version_entity_entity_id_entity_version_tenant_id_index" ON "replicache_client_view_entries" (
	"client_group_id",
	"client_view_version",
	"entity",
	"entity_id",
	"entity_version",
	"tenant_id"
);

--> statement-breakpoint
CREATE INDEX "replicache_clients_client_group_id_index" ON "replicache_clients" ("client_group_id");

--> statement-breakpoint
CREATE INDEX "replicache_clients_updated_at_index" ON "replicache_clients" ("updated_at");

--> statement-breakpoint
CREATE INDEX "rooms_status_index" ON "rooms" ("status");

--> statement-breakpoint
CREATE UNIQUE INDEX "shared_account_customer_access_customer_id_shared_account_id_tenant_id_index" ON "shared_account_customer_access" ("customer_id", "shared_account_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "shared_account_customer_access_customer_id_index" ON "shared_account_customer_access" ("customer_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "shared_account_group_customer_access_group_id_shared_account_id_tenant_id_index" ON "shared_account_group_customer_access" ("group_id", "shared_account_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "shared_account_group_customer_access_group_id_index" ON "shared_account_group_customer_access" ("group_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "shared_account_manager_access_shared_account_id_manager_id_tenant_id_index" ON "shared_account_manager_access" ("shared_account_id", "manager_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "shared_account_manager_access_manager_id_index" ON "shared_account_manager_access" ("manager_id");

--> statement-breakpoint
CREATE INDEX "shared_accounts_origin_tenant_id_index" ON "shared_accounts" ("origin", "tenant_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_index" ON "tenants" ("slug");

--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_license_id_index" ON "tenants" ("license_id");

--> statement-breakpoint
CREATE INDEX "users_external_id_index" ON "users" ("external_id");

--> statement-breakpoint
CREATE INDEX "users_identity_provider_id_index" ON "users" ("identity_provider_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "room_workflows_room_id_tenant_id_index" ON "room_workflows" ("room_id", "tenant_id");

--> statement-breakpoint
CREATE UNIQUE INDEX "shared_account_workflows_shared_account_id_tenant_id_index" ON "shared_account_workflows" ("shared_account_id", "tenant_id");

--> statement-breakpoint
CREATE INDEX "workflow_statuses_room_workflow_id_index" ON "workflow_statuses" ("room_workflow_id");

--> statement-breakpoint
CREATE VIEW "active_rooms" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"status",
		"details"
	from
		"rooms"
	where
		("rooms"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_published_rooms" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"status",
		"details"
	from
		"active_rooms"
	where
		"active_rooms"."status" = 'published'
);

--> statement-breakpoint
CREATE VIEW "active_announcements" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"content",
		"room_id",
		"author_id"
	from
		"announcements"
	where
		("announcements"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_published_room_announcements" AS (
	select
		"active_announcements"."id",
		"active_announcements"."tenant_id",
		"active_announcements"."created_at",
		"active_announcements"."updated_at",
		"active_announcements"."deleted_at",
		"active_announcements"."version",
		"active_announcements"."content",
		"active_announcements"."room_id",
		"active_announcements"."author_id"
	from
		"active_announcements"
		inner join "active_published_rooms" on (
			(
				"active_announcements"."room_id" = "active_published_rooms"."id"
			)
			and (
				"active_announcements"."tenant_id" = "active_published_rooms"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_group_memberships" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"group_id",
		"user_id"
	from
		"group_memberships"
	where
		("group_memberships"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_groups" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"external_id",
		"identity_provider_id"
	from
		"groups"
	where
		("groups"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_membership_groups" AS (
	select
		"active_groups"."id",
		"active_groups"."tenant_id",
		"active_groups"."created_at",
		"active_groups"."updated_at",
		"active_groups"."deleted_at",
		"active_groups"."version",
		"active_groups"."name",
		"active_groups"."external_id",
		"active_groups"."identity_provider_id",
		"active_group_memberships"."user_id"
	from
		"active_groups"
		inner join "active_group_memberships" on (
			(
				"active_groups"."id" = "active_group_memberships"."group_id"
			)
			and (
				"active_groups"."tenant_id" = "active_group_memberships"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_shared_account_customer_access" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"customer_id",
		"shared_account_id"
	from
		"shared_account_customer_access"
	where
		(
			"shared_account_customer_access"."deleted_at" is null
		)
);

--> statement-breakpoint
CREATE VIEW "active_shared_account_manager_access" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"manager_id",
		"shared_account_id"
	from
		"shared_account_manager_access"
	where
		(
			"shared_account_manager_access"."deleted_at" is null
		)
);

--> statement-breakpoint
CREATE VIEW "active_customer_authorized_shared_account_manager_access" AS (
	select
		"active_shared_account_manager_access"."id",
		"active_shared_account_manager_access"."tenant_id",
		"active_shared_account_manager_access"."created_at",
		"active_shared_account_manager_access"."updated_at",
		"active_shared_account_manager_access"."deleted_at",
		"active_shared_account_manager_access"."version",
		"active_shared_account_manager_access"."manager_id",
		"active_shared_account_manager_access"."shared_account_id",
		"active_shared_account_customer_access"."customer_id"
	from
		"active_shared_account_manager_access"
		inner join "active_shared_account_customer_access" on (
			(
				"active_shared_account_manager_access"."shared_account_id" = "active_shared_account_customer_access"."shared_account_id"
			)
			and (
				"active_shared_account_manager_access"."tenant_id" = "active_shared_account_customer_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_shared_accounts" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"origin",
		"name",
		"review_threshold",
		"papercut_mf_id"
	from
		"shared_accounts"
	where
		("shared_accounts"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_authorized_shared_accounts" AS (
	select
		"active_shared_accounts"."id",
		"active_shared_accounts"."tenant_id",
		"active_shared_accounts"."created_at",
		"active_shared_accounts"."updated_at",
		"active_shared_accounts"."deleted_at",
		"active_shared_accounts"."version",
		"active_shared_accounts"."origin",
		"active_shared_accounts"."name",
		"active_shared_accounts"."review_threshold",
		"active_shared_accounts"."papercut_mf_id",
		"active_shared_account_customer_access"."customer_id"
	from
		"active_shared_accounts"
		inner join "active_shared_account_customer_access" on (
			(
				"active_shared_accounts"."id" = "active_shared_account_customer_access"."shared_account_id"
			)
			and (
				"active_shared_accounts"."tenant_id" = "active_shared_account_customer_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_accounts" AS (
	select
		"active_shared_accounts"."id",
		"active_shared_accounts"."tenant_id",
		"active_shared_accounts"."created_at",
		"active_shared_accounts"."updated_at",
		"active_shared_accounts"."deleted_at",
		"active_shared_accounts"."version",
		"active_shared_accounts"."origin",
		"active_shared_accounts"."name",
		"active_shared_accounts"."review_threshold",
		"active_shared_accounts"."papercut_mf_id",
		"active_shared_account_manager_access"."manager_id"
	from
		"active_shared_accounts"
		inner join "active_shared_account_manager_access" on (
			(
				"active_shared_accounts"."id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_shared_accounts"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_shared_account_group_customer_access" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"group_id",
		"shared_account_id"
	from
		"shared_account_group_customer_access"
	where
		(
			"shared_account_group_customer_access"."deleted_at" is null
		)
);

--> statement-breakpoint
CREATE VIEW "active_authorized_shared_account_group_customer_access" AS (
	select
		"active_shared_account_group_customer_access"."id",
		"active_shared_account_group_customer_access"."tenant_id",
		"active_shared_account_group_customer_access"."created_at",
		"active_shared_account_group_customer_access"."updated_at",
		"active_shared_account_group_customer_access"."deleted_at",
		"active_shared_account_group_customer_access"."version",
		"active_shared_account_group_customer_access"."group_id",
		"active_shared_account_group_customer_access"."shared_account_id",
		"active_group_memberships"."user_id"
	from
		"active_shared_account_group_customer_access"
		inner join "active_group_memberships" on (
			(
				"active_shared_account_group_customer_access"."group_id" = "active_group_memberships"."group_id"
			)
			and (
				"active_shared_account_group_customer_access"."tenant_id" = "active_group_memberships"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_orders" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"status",
		"short_id",
		"customer_id",
		"manager_id",
		"operator_id",
		"product_id",
		"shared_account_id",
		"room_workflow_status_id",
		"shared_account_workflow_status_id",
		"delivery_option_id",
		"attributes",
		"approved_at"
	from
		"orders"
	where
		("orders"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_orders" AS (
	select
		"active_orders"."id",
		"active_orders"."tenant_id",
		"active_orders"."created_at",
		"active_orders"."updated_at",
		"active_orders"."deleted_at",
		"active_orders"."version",
		"active_orders"."status",
		"active_orders"."short_id",
		"active_orders"."customer_id",
		"active_orders"."manager_id",
		"active_orders"."operator_id",
		"active_orders"."product_id",
		"active_orders"."shared_account_id",
		"active_orders"."room_workflow_status_id",
		"active_orders"."shared_account_workflow_status_id",
		"active_orders"."delivery_option_id",
		"active_orders"."attributes",
		"active_orders"."approved_at",
		"active_shared_account_manager_access"."manager_id" as "authorized_manager_id"
	from
		"active_orders"
		inner join "active_shared_account_manager_access" on (
			(
				"active_orders"."shared_account_id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_orders"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_comments" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"order_id",
		"author_id",
		"content",
		"internal"
	from
		"comments"
	where
		("comments"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_order_comments" AS (
	select
		"active_comments"."id",
		"active_comments"."tenant_id",
		"active_comments"."created_at",
		"active_comments"."updated_at",
		"active_comments"."deleted_at",
		"active_comments"."version",
		"active_comments"."order_id",
		"active_comments"."author_id",
		"active_comments"."content",
		"active_comments"."internal",
		"active_orders"."customer_id"
	from
		"active_comments"
		inner join "active_orders" on (
			(
				"active_comments"."order_id" = "active_orders"."id"
			)
			and (
				"active_comments"."tenant_id" = "active_orders"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_order_comments" AS (
	select
		"active_comments"."id",
		"active_comments"."tenant_id",
		"active_comments"."created_at",
		"active_comments"."updated_at",
		"active_comments"."deleted_at",
		"active_comments"."version",
		"active_comments"."order_id",
		"active_comments"."author_id",
		"active_comments"."content",
		"active_comments"."internal",
		"active_shared_account_manager_access"."manager_id"
	from
		"active_comments"
		inner join "active_orders" on (
			(
				"active_comments"."order_id" = "active_orders"."id"
			)
			and (
				"active_comments"."tenant_id" = "active_orders"."tenant_id"
			)
		)
		inner join "active_shared_account_manager_access" on (
			(
				"active_orders"."shared_account_id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_orders"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_delivery_options" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"description",
		"details_label",
		"cost",
		"room_id"
	from
		"delivery_options"
	where
		("delivery_options"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_published_room_delivery_options" AS (
	select
		"active_delivery_options"."id",
		"active_delivery_options"."tenant_id",
		"active_delivery_options"."created_at",
		"active_delivery_options"."updated_at",
		"active_delivery_options"."deleted_at",
		"active_delivery_options"."version",
		"active_delivery_options"."name",
		"active_delivery_options"."description",
		"active_delivery_options"."details_label",
		"active_delivery_options"."cost",
		"active_delivery_options"."room_id"
	from
		"active_delivery_options"
		inner join "active_published_rooms" on (
			(
				"active_delivery_options"."room_id" = "active_published_rooms"."id"
			)
			and (
				"active_delivery_options"."tenant_id" = "active_published_rooms"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_invoices" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"line_items",
		"status",
		"charged_at",
		"order_id"
	from
		"invoices"
	where
		("invoices"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_order_invoices" AS (
	select
		"active_invoices"."id",
		"active_invoices"."tenant_id",
		"active_invoices"."created_at",
		"active_invoices"."updated_at",
		"active_invoices"."deleted_at",
		"active_invoices"."version",
		"active_invoices"."line_items",
		"active_invoices"."status",
		"active_invoices"."charged_at",
		"active_invoices"."order_id",
		"active_orders"."customer_id"
	from
		"active_invoices"
		inner join "active_orders" on (
			(
				"active_invoices"."order_id" = "active_orders"."id"
			)
			and (
				"active_invoices"."tenant_id" = "active_orders"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_order_invoices" AS (
	select
		"active_invoices"."id",
		"active_invoices"."tenant_id",
		"active_invoices"."created_at",
		"active_invoices"."updated_at",
		"active_invoices"."deleted_at",
		"active_invoices"."version",
		"active_invoices"."line_items",
		"active_invoices"."status",
		"active_invoices"."charged_at",
		"active_invoices"."order_id",
		"active_shared_account_manager_access"."manager_id"
	from
		"active_invoices"
		inner join "active_orders" on (
			(
				"active_invoices"."order_id" = "active_orders"."id"
			)
			and (
				"active_invoices"."tenant_id" = "active_orders"."tenant_id"
			)
		)
		inner join "active_shared_account_manager_access" on (
			(
				"active_orders"."shared_account_id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_orders"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_order_object_metadata" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"order_id",
		"filename",
		"mime_type",
		"byte_size",
		"status"
	from
		"order_object_metadata"
	where
		("order_object_metadata"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_order_object_metadata" AS (
	select
		"active_order_object_metadata"."id",
		"active_order_object_metadata"."tenant_id",
		"active_order_object_metadata"."created_at",
		"active_order_object_metadata"."updated_at",
		"active_order_object_metadata"."deleted_at",
		"active_order_object_metadata"."version",
		"active_order_object_metadata"."order_id",
		"active_order_object_metadata"."filename",
		"active_order_object_metadata"."mime_type",
		"active_order_object_metadata"."byte_size",
		"active_order_object_metadata"."status",
		"active_orders"."customer_id"
	from
		"active_order_object_metadata"
		inner join "active_orders" on (
			(
				"active_order_object_metadata"."order_id" = "active_orders"."id"
			)
			and (
				"active_order_object_metadata"."tenant_id" = "active_orders"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_order_object_metadata" AS (
	select
		"active_order_object_metadata"."id",
		"active_order_object_metadata"."tenant_id",
		"active_order_object_metadata"."created_at",
		"active_order_object_metadata"."updated_at",
		"active_order_object_metadata"."deleted_at",
		"active_order_object_metadata"."version",
		"active_order_object_metadata"."order_id",
		"active_order_object_metadata"."filename",
		"active_order_object_metadata"."mime_type",
		"active_order_object_metadata"."byte_size",
		"active_order_object_metadata"."status",
		"active_shared_account_manager_access"."manager_id"
	from
		"active_order_object_metadata"
		inner join "active_orders" on (
			(
				"active_order_object_metadata"."order_id" = "active_orders"."id"
			)
			and (
				"active_order_object_metadata"."tenant_id" = "active_orders"."tenant_id"
			)
		)
		inner join "active_shared_account_manager_access" on (
			(
				"active_orders"."shared_account_id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_orders"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_products" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"status",
		"room_id",
		"config"
	from
		"products"
	where
		("products"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_published_products" AS (
	select
		"active_products"."id",
		"active_products"."tenant_id",
		"active_products"."created_at",
		"active_products"."updated_at",
		"active_products"."deleted_at",
		"active_products"."version",
		"active_products"."name",
		"active_products"."status",
		"active_products"."room_id",
		"active_products"."config"
	from
		"active_products"
		inner join "active_published_rooms" on (
			(
				"active_products"."room_id" = "active_published_rooms"."id"
			)
			and (
				"active_products"."tenant_id" = "active_published_rooms"."tenant_id"
			)
		)
	where
		"active_products"."status" = 'published'
);

--> statement-breakpoint
CREATE VIEW "active_users" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"username",
		"external_id",
		"display_name",
		"email",
		"identity_provider_id",
		"status",
		"role"
	from
		"users"
	where
		("users"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_room_workflows" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"room_id"
	from
		"room_workflows"
	where
		("room_workflows"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_published_room_room_workflows" AS (
	select
		"active_room_workflows"."id",
		"active_room_workflows"."tenant_id",
		"active_room_workflows"."created_at",
		"active_room_workflows"."updated_at",
		"active_room_workflows"."deleted_at",
		"active_room_workflows"."version",
		"active_room_workflows"."room_id"
	from
		"active_room_workflows"
		inner join "active_published_rooms" on (
			(
				"active_room_workflows"."room_id" = "active_published_rooms"."id"
			)
			and (
				"active_room_workflows"."tenant_id" = "active_published_rooms"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_shared_account_workflows" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"shared_account_id"
	from
		"shared_account_workflows"
	where
		("shared_account_workflows"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_authorized_shared_account_workflows" AS (
	select
		"active_shared_account_workflows"."id",
		"active_shared_account_workflows"."tenant_id",
		"active_shared_account_workflows"."created_at",
		"active_shared_account_workflows"."updated_at",
		"active_shared_account_workflows"."deleted_at",
		"active_shared_account_workflows"."version",
		"active_shared_account_workflows"."shared_account_id",
		"active_shared_account_customer_access"."customer_id"
	from
		"active_shared_account_workflows"
		inner join "active_shared_account_customer_access" on (
			(
				"active_shared_account_workflows"."shared_account_id" = "active_shared_account_customer_access"."shared_account_id"
			)
			and (
				"active_shared_account_workflows"."tenant_id" = "active_shared_account_customer_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_workflows" AS (
	select
		"active_shared_account_workflows"."id",
		"active_shared_account_workflows"."tenant_id",
		"active_shared_account_workflows"."created_at",
		"active_shared_account_workflows"."updated_at",
		"active_shared_account_workflows"."deleted_at",
		"active_shared_account_workflows"."version",
		"active_shared_account_workflows"."shared_account_id",
		"active_shared_account_manager_access"."manager_id"
	from
		"active_shared_account_workflows"
		inner join "active_shared_account_manager_access" on (
			(
				"active_shared_account_workflows"."shared_account_id" = "active_shared_account_manager_access"."shared_account_id"
			)
			and (
				"active_shared_account_workflows"."tenant_id" = "active_shared_account_manager_access"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_workflow_statuses" AS (
	select
		"id",
		"tenant_id",
		"created_at",
		"updated_at",
		"deleted_at",
		"version",
		"name",
		"type",
		"charging",
		"color",
		"index",
		"shared_account_workflow_id",
		"room_workflow_id"
	from
		"workflow_statuses"
	where
		("workflow_statuses"."deleted_at" is null)
);

--> statement-breakpoint
CREATE VIEW "active_customer_authorized_shared_account_workflow_statuses" AS (
	select
		"active_workflow_statuses"."id",
		"active_workflow_statuses"."tenant_id",
		"active_workflow_statuses"."created_at",
		"active_workflow_statuses"."updated_at",
		"active_workflow_statuses"."deleted_at",
		"active_workflow_statuses"."version",
		"active_workflow_statuses"."name",
		"active_workflow_statuses"."type",
		"active_workflow_statuses"."charging",
		"active_workflow_statuses"."color",
		"active_workflow_statuses"."index",
		"active_workflow_statuses"."shared_account_workflow_id",
		"active_workflow_statuses"."room_workflow_id",
		"active_customer_authorized_shared_account_workflows"."customer_id"
	from
		"active_workflow_statuses"
		inner join "active_customer_authorized_shared_account_workflows" on (
			(
				"active_workflow_statuses"."shared_account_workflow_id" = "active_customer_authorized_shared_account_workflows"."id"
			)
			and (
				"active_workflow_statuses"."tenant_id" = "active_customer_authorized_shared_account_workflows"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_manager_authorized_shared_account_workflow_statuses" AS (
	select
		"active_workflow_statuses"."id",
		"active_workflow_statuses"."tenant_id",
		"active_workflow_statuses"."created_at",
		"active_workflow_statuses"."updated_at",
		"active_workflow_statuses"."deleted_at",
		"active_workflow_statuses"."version",
		"active_workflow_statuses"."name",
		"active_workflow_statuses"."type",
		"active_workflow_statuses"."charging",
		"active_workflow_statuses"."color",
		"active_workflow_statuses"."index",
		"active_workflow_statuses"."shared_account_workflow_id",
		"active_workflow_statuses"."room_workflow_id",
		"active_manager_authorized_shared_account_workflows"."manager_id"
	from
		"active_workflow_statuses"
		inner join "active_manager_authorized_shared_account_workflows" on (
			(
				"active_workflow_statuses"."shared_account_workflow_id" = "active_manager_authorized_shared_account_workflows"."id"
			)
			and (
				"active_workflow_statuses"."tenant_id" = "active_manager_authorized_shared_account_workflows"."tenant_id"
			)
		)
);

--> statement-breakpoint
CREATE VIEW "active_published_room_workflow_statuses" AS (
	select
		"active_workflow_statuses"."id",
		"active_workflow_statuses"."tenant_id",
		"active_workflow_statuses"."created_at",
		"active_workflow_statuses"."updated_at",
		"active_workflow_statuses"."deleted_at",
		"active_workflow_statuses"."version",
		"active_workflow_statuses"."name",
		"active_workflow_statuses"."type",
		"active_workflow_statuses"."charging",
		"active_workflow_statuses"."color",
		"active_workflow_statuses"."index",
		"active_workflow_statuses"."shared_account_workflow_id",
		"active_workflow_statuses"."room_workflow_id"
	from
		"active_workflow_statuses"
		inner join "active_published_room_room_workflows" on (
			(
				"active_workflow_statuses"."room_workflow_id" = "active_published_room_room_workflows"."id"
			)
			and (
				"active_workflow_statuses"."tenant_id" = "active_published_room_room_workflows"."tenant_id"
			)
		)
);