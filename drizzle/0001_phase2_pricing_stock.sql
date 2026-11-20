CREATE TABLE "avg_costs" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"avg_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"extra_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "debt_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"party_type" text NOT NULL,
	"customer_id" integer,
	"supplier_id" integer,
	"doc_id" integer,
	"branch_id" integer,
	"amount" numeric(18, 2) NOT NULL,
	"pay_date" date NOT NULL,
	"method" text DEFAULT 'cash' NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "debt_payments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "price_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"product_id" integer NOT NULL,
	"current_price_1" numeric(18, 2) DEFAULT 0 NOT NULL,
	"current_price_2" numeric(18, 2) DEFAULT 0 NOT NULL,
	"current_price_3" numeric(18, 2) DEFAULT 0 NOT NULL,
	"proposed_price_1" numeric(18, 2) NOT NULL,
	"proposed_price_2" numeric(18, 2),
	"proposed_price_3" numeric(18, 2),
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_price_1" numeric(18, 2),
	"approved_price_2" numeric(18, 2),
	"approved_price_3" numeric(18, 2),
	"cost_basis" numeric(18, 2),
	"other_cost" numeric(18, 2),
	"requested_by" integer,
	"reviewed_by" integer,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_proposals_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sale_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"price_1" numeric(18, 2) NOT NULL,
	"price_2" numeric(18, 2) NOT NULL,
	"price_3" numeric(18, 2) NOT NULL,
	"proposal_id" integer,
	"changed_by" integer,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_prices" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"price_1" numeric(18, 2) DEFAULT 0 NOT NULL,
	"price_2" numeric(18, 2) DEFAULT 0 NOT NULL,
	"price_3" numeric(18, 2) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "stock_doc_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"line_no" integer DEFAULT 0 NOT NULL,
	"product_id" integer NOT NULL,
	"line_dir" text,
	"qty" numeric(14, 3) NOT NULL,
	"unit_price" numeric(18, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"unit_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "stock_doc_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "stock_doc_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_docs" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"type_id" integer,
	"branch_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"to_warehouse_id" integer,
	"customer_id" integer,
	"supplier_id" integer,
	"employee_id" integer,
	"ref_doc_id" integer,
	"doc_date" date NOT NULL,
	"due_date" date,
	"price_level" integer DEFAULT 1 NOT NULL,
	"is_vat" boolean DEFAULT false NOT NULL,
	"is_tax" boolean DEFAULT false NOT NULL,
	"invoice_no" text,
	"vat_rate" numeric(5, 2) DEFAULT 0 NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT 0 NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"vat_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"other_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"total" numeric(18, 2) DEFAULT 0 NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT 0 NOT NULL,
	"payment_method" text,
	"cost_total" numeric(18, 2) DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'posted' NOT NULL,
	"reason" text,
	"note" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" integer,
	"cancel_reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "stock_docs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "stock_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_id" integer NOT NULL,
	"line_id" integer,
	"product_id" integer NOT NULL,
	"warehouse_id" integer NOT NULL,
	"branch_id" integer NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"unit_cost" numeric(18, 2) DEFAULT 0 NOT NULL,
	"move_date" date NOT NULL,
	"is_tax" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"supplier_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"price" numeric(18, 2) NOT NULL,
	"currency" text DEFAULT 'VND' NOT NULL,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "supplier_prices_code_unique" UNIQUE("code"),
	CONSTRAINT "supplier_prices_supplier_product" UNIQUE("supplier_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "avg_costs" ADD CONSTRAINT "avg_costs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_doc_id_stock_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."stock_docs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_proposals" ADD CONSTRAINT "price_proposals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_prices" ADD CONSTRAINT "sale_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_doc_lines" ADD CONSTRAINT "stock_doc_lines_doc_id_stock_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."stock_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_doc_lines" ADD CONSTRAINT "stock_doc_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_type_id_stock_doc_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."stock_doc_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_to_warehouse_id_warehouses_id_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_docs" ADD CONSTRAINT "stock_docs_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_doc_id_stock_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."stock_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_prices" ADD CONSTRAINT "supplier_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_docs_kind_date" ON "stock_docs" USING btree ("kind","doc_date");--> statement-breakpoint
CREATE INDEX "stock_moves_product_wh" ON "stock_moves" USING btree ("product_id","warehouse_id");