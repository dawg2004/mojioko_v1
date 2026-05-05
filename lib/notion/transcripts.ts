import { Client } from "@notionhq/client";
import type { Transcript, TranscriptStatus } from "@/lib/types";

const PROPERTY_NAMES = {
  title: "Name",
  status: "Status",
  originalFileName: "Original File Name",
  driveFileId: "Drive File ID",
  driveFileUrl: "Drive File URL",
  fileSizeBytes: "File Size Bytes",
  transcriptText: "Transcript Text",
  summary: "Summary",
  minutes: "Minutes",
  todos: "TODO",
} as const;

type CreateTranscriptInput = {
  title: string;
  originalFileName: string;
  driveFileId: string;
  driveFileUrl: string;
  fileSizeBytes: number;
  status?: TranscriptStatus;
};

type UpdateTranscriptInput = Partial<{
  status: TranscriptStatus;
  transcriptText: string;
  summary: string;
  minutes: string;
  todos: string;
}>;

type NotionPage = {
  id: string;
  created_time?: string;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

type NotionDatabase = {
  data_sources?: Array<{ id: string }>;
  properties?: Record<string, { type?: string }>;
};

type PageProperties = NonNullable<Parameters<Client["pages"]["update"]>[0]["properties"]>;
type DataSourceProperties = NonNullable<Parameters<Client["dataSources"]["update"]>[0]["properties"]>;

export async function listNotionTranscripts(): Promise<Transcript[]> {
  const notion = getNotionClient();
  const databaseId = getNotionDatabaseId();
  const dataSourceId = await getTranscriptDataSourceId(notion, databaseId);
  await ensureTranscriptDatabaseSchema(notion, dataSourceId);

  const response = await notion.dataSources.query({
    data_source_id: dataSourceId,
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    page_size: 50,
  });

  return response.results.map((page) => mapNotionPageToTranscript(page as NotionPage));
}

export async function getNotionTranscript(id: string): Promise<Transcript | null> {
  const notion = getNotionClient();

  try {
    const page = (await notion.pages.retrieve({ page_id: id })) as NotionPage;
    return mapNotionPageToTranscript(page);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Could not find")) {
      return null;
    }

    throw error;
  }
}

export async function createNotionTranscript(input: CreateTranscriptInput): Promise<Transcript> {
  const notion = getNotionClient();
  const databaseId = getNotionDatabaseId();
  const dataSourceId = await getTranscriptDataSourceId(notion, databaseId);
  const titleProperty = await ensureTranscriptDatabaseSchema(notion, dataSourceId);

  const response = await notion.pages.create({
    parent: { data_source_id: dataSourceId },
    properties: {
      [titleProperty]: titlePropertyValue(input.title),
      [PROPERTY_NAMES.status]: selectValue(input.status ?? "uploaded"),
      [PROPERTY_NAMES.originalFileName]: richTextValue(input.originalFileName),
      [PROPERTY_NAMES.driveFileId]: richTextValue(input.driveFileId),
      [PROPERTY_NAMES.driveFileUrl]: urlValue(input.driveFileUrl),
      [PROPERTY_NAMES.fileSizeBytes]: numberValue(input.fileSizeBytes),
    },
  });

  return mapNotionPageToTranscript(response as NotionPage);
}

export async function updateNotionTranscript(id: string, input: UpdateTranscriptInput): Promise<Transcript> {
  const notion = getNotionClient();
  const properties: PageProperties = {};

  if (input.status) properties[PROPERTY_NAMES.status] = selectValue(input.status);
  if (typeof input.transcriptText === "string") properties[PROPERTY_NAMES.transcriptText] = richTextValue(input.transcriptText);
  if (typeof input.summary === "string") properties[PROPERTY_NAMES.summary] = richTextValue(input.summary);
  if (typeof input.minutes === "string") properties[PROPERTY_NAMES.minutes] = richTextValue(input.minutes);
  if (typeof input.todos === "string") properties[PROPERTY_NAMES.todos] = richTextValue(input.todos);

  const response = await notion.pages.update({
    page_id: id,
    properties,
  });

  if (input.transcriptText || input.summary || input.minutes || input.todos) {
    await appendResultBlocks(notion, id, input);
  }

  return mapNotionPageToTranscript(response as NotionPage);
}

export function isNotionConfigured() {
  return Boolean(process.env.NOTION_TOKEN && process.env.NOTION_DATABASE_ID);
}

function getNotionClient() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    throw new Error("NOTION_TOKEN is not configured.");
  }

  return new Client({ auth: token });
}

function getNotionDatabaseId() {
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!databaseId) {
    throw new Error("NOTION_DATABASE_ID is not configured.");
  }

  return databaseId;
}

async function getTranscriptDataSourceId(notion: Client, databaseId: string) {
  const database = (await notion.databases.retrieve({ database_id: databaseId })) as NotionDatabase;
  const dataSourceId = database.data_sources?.[0]?.id;

  if (!dataSourceId) {
    throw new Error("Notion DatabaseのData Sourceを取得できませんでした。");
  }

  return dataSourceId;
}

