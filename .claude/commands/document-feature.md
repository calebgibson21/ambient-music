# Document Feature

You are tasked with creating comprehensive product documentation for a feature by spawning parallel sub-agents to research the codebase and synthesizing their findings using the feature documentation skill.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to create product documentation. Please provide:
1. The feature name or area to document
2. Optionally: specific files or entry points you know are relevant

I'll research the codebase thoroughly and create documentation that captures what the feature does, how it works, and its technical underpinnings.
```

Then wait for the user's input.

## Steps to follow after receiving the feature to document:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (tickets, docs, code files), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Read the feature documentation skill:**
   - Read `.claude/skills/feature_documentation_skill/SKILL.md` to understand:
     - The research methodology to follow
     - The output template structure
     - Writing guidelines and principles
   - This skill is your source of truth for documentation format

3. **Analyze and decompose the documentation task:**
   - Identify the feature's likely scope and boundaries
   - Take time to ultrathink about what aspects need documentation
   - Create a research plan using TodoWrite to track all subtasks
   - Map out which directories, files, or architectural patterns are relevant

4. **Spawn parallel sub-agent tasks for comprehensive research:**
   - Create multiple Task agents to research different aspects concurrently
   - Use these agents intelligently:

   **Phase 1 - Discovery (run in parallel):**
   - `codebase-locator`: Find all files related to the feature (UI, API, services, tests, config)
   - `codebase-locator`: Find route definitions and entry points
   - `codebase-locator`: Find configuration files and feature flags

   **Phase 2 - Deep Analysis (run in parallel after Phase 1):**
   - `codebase-analyzer`: Trace user flow from UI to backend
   - `codebase-analyzer`: Analyze core business logic and rules
   - `codebase-analyzer`: Document API endpoints and data contracts
   - `codebase-pattern-finder`: Find similar features for context

   **Agent Usage Tips:**
   - Start with locator agents to find what exists
   - Then use analyzer agents on the most promising findings
   - Run multiple agents in parallel when they're searching for different things
   - Each agent knows its job - just tell it what you're looking for
   - Don't write detailed prompts about HOW to search - the agents already know

5. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results
   - Use the Research Checklist from the skill to verify coverage
   - Include specific file paths and line numbers for reference
   - Note any gaps or areas that need clarification

6. **Generate product documentation:**
   - Follow the **Output Template** from the feature documentation skill exactly
   - Apply the **Writing Guidelines** from the skill:
     - User-first language
     - Concrete over abstract
     - Honest about limitations
     - Technical precision
   - Fill sections based on research findings
   - Mark sections as "TBD" or "Needs clarification" if information isn't available
   - Default save location: `docs/features/[feature-name].md` (use kebab-case)

7. **Validate and present findings:**
   - Present a summary of the documentation to the user
   - Highlight any sections marked as TBD or needing clarification
   - Ask if they want to:
     - Fill in any gaps with additional research
     - Adjust the documentation scope or focus
     - Save to a specific location

8. **Save the documentation:**
   - Write to the specified location (default: `docs/features/[feature-name].md`)
   - Confirm the save with the user

9. **Handle follow-up questions:**
   - If the user has follow-up questions, update the documentation
   - Spawn new sub-agents as needed for additional investigation
   - Keep the documentation consistent and cohesive

## Important notes:
- Always use parallel Task agents to maximize efficiency and minimize context usage
- The feature documentation skill (`.claude/skills/feature_documentation_skill/SKILL.md`) is the source of truth for:
  - Research methodology (Steps 1-5 in the skill)
  - Output template structure
  - Writing guidelines
  - Research checklist
- Each sub-agent prompt should be specific and focused on read-only operations
- Keep the main agent focused on synthesis, not deep file reading
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read mentioned files first before spawning sub-tasks (step 1)
  - ALWAYS read the skill file before planning research (step 2)
  - ALWAYS wait for all sub-agents to complete before synthesizing (step 5)
  - NEVER write the documentation with placeholder values
- Mark unknown sections as "TBD" rather than guessing
