# Write Product Spec

You are tasked with generating a product specification document by researching the codebase and historical context, then synthesizing findings into a stakeholder-friendly spec.

**This command uses:**
- `.claude/agents/research-orchestrator.md` — Coordinates research and compiles findings
- `.claude/skills/write_product_spec_skill/SKILL.md` — For product spec structure and writing

## Initial Setup

When this command is invoked, respond with:
```
I'm ready to write a product spec. You can provide:

1. A file path to notes in the /tasks directory (e.g., tasks/my-feature.md)
2. Plain text describing the product/feature
3. Both a file path and additional context

Optional flags:
- research=true → Research existing surface areas, systems, and history
- update=spec/file.md → Update an existing spec
- verify=true → Verify existing findings are still accurate
- gaps=surface-areas,analytics → Investigate specific areas

What would you like me to spec out?
```

Then wait for the user's input.

---

## Workflow

### Phase 1: Input Processing

1. **Read any mentioned files FULLY first**
   - If the user provides a file path, read it completely (no limit/offset)
   - Read files in main context before spawning sub-tasks

2. **Extract core elements:**
   - What is the user problem being solved?
   - What is the proposed solution or feature?
   - Who are the affected user segments?
   - What is the scope (what's in, what's out)?

---

### Phase 2: Research (if `research=true` or research is needed)

**Spawn the research orchestrator agent:** `.claude/agents/research-orchestrator.md`

**Context Management — The Handoff Pattern:**

```
Primary Agent
    ↓ spawns with research question
Research Orchestrator Agent
    ↓ spawns and coordinates
    Sub-agents (locators, analyzers, etc.)
    ↓ compiles all findings
Research Document (thoughts/shared/research/...)
    ↓ returns filename ONLY
Primary Agent reads document (clean context)
```

**Why this architecture:**
- Primary agent context stays clean for spec writing
- Research orchestrator contains all sub-agent context bloat
- Only the filename is returned to primary agent
- Primary agent reads the compiled research document

**How to spawn the orchestrator:**

Provide:
1. **Research question** — What to investigate
2. **Specific files** — Any task files or notes to read first
3. **Ticket number** — For filename convention (if applicable)
4. **Scope hints** — Key areas to focus on

**Example prompt to orchestrator:**
```
Research the search feature implementation for product spec.

Research question: How does member search work across all surfaces?
Files to read first: tasks/search-improvements.md
Ticket: ENG-1234
Focus areas: Navigation search, dedicated pages, shared components, feature-specific implementations
```

**The orchestrator will:**
1. Spawn sub-agents (locators, analyzers, pattern-finders)
2. Compile all findings into a research document
3. Return ONLY the filename: `thoughts/shared/research/2025-01-02-ENG-1234-search-feature-research.md`

---

### Phase 3: Read Research Document & Synthesize

**Read the research document** returned by the orchestrator in Phase 2:
- Orchestrator returns the filename (e.g., `thoughts/shared/research/2025-01-02-search-feature-research.md`)
- Read this document FULLY — it contains all compiled findings
- Your context is clean — all research bloat was contained in the orchestrator

**CRITICAL: Synthesize ≠ Summarize**

- **Include ALL relevant findings** — organized for product audience
- **Clarity ≠ brevity** — stakeholders need detail
- **Template sections are structure, not length limits**

**Systematically transfer research to spec:**
- For each section in the research document, ask: "What belongs in the spec?"
- If research found 9 distinct surfaces, document all 9 — not "several surfaces"
- Include specific details (event names, field names, behaviors)

**Document objectively — do not editorialize:**
- Report what exists, not what should change
- Do not suggest improvements or critique implementations
- "Current State" describes reality, not problems to fix

---

### Phase 4: Write the Spec

**Follow the writing skill:** `.claude/skills/write_product_spec_skill/SKILL.md`

The skill contains:
- Complete product spec template
- Section-by-section guidance
- Writing guidelines
- Quality checklist

---

### Phase 5: Review and Output

1. **Identify gaps that need stakeholder input:**
   ```
   I've drafted the spec. A few areas may need input:
   - [Product question or gap]

   Would you like me to refine any section or dig deeper into anything?
   ```

2. **Save the spec:**
   - Check if `/spec` directory exists; create if needed
   - Save as: `spec/{feature-name}-spec.md`
   - Present the file path

---

## Flag Handlers

**For updates (`update=spec/file.md`):**
- Read existing spec fully
- Identify incomplete sections
- Spawn research orchestrator to fill gaps
- Merge new findings into spec

**For verification (`verify=true`):**
- Spawn research orchestrator to confirm findings are current
- Note any changes since the spec was written

**For specific gaps (`gaps=...`):**
Spawn research orchestrator with focused scope:
| Gap | Research Focus |
|-----|----------------|
| `surface-areas` | "Find ALL surfaces where users encounter [feature]" |
| `systems` | "Map systems and services involved in [feature]" |
| `history` | "Find historical context, tickets, and decisions for [feature]" |
| `analytics` | "Find analytics events and tracking for [feature]" |
| `patterns` | "Find similar implementations and patterns for [feature]" |

---

## Critical Rules

1. **Read mentioned files FULLY before spawning research orchestrator**
2. **Spawn research orchestrator** — It handles all sub-agent coordination
3. **Wait for orchestrator to return filename** — Only the filename, nothing else
4. **Read the research document** — Your context stays clean
5. **Never write specs with placeholder values when research was conducted**
6. **Document what exists — never suggest changes to existing code**
7. **Include ALL findings, organized for product audience — don't compress**
8. **Specs are living documents — spawn orchestrator again for follow-ups**
