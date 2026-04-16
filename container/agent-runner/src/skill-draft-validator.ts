export interface SkillDraftCandidate {
  name: string;
  description: string;
  content: string;
  sourceCount: number;
  successRate: number;
  intentKey: string;
  userSamples?: string[];
  assistantSamples?: string[];
}

export interface SkillDraftValidationResult {
  valid: boolean;
  errors: string[];
}

const REQUIRED_SECTIONS = [
  '## When to Use',
  '## When NOT to Use',
  '## Input Signals',
  '## Procedure',
  '## Verification',
  '## Anti-patterns',
];

function parseFrontmatter(content: string): Record<string, string> {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---\n')) return {};

  const endIdx = trimmed.indexOf('\n---\n', 4);
  if (endIdx === -1) return {};

  const body = trimmed.slice(4, endIdx);
  const result: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

export function sanitizeSkillName(raw: string): string {
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized.slice(0, 64) || 'auto-skill';
}

export function validateSkillDraft(
  draft: SkillDraftCandidate,
): SkillDraftValidationResult {
  const errors: string[] = [];

  if (!draft.name.trim()) {
    errors.push('name is required');
  }
  if (draft.name.length > 64) {
    errors.push('name exceeds 64 characters');
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(draft.name)) {
    errors.push('name must match [a-z0-9][a-z0-9_-]*');
  }

  if (!draft.description.trim()) {
    errors.push('description is required');
  }
  if (draft.description.length > 1024) {
    errors.push('description exceeds 1024 characters');
  }

  const frontmatter = parseFrontmatter(draft.content);
  if (!frontmatter.name) {
    errors.push('frontmatter.name is required');
  }
  if (!frontmatter.description) {
    errors.push('frontmatter.description is required');
  }
  if (frontmatter.name && frontmatter.name !== draft.name) {
    errors.push('frontmatter.name must equal draft.name');
  }
  if (frontmatter.description && frontmatter.description !== draft.description) {
    errors.push('frontmatter.description must equal draft.description');
  }

  const expectedHeader = `# /${draft.name} -`;
  if (!draft.content.includes(expectedHeader)) {
    errors.push('h1 must start with "# /<name> -" to match container skill style');
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!draft.content.includes(section)) {
      errors.push(`missing required section: ${section}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
