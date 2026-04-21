import type { BrainEngine } from '../engine.ts';
import type {
  NoteManifestEntry,
  NoteSectionEntry,
  PrecisionLookupRoute,
  PrecisionLookupRouteInput,
  PrecisionLookupRouteRead,
  PrecisionLookupRouteResult,
} from '../types.ts';
import { DEFAULT_NOTE_MANIFEST_SCOPE_ID } from './note-manifest-service.ts';

export async function getPrecisionLookupRoute(
  engine: BrainEngine,
  input: PrecisionLookupRouteInput,
): Promise<PrecisionLookupRouteResult> {
  const scopeId = input.scope_id ?? DEFAULT_NOTE_MANIFEST_SCOPE_ID;

  if (input.section_id) {
    const [section] = await engine.listNoteSectionEntries({
      scope_id: scopeId,
      section_id: input.section_id,
      limit: 1,
    });
    if (!section) {
      return {
        selection_reason: 'no_match',
        candidate_count: 0,
        route: null,
      };
    }
    if (input.slug && input.slug !== section.page_slug) {
      return {
        selection_reason: 'no_match',
        candidate_count: 0,
        route: null,
      };
    }

    const [page] = await engine.listNoteManifestEntries({
      scope_id: scopeId,
      slug: section.page_slug,
      limit: 1,
    });
    if (!page) {
      return {
        selection_reason: 'no_match',
        candidate_count: 0,
        route: null,
      };
    }

    return {
      selection_reason: 'direct_section_match',
      candidate_count: 1,
      route: buildSectionRoute(scopeId, page, section),
    };
  }

  if (!input.slug) {
    return {
      selection_reason: 'no_match',
      candidate_count: 0,
      route: null,
    };
  }

  const [page] = await engine.listNoteManifestEntries({
    scope_id: scopeId,
    slug: input.slug,
    limit: 1,
  });
  if (!page) {
    return {
      selection_reason: 'no_match',
      candidate_count: 0,
      route: null,
    };
  }

  return {
    selection_reason: 'direct_page_match',
    candidate_count: 1,
    route: buildPageRoute(scopeId, page),
  };
}

function buildPageRoute(
  scopeId: string,
  page: NoteManifestEntry,
): PrecisionLookupRoute {
  return {
    route_kind: 'precision_lookup',
    target_kind: 'page',
    slug: page.slug,
    path: page.path,
    title: page.title,
    scope_id: scopeId,
    retrieval_route: [
      'direct_canonical_artifact',
      'minimal_supporting_reads',
    ],
    summary_lines: [
      `Precision lookup is anchored to exact canonical page ${page.slug}.`,
      'Supporting reads kept narrow: 1.',
      'Use the exact canonical artifact before relying on memory summaries.',
    ],
    recommended_reads: [
      {
        node_id: `page:${page.slug}`,
        node_kind: 'page',
        label: page.title,
        page_slug: page.slug,
        path: page.path,
      },
    ],
  };
}

function buildSectionRoute(
  scopeId: string,
  page: NoteManifestEntry,
  section: NoteSectionEntry,
): PrecisionLookupRoute {
  return {
    route_kind: 'precision_lookup',
    target_kind: 'section',
    slug: page.slug,
    path: section.page_path,
    title: section.heading_text,
    scope_id: scopeId,
    section_id: section.section_id,
    retrieval_route: [
      'direct_canonical_artifact',
      'minimal_supporting_reads',
    ],
    summary_lines: [
      `Precision lookup is anchored to exact canonical section ${section.heading_text}.`,
      'Supporting reads kept narrow: 2.',
      'Use the exact canonical artifact before relying on memory summaries.',
    ],
    recommended_reads: [
      {
        node_id: `section:${section.section_id}`,
        node_kind: 'section',
        label: section.heading_text,
        page_slug: section.page_slug,
        path: section.page_path,
        section_id: section.section_id,
      },
      {
        node_id: `page:${page.slug}`,
        node_kind: 'page',
        label: page.title,
        page_slug: page.slug,
        path: page.path,
      },
    ],
  };
}
