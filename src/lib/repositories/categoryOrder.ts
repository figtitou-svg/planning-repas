import type { Client } from "@notionhq/client";
import { notionConfig } from "../notionConfig";

export async function getCategoryOrder(client: Client): Promise<string[]> {
  const db: any = await client.databases.retrieve({
    database_id: notionConfig.ingredientsDbId(),
  });
  const options = db.properties["Catégorie"]?.select?.options ?? [];
  return options.map((o: any) => o.name);
}
