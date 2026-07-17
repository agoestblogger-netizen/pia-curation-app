CREATE TABLE "regional_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_center" text NOT NULL,
	"curator_id" integer NOT NULL,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_leads_region_center_unique" UNIQUE("region_center")
);
--> statement-breakpoint
ALTER TABLE "regional_leads" ADD CONSTRAINT "regional_leads_curator_id_users_id_fk" FOREIGN KEY ("curator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regional_leads" ADD CONSTRAINT "regional_leads_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;