import { Client } from "@notionhq/client";
import { notionConfig } from "./notionConfig";

let client: Client | undefined;

export function getNotionClient(): Client {
  if (!client) {
    client = new Client({ auth: notionConfig.token() });
  }
  return client;
}
