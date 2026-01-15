# Claude Skill: Research Codebase

## Purpose

Conduct comprehensive research across a codebase to answer user questions by spawning parallel sub-agents and synthesizing their findings into a well-structured research document.

---

## Context Management Architecture

**CRITICAL**: This skill is designed to prevent context bloat in the primary agent.

**Recommended: Use the Research Orchestrator Agent**

For commands that need research (like `write-product-spec`), use `.claude/agents/research-orchestrator.md`:

```
Primary Agent
    ↓ spawns with research question
Research Orchestrator Agent (uses this skill)
    ↓ spawns and coordinates
    Sub-agents (locators, analyzers, etc.)
    ↓ compiles all findings
Research Document (thoughts/shared/research/...)
    ↓ returns filename ONLY
Primary Agent reads document (clean context)
```

**Why this architecture:**
- Primary agent context stays clean
- Orchestrator contains all sub-agent context bloat
- Only the filename is returned to primary agent
- Primary agent reads the compiled research document

**The research document is the handoff mechanism:**
- It must be comprehensive — the primary agent only sees what's in this document
- It must be well-structured — the primary agent uses this to inform next steps
- It must include file paths and line numbers — for verification if needed

**CRITICAL: Return ONLY the filename:**
- After writing the research document, output the full path
- Example: `Research complete. Document saved to: thoughts/shared/research/2025-01-02-search-feature-research.md`
- This is the ONLY information returned to the calling agent

---

## How to Use

Invoke this skill by providing:
1. **Research question or area of interest** to investigate
2. **Specific files or directories** to focus on (optional)
3. **Ticket number** if relevant (e.g., ENG-1234)

**Example prompts:**
> "Research how authentication works in this codebase"
> "Investigate the parent-child tracking implementation for ENG-1478"
> "Analyze the data flow in the user registration feature"

---

## When This Skill Activates

Use this skill when:
- User asks to "research", "investigate", or "analyze" the codebase
- User needs to understand how a feature or system works
- User wants comprehensive documentation of code behavior
- User asks questions starting with "How does...", "Where is...", "What happens when..."
- User needs to trace data flow or architectural patterns

---

## Research Phase Instructions

### Step 1: Read Mentioned Files First

**CRITICAL**: Before spawning any sub-tasks:
1. If the user mentions specific files (tickets, docs, JSON), read them FULLY first
2. Use the Read tool WITHOUT limit/offset parameters to read entire files
3. Read these files in the main context before decomposing the research
4. This ensures you have full context before spawning sub-agents

### Step 2: Analyze and Decompose the Research Question

1. Break down the user's query into composable research areas
2. Take time to ultrathink about underlying patterns, connections, and architectural implications
3. Identify specific components, patterns, or concepts to investigate
4. Create a research plan using TodoWrite to track all subtasks
5. Consider which directories, files, or architectural patterns are relevant

### Step 3: Spawn Parallel Sub-Agent Tasks

Create multiple Task agents to research different aspects concurrently:

**Agent Types to Use:**
- **Locator agents**: Find what exists in the codebase
- **Analyzer agents**: Deep-dive into the most promising findings
- **Pattern finder agents**: Identify recurring patterns and conventions

**Best Practices:**
- Run multiple agents in parallel when searching for different things
- Each agent knows its job - just tell it what you're looking for
- Don't write detailed prompts about HOW to search - the agents already know
- Keep prompts focused on read-only operations

### Step 4: Wait and Synthesize

**IMPORTANT**: Wait for ALL sub-agent tasks to complete before proceeding

1. Compile all sub-agent results (both codebase and thoughts findings)
2. Prioritize live codebase findings as primary source of truth
3. Use thoughts/ findings as supplementary historical context
4. Connect findings across different components
5. Include specific file paths and line numbers for reference
6. Verify all thoughts/ paths are correct
7. Highlight patterns, connections, and architectural decisions
8. Answer the user's specific questions with concrete evidence

### Step 5: Gather Metadata

Generate all relevant metadata before writing:
- Current date and time with timezone
- Researcher name
- Git commit hash: `git rev-parse HEAD`
- Branch name: `git branch --show-current`
- Repository name

**Filename Convention:**
- Location: `thoughts/shared/research/YYYY-MM-DD-ENG-XXXX-description.md`
- With ticket: `2025-01-08-ENG-1478-parent-child-tracking.md`
- Without ticket: `2025-01-08-authentication-flow.md`

---

## Documentation Phase Instructions

### Step 6: Generate Research Document

Use this structure for all research documents:

