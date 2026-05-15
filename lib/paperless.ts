const BASE_URL = process.env.PAPERLESS_BASE_URL;
const API_TOKEN = process.env.PAPERLESS_API_TOKEN;

export interface PaperlessDocument {
  id: number;
  title: string;
  correspondent: number | null;
  document_type: number | null;
  tags: number[];
  created: string;
  added: string;
}

export interface PaperlessCorrespondent {
  id: number;
  name: string;
  match: string;
  matching_algorithm: number;
}

export interface PaperlessTag {
  id: number;
  name: string;
  color: number; // Paperless uses 'color' not 'colour' in its JSON
}

export interface PaperlessDocumentType {
  id: number;
  name: string;
}

interface PaperlessResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function paperlessFetch<T>(path: string): Promise<T> {
  if (!BASE_URL || !API_TOKEN) {
    throw new Error("Paperless-ngx credentials not configured");
  }

  // Clean up URL to avoid double slashes
  const baseUrlClean = BASE_URL.endsWith("/")
    ? BASE_URL.slice(0, -1)
    : BASE_URL;
  const pathClean = path.startsWith("/") ? path : `/${path}`;
  const url = path.startsWith("http") ? path : `${baseUrlClean}${pathClean}`;

  console.log(`[Paperless] Fetching: ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Token ${API_TOKEN}`,
        Accept: "application/json",
        "User-Agent": "OC-Maintenance-Tracker/1.0",
      },
      // Force IPv4 if Node is having trouble on Mac
      // @ts-ignore - next/node specific or experimental
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(
        `[Paperless] Error ${response.status}: ${response.statusText}`,
      );
      throw new Error(`Paperless-ngx API error: ${response.statusText}`);
    }

    return response.json();
  } catch (error: any) {
    console.error(`[Paperless] Connection failed to ${url}:`, error.message);
    throw error;
  }
}

export async function listAllDocuments(): Promise<PaperlessDocument[]> {
  let allDocs: PaperlessDocument[] = [];
  let nextUrl: string | null = "/api/documents/?page_size=100";

  while (nextUrl) {
    const data: PaperlessResponse<PaperlessDocument> =
      await paperlessFetch(nextUrl);
    allDocs = [...allDocs, ...data.results];
    nextUrl = data.next;
  }

  return allDocs;
}

export async function listCorrespondents(): Promise<PaperlessCorrespondent[]> {
  const data: PaperlessResponse<PaperlessCorrespondent> = await paperlessFetch(
    "/api/correspondents/?page_size=1000",
  );
  return data.results;
}

export async function listTags(): Promise<PaperlessTag[]> {
  const data: PaperlessResponse<PaperlessTag> = await paperlessFetch(
    "/api/tags/?page_size=1000",
  );
  return data.results;
}

export async function listDocumentTypes(): Promise<PaperlessDocumentType[]> {
  const data: PaperlessResponse<PaperlessDocumentType> = await paperlessFetch(
    "/api/document_types/?page_size=1000",
  );
  return data.results;
}

export async function listDocumentsForCorrespondent(
  correspondentId: number,
): Promise<PaperlessDocument[]> {
  let allDocs: PaperlessDocument[] = [];
  let nextUrl: string | null =
    `/api/documents/?correspondent__id=${correspondentId}&page_size=100`;

  while (nextUrl) {
    const data: PaperlessResponse<PaperlessDocument> =
      await paperlessFetch(nextUrl);
    allDocs = [...allDocs, ...data.results];
    nextUrl = data.next;
  }

  return allDocs;
}

export function getDocumentUrl(id: number): string {
  return `${BASE_URL}/documents/${id}/details`;
}
