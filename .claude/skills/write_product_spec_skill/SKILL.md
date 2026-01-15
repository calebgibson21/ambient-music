# Claude Skill: Write Product Spec

## Purpose

Generate a comprehensive product specification document from user input, notes, or feature descriptions. The spec should be stakeholder-friendly, clearly structured, and ready for product review.

---

## How to Use

Invoke this skill by providing:
1. **Feature description** or notes about what to spec
2. **File path** to existing notes (e.g., `/tasks/my-feature.md`)
3. **Context** about the problem being solved

**Example prompts:**
> "Write a product spec for the new user onboarding flow"
> "Create a spec from these notes: [description]"
> "Draft a product spec for tasks/search-improvements.md"

---

## When This Skill Activates

Use this skill when:
- User asks to "write a spec", "create a product spec", or "draft a specification"
- User wants to document a feature for stakeholder review
- User needs a structured product document from notes or descriptions

---

## Key Principles

### Document What Exists, Do Not Suggest Changes

- **DO NOT** suggest improvements or changes to the codebase
- **DO NOT** recommend refactoring or better approaches
- **DO NOT** critique existing implementations
- **DO NOT** identify "problems" or "issues" that need fixing
- **ONLY** document what exists today and how it works
- The spec describes the CURRENT STATE and the PROPOSED FEATURE — not how to improve existing code

### Synthesis ≠ Summarization

- **Include ALL relevant findings** — organized and framed for a product audience
- **Clarity ≠ brevity** — clarity means organized and understandable, not shorter
- **Stakeholder-friendly ≠ short** — stakeholders need detail to make informed decisions
- **Template sections are structure, not length limits**

---

## Writing Guidelines

### Before Writing

Extract and confirm the core elements:
- What is the user problem being solved?
- What is the proposed solution or feature?
- Who are the affected user segments?
- What is the scope (what's in, what's out)?

### While Writing

1. **Frame for product audience** — Translate technical details into product-relevant language
2. **Organize by user concern** — Structure by user-facing concerns, not codebase structure
3. **Include specific details** — Event names, field names, behaviors — just framed for PMs
4. **Document objectively** — Report what exists, not what should change

---

## Product Spec Template

```markdown
---
title: [Feature Name]
created: [YYYY-MM-DD]
status: draft
---

# [Title]

[1-2 sentence summary in plain language. If you can't explain it simply, refine until you can.]

## Problem Statement

**The Problem**
[What specific pain point or gap exists? Ground this in observable user behavior or business impact.]

**Who's Affected**
[Which users experience this? Consider the spectrum from casual to power users.]

**Why Now**
[What's changed that makes this important to solve now?]

## Solution

[Clear description of what we're building and how it addresses the problem. Write in short sentences for quick stakeholder review.]

**What's in scope:**
- [Specific capability 1]
- [Specific capability 2]

**What's NOT in scope:**
- [Explicit exclusion 1]

**Alternatives considered:**
- [Alternative] — [Why not chosen]

## Success Metrics

**Primary metric:** [The single metric that defines success]

**Guardrails:** [Metrics that must not get worse]
- [Guardrail 1]

**Target:** [Directional goal, e.g., "Increase X by 10%" or "Reduce Y by half"]

## User Experience

### Entry Points
[How do users discover and access this feature?]
- [Entry point 1]
- [Entry point 2]

### Core Flow
[Step-by-step user journey]
1. User [action]
2. System [response]
3. User [action]
4. [Outcome]

### Key States
- **Empty state**: [What users see before any data/content]
- **Loading**: [Feedback during waits]
- **Error**: [How failures are communicated]
- **Success**: [Confirmation of completion]

### Edge Cases
- [Edge case]: [How it's handled]

## Product Rules

**Access & Permissions**
- [Who can use this feature?]
- [Any restrictions based on user type, subscription, etc.?]

**User Segments**
| Segment | Behavior |
|---------|----------|
| New users | [Differences] |
| Power users | [Differences] |

**Platform Considerations**
- Web: [Any specifics]
- Mobile: [Any specifics]

**Current Workarounds**
[Are users doing anything hacky to solve this themselves?]

## Current State

### What Exists Today
[Description of current user experience in this area, even if partial or indirect]

### Related Features
- [Feature name]: [How it relates]

### Key Systems
- [System/service name]: [What it handles]

### Historical Context
[Key decisions from past research and discussions]
- [Decision]: [Rationale]

### Current Analytics
- [Metric/event]: [What it measures]
- **Gaps**: [What's not measured that should be]

## Open Questions

- [ ] [Product decision needed]
- [ ] [Stakeholder input required]
- [ ] [Uncertainty to resolve]
```

---

## Section-by-Section Guidance

### Problem Statement
- Ground in observable user behavior or business impact
- Be specific about WHO is affected
- Explain urgency with "Why Now"

### Solution
- Write in short sentences for quick stakeholder review
- Be explicit about scope boundaries
- Document alternatives considered to show due diligence

### Success Metrics
- One primary metric that defines success
- Include guardrails (what must NOT get worse)
- Set directional targets

### User Experience
- List ALL entry points, not just the primary one
- Document the complete user journey step-by-step
- Cover all key states: empty, loading, error, success
- Anticipate edge cases

### Product Rules
- Define access and permissions clearly
- Document differences by user segment
- Note platform-specific considerations

### Current State
- Describe reality, not problems to fix
- List related features and how they connect
- Include historical context for decisions

### Open Questions
- Use checkboxes for tracking
- Be specific about what input is needed
- Identify blockers and uncertainties

---

## Output Instructions

1. **Check for `/spec` directory** — Create if it doesn't exist
2. **Save as:** `spec/{feature-name}-spec.md`
3. **Present the file path** to the user
4. **Identify gaps** that may need stakeholder input:
   ```
   I've drafted the spec. A few areas may need input:
   - [Product question or gap]
   
   Would you like me to refine any section or dig deeper into anything?
   ```

---

## Quality Checklist

Before finalizing, verify:
- [ ] User needs are clearly defined
- [ ] Success criteria is measurable
- [ ] Edge cases are addressed
- [ ] Scope is explicit (in AND out)
- [ ] All sections are filled (or marked as needing input)
- [ ] Language is stakeholder-friendly
- [ ] No suggestions for code improvements
- [ ] Template sections have appropriate detail (not just bullet points)

---

## Tips for Success

1. **Start with the problem** — If you can't articulate the problem clearly, the solution won't be clear either
2. **Be explicit about scope** — "What's NOT in scope" prevents scope creep
3. **Think in user journeys** — Document the complete flow, not just the happy path
4. **Include the "why"** — Historical context helps stakeholders understand constraints
5. **Use concrete examples** — Specific event names, field names, and behaviors are more useful than abstractions
6. **Mark unknowns explicitly** — Use "TBD" or add to Open Questions rather than guessing

