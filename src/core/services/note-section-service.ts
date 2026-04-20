import type { NoteManifestEntry, NoteSectionEntryInput, PageInput } from '../types.ts';
import { slugifyPath } from '../sync.ts';
import { importContentHash } from '../utils.ts';
import { DEFAULT_NOTE_MANIFEST_SCOPE_ID } from './note-manifest-service.ts';

export const NOTE_SECTION_EXTRACTOR_VERSION = 'phase2-sections-v1';

export interface BuildNoteSectionEntriesInput {
  scope_id?: string;
  page_id: number;
  page_slug: string;
  page_path: string;
  page: Pick<PageInput, 'compiled_truth' | 'timeline' | 'frontmatter' | 'title' | 'type'> & {
    content_hash?: string;
  };
  manifest: NoteManifestEntry;
}

export function buildNoteSectionEntries(input: BuildNoteSectionEntriesInput): NoteSectionEntryInput[] {
  const scopeId = input.scope_id ?? DEFAULT_NOTE_MANIFEST_SCOPE_ID;
  const body = joinCanonicalBody(input.page.compiled_truth, input.page.timeline ?? '');
  const lines = body.split('\n');
  const stack: Array<{ depth: number; slug: string; section_id: string }> = [];

  return input.manifest.heading_index.map((heading, index) => {
    while (stack.length > 0 && stack[stack.length - 1]!.depth >= heading.depth) {
      stack.pop();
    }

    const headingPath = [...stack.map((entry) => entry.slug), heading.slug];
    const sectionId = `${input.page_slug}#${headingPath.join('/')}`;
    const parentSectionId = stack.length > 0 ? stack[stack.length - 1]!.section_id : null;
    const nextLine = input.manifest.heading_index[index + 1]?.line_start ?? (lines.length + 1);
    const lineEnd = nextLine - 1;
    const sectionText = lines.slice(heading.line_start - 1, lineEnd).join('\n').trim();

    stack.push({ depth: heading.depth, slug: heading.slug, section_id: sectionId });

    return {
      scope_id: scopeId,
      page_id: input.page_id,
      page_slug: input.page_slug,
      page_path: input.page_path,
      section_id: sectionId,
      parent_section_id: parentSectionId,
      heading_slug: heading.slug,
      heading_path: headingPath,
      heading_text: heading.text,
      depth: heading.depth,
      line_start: heading.line_start,
      line_end: lineEnd,
      section_text: sectionText,
      outgoing_wikilinks: extractOutgoingWikilinks(sectionText),
      outgoing_urls: extractOutgoingUrls(sectionText),
      source_refs: extractSourceRefs(sectionText),
      content_hash: importContentHash({
        title: input.page.title,
        type: input.page.type,
        compiled_truth: sectionText,
        timeline: '',
        frontmatter: { heading_path: headingPath },
        tags: [],
      }),
      extractor_version: NOTE_SECTION_EXTRACTOR_VERSION,
    };
  });
}

function joinCanonicalBody(compiledTruth: string, timeline: string): string {
  if (!timeline.trim()) return compiledTruth;
  return `${compiledTruth}\n\n---\n\n${timeline}`;
}

function extractOutgoingWikilinks(body: string): string[] {
  const targets: string[] = [];
  const pattern = /\[\[([^\]]+)\]\]/g;

  for (const match of body.matchAll(pattern)) {
    const raw = match[1]?.trim() ?? '';
    if (!raw) continue;
    const target = raw.split('|')[0]?.split('#')[0]?.trim() ?? '';
    if (!target) continue;
    targets.push(slugifyPath(target));
  }

  return uniqueStrings(targets);
}

function extractOutgoingUrls(body: string): string[] {
  const urls: string[] = [];
  const pattern = /https?:\/\/[^\s<>"')\]]+/g;

  for (const match of body.matchAll(pattern)) {
    const candidate = match[0]?.trim() ?? '';
    if (!candidate) continue;
    urls.push(candidate.replace(/[.,;:!?]+$/g, ''));
  }

  return uniqueStrings(urls);
}

function extractSourceRefs(body: string): string[] {
  const refs: string[] = [];
  const pattern = /\[Source:\s*([^\]\n]+)\]/g;

  for (const match of body.matchAll(pattern)) {
    const source = match[1]?.trim() ?? '';
    if (!source) continue;
    refs.push(source);
  }

  return uniqueStrings(refs);
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}