```markdown
---
date: [Current date and time with timezone in ISO format]
researcher: [Researcher name]
git_commit: [Current commit hash]
branch: [Current branch name]
repository: [Repository name]
topic: "[User's Question/Topic]"
tags: [research, codebase, relevant-component-names]
status: complete
last_updated: [Current date in YYYY-MM-DD format]
last_updated_by: [Researcher name]
---

# Research: [User's Question/Topic]

**Date**: [Current date and time with timezone]
**Researcher**: [Researcher name]
**Git Commit**: [Current commit hash]
**Branch**: [Current branch name]
**Repository**: [Repository name]

## Research Question
[Original user query]

## Summary
[High-level findings answering the user's question]

## Detailed Findings

### [Component/Area 1]
- Finding with reference ([file.ext:line](link))
- Connection to other components
- Implementation details

### [Component/Area 2]
...

## Code References
- `path/to/file.py:123` - Description of what's there
- `another/file.ts:45-67` - Description of the code block

## Architecture Insights
[Patterns, conventions, and design decisions discovered]

## Historical Context (from thoughts/)
[Relevant insights from thoughts/ directory with references]
- `thoughts/shared/something.md` - Historical decision about X
- `thoughts/local/notes.md` - Past exploration of Y
Note: Paths exclude "searchable/" even if found there

## Related Research
[Links to other research documents in thoughts/shared/research/]

## Open Questions
[Any areas that need further investigation]
```

### Step 7: Add GitHub Permalinks (if applicable)

1. Check if on main branch or if commit is pushed: `git branch --show-current` and `git status`
2. If on main/master or pushed, generate GitHub permalinks:
   - Get repo info: `gh repo view --json owner,name`
   - Create permalinks: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`
3. Replace local file references with permalinks in the document

### Step 8: Present Findings

1. Present a concise summary of findings to the user
2. Include key file references for easy navigation
3. Ask if they have follow-up questions or need clarification

### Step 9: Handle Follow-up Questions

If the user has follow-up questions:
1. Append to the same research document
2. Update the frontmatter fields `last_updated` and `last_updated_by`
3. Add `last_updated_note: "Added follow-up research for [brief description]"`
4. Add a new section: `## Follow-up Research [timestamp]`
5. Spawn new sub-agents as needed for additional investigation
6. Continue updating the document and syncing

---

## Path Handling Rules

**CRITICAL**: The thoughts/searchable/ directory contains hard links for searching

Always document paths by removing ONLY "searchable/" - preserve all other subdirectories:
- `thoughts/searchable/allison/old_stuff/notes.md` → `thoughts/allison/old_stuff/notes.md`
- `thoughts/searchable/shared/prs/123.md` → `thoughts/shared/prs/123.md`
- `thoughts/searchable/global/shared/templates.md` → `thoughts/global/shared/templates.md`

**NEVER** change allison/ to shared/ or vice versa - preserve the exact directory structure.

---

## Research Checklist

Use this to ensure thorough coverage:

- [ ] Read all mentioned files FULLY before spawning sub-tasks
- [ ] Decomposed the question into research areas
- [ ] Created parallel sub-agent tasks
- [ ] Waited for ALL sub-agents to complete
- [ ] Gathered metadata (commit, branch, date)
- [ ] Found specific file paths and line numbers
- [ ] Connected findings across components
- [ ] Documented architecture patterns
- [ ] Included historical context from thoughts/
- [ ] Added GitHub permalinks (if applicable)
- [ ] Structured document with proper frontmatter

---

## Important Notes

### Context Management
- **Sub-agents explore, research document captures** — Primary agent reads the document, not sub-agent context
- **Research document must be comprehensive** — It's the only thing the primary agent sees from research
- **Keep the main agent focused on orchestration** — Sub-agents do the deep file reading

### Research Quality
- Always use parallel Task agents to maximize efficiency and minimize context usage
- Always run fresh codebase research - never rely solely on existing research documents
- The thoughts/ directory provides historical context to supplement live findings
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only operations
- Consider cross-component connections and architectural patterns
- Include temporal context (when the research was conducted)
- Link to GitHub when possible for permanent references
- Encourage sub-agents to find examples and usage patterns, not just definitions
- Explore all of thoughts/ directory, not just research subdirectory

---

## Tips for Success

1. **Start with locators** - Use locator agents to find what exists before deep analysis
2. **Run agents in parallel** - When searching for different things, run multiple agents simultaneously
3. **Follow the data** - Tracing data flow often reveals the full picture
4. **Read tests** - Test files often document expected behavior clearly
5. **Check comments** - Developers often explain "why" in comments
6. **Look for patterns** - Once you understand one flow, similar features likely follow the same pattern
7. **Validate assumptions** - If you infer behavior, search for confirmation in the code
8. **Include line numbers** - Always provide specific file paths and line numbers for reference

