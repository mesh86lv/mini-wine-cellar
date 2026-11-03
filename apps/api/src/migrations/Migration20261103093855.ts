import { Migration } from "@mikro-orm/migrations";

export class Migration20261103093855 extends Migration {
  override name = "Migration20261103093855";

  override up(): void | Promise<void> {
    this.addSql(
      `create table "user" ("id" uuid not null, "name" varchar(80) not null, "created_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(`alter table "user" add constraint "user_name_unique" unique ("name");`);

    this.addSql(
      `create table "bottle" ("id" uuid not null, "owner_id" uuid not null, "name" varchar(120) not null, "producer" varchar(120) not null, "vintage" int not null, "region" varchar(120) not null, "photo_url" varchar(2048) null, "likes_count" int not null default 0, "created_at" timestamptz not null default now(), primary key ("id"));`,
    );
    this.addSql(
      `create index "bottle_owner_created_at_index" on "bottle" ("owner_id", "created_at" DESC);`,
    );
    this.addSql(
      `alter table "bottle" add constraint "bottle_likes_count_check" check (likes_count >= 0);`,
    );

    this.addSql(
      `alter table "bottle" add constraint "bottle_owner_id_foreign" foreign key ("owner_id") references "user" ("id") on delete cascade;`,
    );
  }

  /**
   * `bottle` first: its foreign key references `user`, so the order is the only reversible one.
   * `cascade` drops the constraints and the index the table owns.
   */
  override down(): void {
    this.addSql(`drop table if exists "bottle" cascade;`);
    this.addSql(`drop table if exists "user" cascade;`);
  }
}
