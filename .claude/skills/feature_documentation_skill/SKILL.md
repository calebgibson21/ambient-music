# Claude Skill: Codebase Research & Product Documentation

## Purpose

Research a codebase systematically and produce comprehensive product documentation for a feature using a structured template. This skill transforms code into user-focused documentation that captures what a feature does, how it works, and its technical underpinnings.

---

## How to Use

Invoke this skill by providing:
1. **Feature name or area** to document
2. **Codebase location** (directory path or repo reference)
3. Optionally: specific files or entry points you know are relevant

**Example prompt:**
> "Document the [Feature Name] feature in [codebase path]. Start by researching how it works, then create product documentation using the feature documentation template."

---

## Research Phase Instructions

### Step 1: Initial Discovery

Begin by understanding the codebase structure:

1. **Explore the directory structure** - List top-level directories to understand project organization
2. **Find entry points** - Look for:
   - Route definitions (API routes, page routes)
   - Main/index files
   - Configuration files that reference the feature
3. **Identify naming patterns** - Search for files/folders matching the feature name

**Search strategies:**
- Use semantic search: "How does [feature] work?"
- Use glob patterns: `**/[feature]*.{ts,js,py}`, `**/*[feature]*/**`
- Use grep for feature-specific terms, function names, or identifiers

### Step 2: Trace the User Flow

Map how users interact with the feature:

1. **Find the UI entry point** - Search for components, pages, or views
2. **Trace user actions** - Follow event handlers, form submissions, button clicks
3. **Identify API calls** - Find fetch requests, API client usage
4. **Track data flow** - Follow from UI → API → database/services

**Key questions to answer:**
- Where do users first encounter this feature?
- What inputs do users provide?
- What outputs/feedback do users receive?
- What are the intermediate steps?

### Step 3: Understand System Behavior

Dig into the business logic:

1. **Find core logic files** - Services, controllers, utilities, hooks
2. **Identify business rules** - Look for:
   - Validation logic
   - Conditional branches (if/else, switch statements)
   - Thresholds or constants
   - Permission/access checks
3. **Map edge cases** - Search for error handling, fallback behaviors
4. **Document dependencies** - What does this feature call? What calls it?

### Step 4: Technical Architecture

Extract technical details:

1. **List components** - UI components, services, models, utilities
2. **Map data flow** - Input sources → processing → output destinations
3. **Find API endpoints** - Route definitions, HTTP methods, request/response shapes
4. **Identify data models** - Database schemas, types, interfaces

### Step 5: Configuration & Settings

Find configurable aspects:

1. **User settings** - Preferences, toggles, options exposed to users
2. **Feature flags** - Look for flag checks, A/B test conditions
3. **Environment config** - Environment variables, config files
4. **Admin settings** - Backend configuration, admin panels

---

## Documentation Phase Instructions

After completing research, synthesize findings into the template below. Follow these principles:

### Writing Guidelines

1. **User-first language** - Describe capabilities in terms of user benefits
2. **Concrete over abstract** - Use specific examples rather than vague descriptions
3. **Honest about limitations** - Document what the feature doesn't do
4. **Technical precision** - Be accurate about how the system actually works
5. **Fill what you know** - Mark sections as "TBD" or "Needs clarification" if information isn't available in the codebase

### Section-by-Section Guidance

**Feature Overview**
- Pull from README files, code comments, or infer from functionality

**What It Does**
- Synthesize from user-facing components and the core value proposition
- Core Capabilities: Identify 3-5 primary things users can accomplish
- User Problems Solved: Infer from the feature's purpose and design

**How It Works**
- User Flow: Trace from your Step 2 research, number each step
- System Behavior: Extract from Step 3, document actual code logic
- Dependencies: Map from import statements and service calls

**Technical Architecture**
- Components: Create table from Step 4 findings
- Data Flow: Describe the path data takes through the system
- API Endpoints: List from route definitions with methods and purposes

**Configuration & Settings**
- Document from Step 5 research
- Include defaults discovered in code

**Scope & Boundaries**
- "Does": Confirmed capabilities from the code
- "Does Not Do": Common assumptions the code doesn't support
- Platform Availability: Check for platform-specific code or limitations

