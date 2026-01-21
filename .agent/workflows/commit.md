---
description: Safely stage and commit changes on Windows without using the && operator.
---

1. Stage all changes
   run_command("git add .")

2. Commit changes
   // Instruct the agent to generate a meaningful commit message
   run_command("git commit -m 'Your commit message here'")

TIMING:
- This workflow should be used whenever the user asks to "commit" or "save changes" to git.
- It prevents the common error of using `git add . && git commit` which fails on standard Windows command prompts.