async function ensureTranscriptDatabaseSchema(notion: Client, dataSourceId: string) {
  const database = (await notion.dataSources.retrieve({ data_source_id: dataSourceId })) as NotionDatabase;
  const titleProperty = findTitleProperty(database) ?? PROPERTY_NAMES.title;
  const existing = database.properties ?? {};
  const missing: DataSourceProperties = {};

  if (!existing[PROPERTY_NAMES.status]) {
    missing[PROPERTY_NAMES.status] = {
      select: {
        options: [
          { name: "uploaded", color: "blue" },
          { name: "queued", color: "gray" },
          { name: "transcribing", color: "yellow" },
          { name: "summarizing", color: "purple" },
          { name: "completed", color: "green" },
          { name: "failed", color: "red" },
        ],
      },
    };
  }

  for (const property of [
    PROPERTY_NAMES.originalFileName,
    PROPERTY_NAMES.driveFileId,
    PROPERTY_NAMES.transcriptText,
    PROPERTY_NAMES.summary,
    PROPERTY_NAMES.minutes,
    PROPERTY_NAMES.todos,
  ]) {
    if (!existing[property]) missing[property] = { rich_text: {} };
  }

  if (!existing[PROPERTY_NAMES.driveFileUrl]) missing[PROPERTY_NAMES.driveFileUrl] = { url: {} };
  if (!existing[PROPERTY_NAMES.fileSizeBytes]) missing[PROPERTY_NAMES.fileSizeBytes] = { number: { format: "number" } };

  if (Object.keys(missing).length > 0) {
    await notion.dataSources.update({
      data_source_id: dataSourceId,
      properties: missing,
    });
  }

  return titleProperty;
}

function findTitleProperty(database: NotionDatabase) {
  for (const [name, property] of Object.entries(database.properties ?? {})) {
    if (property.type === "title") return name;
  }

  return null;
}

function findTitlePropertyFromPage(properties: Record<string, unknown>) {
  for (const [name, property] of Object.entries(properties)) {
    if (isRecord(property) && property.type === "title") return name;
  }

  return null;
}

function mapNotionPageToTranscript(page: NotionPage): Transcript {
  const properties = page.properties ?? {};
  const titleProperty = findTitlePropertyFromPage(properties) ?? PROPERTY_NAMES.title;

  return {
    id: page.id,
    title: getTitle(properties[titleProperty]) ?? "無題の録音",
    original_file_name: getRichText(properties[PROPERTY_NAMES.originalFileName]),
    original_file_url: getUrl(properties[PROPERTY_NAMES.driveFileUrl]),
    storage_path: getRichText(properties[PROPERTY_NAMES.driveFileId]),
    file_size_bytes: getNumber(properties[PROPERTY_NAMES.fileSizeBytes]),
    transcript_text: getRichText(properties[PROPERTY_NAMES.transcriptText]),
    summary: getRichText(properties[PROPERTY_NAMES.summary]),
    minutes: getRichText(properties[PROPERTY_NAMES.minutes]),
    todos: getRichText(properties[PROPERTY_NAMES.todos]),
    status: getSelect(properties[PROPERTY_NAMES.status]) ?? "uploaded",
    created_at: page.created_time ?? null,
    updated_at: page.last_edited_time ?? null,
  };
}

async function appendResultBlocks(notion: Client, pageId: string, input: UpdateTranscriptInput) {
  const children = [
    ...headingAndParagraphs("全文", input.transcriptText),
    ...headingAndParagraphs("要約", input.summary),
    ...headingAndParagraphs("議事録", input.minutes),
    ...headingAndParagraphs("TODO", input.todos),
  ];

  if (children.length === 0) return;

  for (let index = 0; index < children.length; index += 100) {
    await notion.blocks.children.append({
      block_id: pageId,
      children: children.slice(index, index + 100),
    });
  }
}

function headingAndParagraphs(title: string, text?: string) {
  if (!text) return [];

  return [
    {
      object: "block" as const,
      type: "heading_2" as const,
      heading_2: { rich_text: [{ type: "text" as const, text: { content: title } }] },
    },
    ...chunkText(text, 1900).map((content) => ({
      object: "block" as const,
      type: "paragraph" as const,
      paragraph: { rich_text: [{ type: "text" as const, text: { content } }] },
    })),
  ];
}

function chunkText(text: string, size: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

function titlePropertyValue(content: string) {
  return { title: [{ text: { content: truncate(content, 2000) } }] };
}

function richTextValue(content: string) {
  return { rich_text: [{ text: { content: truncate(content, 2000) } }] };
}

function selectValue(name: string) {
  return { select: { name } };
}

function numberValue(value: number) {
  return { number: value };
}

function urlValue(value: string) {
  return { url: value };
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function getTitle(property: unknown) {
  if (!isRecord(property) || !Array.isArray(property.title)) return null;
  return property.title.map((item) => getPlainText(item)).join("").trim() || null;
}

function getRichText(property: unknown) {
  if (!isRecord(property) || !Array.isArray(property.rich_text)) return null;
  return property.rich_text.map((item) => getPlainText(item)).join("").trim() || null;
}

function getUrl(property: unknown) {
  if (!isRecord(property)) return null;
  return typeof property.url === "string" ? property.url : null;
}

function getNumber(property: unknown) {
  if (!isRecord(property)) return null;
  return typeof property.number === "number" ? property.number : null;
}

function getSelect(property: unknown) {
  if (!isRecord(property) || !isRecord(property.select)) return null;
  return typeof property.select.name === "string" ? property.select.name : null;
}

function getPlainText(item: unknown) {
  if (!isRecord(item)) return "";
  return typeof item.plain_text === "string" ? item.plain_text : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