**Success Metrics**
- Look for analytics calls, event tracking, metric logging
- Note dashboard references or metric names in code

**Known Limitations**
- Extract from TODO comments, FIXME notes, known issues
- Note any error handling that reveals limitations

---

## Output Template

```markdown
# Feature Documentation

---

## Feature Overview

**Feature Name:** [Name]

---

## What It Does

[2-3 sentence summary of what this feature enables users to accomplish. Focus on the user benefit, not the implementation.]

### Core Capabilities

- [Primary capability 1]
- [Primary capability 2]
- [Primary capability 3]

### User Problems Solved

[Describe the user pain points or jobs-to-be-done this feature addresses.]

---

## How It Works

### User Flow

1. [Entry point - how users access the feature]
2. [Key interaction step]
3. [Key interaction step]
4. [Outcome - what users see/get at the end]

### System Behavior

[Describe the underlying logic, rules, or algorithms that govern how the feature operates. Include any business rules, thresholds, or conditions that affect behavior.]

**Key Logic:**
- [Rule or condition 1]
- [Rule or condition 2]

**Edge Cases:**
- [How the feature handles unusual scenarios]

### Dependencies

- **Upstream:** [Features, services, or data this feature relies on]
- **Downstream:** [Features or systems that depend on this feature]

---

## Technical Architecture

### Components

| Component | Purpose | Owner |
|-----------|---------|-------|
| [Component name] | [What it does] | [Team] |

### Data Flow

[Brief description of how data moves through the system for this feature. Can include a simple diagram reference if one exists.]

**Data Sources:**
- [Where input data comes from]

**Data Outputs:**
- [Where results are stored or sent]

### API Endpoints (if applicable)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/example/endpoint` | GET | [What it returns] |

---

## Configuration & Settings

### User-Facing Settings

| Setting | Options | Default | Description |
|---------|---------|---------|-------------|
| [Setting name] | [Available values] | [Default] | [What it controls] |

### Internal Configuration

[Any feature flags, admin settings, or configuration parameters that affect behavior.]

---

## Scope & Boundaries

### What This Feature Does

- [Explicit capability]
- [Explicit capability]

### What This Feature Does Not Do

- [Common misconception or out-of-scope item]
- [Related functionality that lives elsewhere]

### Platform Availability

| Platform | Supported | Notes |
|----------|-----------|-------|
| Web | Yes/No | [Any limitations] |
| iOS | Yes/No | [Any limitations] |
| Android | Yes/No | [Any limitations] |
| API | Yes/No | [Any limitations] |

---

## Success Metrics

**Primary Metric:** [The key metric that indicates this feature is working]

**Supporting Metrics:**
- [Secondary metric 1]
- [Secondary metric 2]

**Where to Find Data:** [Dashboard link or data source]

---

## Known Limitations

- [Current limitation 1 and any planned remediation]
- [Current limitation 2]

---

## Related Documentation

- [Link to related docs]
```

---

## Research Checklist

Use this to ensure thorough coverage:

- [ ] Explored directory structure
- [ ] Found entry points (routes, main files)
- [ ] Traced user flow from UI to backend
- [ ] Identified business logic and rules
- [ ] Mapped dependencies (upstream and downstream)
- [ ] Listed all components involved
- [ ] Documented API endpoints
- [ ] Found configuration and settings
- [ ] Checked for feature flags
- [ ] Noted platform-specific code
- [ ] Found analytics/metrics tracking
- [ ] Collected TODO/FIXME comments for limitations

---

## Tips for Success

1. **Start broad, then narrow** - Understand the codebase structure before diving into specific files
2. **Follow the data** - Tracing data flow often reveals the full picture
3. **Read tests** - Test files often document expected behavior clearly
4. **Check comments** - Developers often explain "why" in comments
5. **Look for patterns** - Once you understand one flow, similar features likely follow the same pattern
6. **Ask clarifying questions** - If something is ambiguous in the code, note it for follow-up
7. **Validate assumptions** - If you infer behavior, search for confirmation in the code
