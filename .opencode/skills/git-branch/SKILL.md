---
name: git-branch
description: Create a new git branch for a feature. Use when user wants to create a new branch.
license: MIT
metadata:
  author: user
  version: "1.0"
---

Create a new git branch for a feature.

---

**Input**: The user types `/branch <feature-name>` to create a new branch.

**Steps**

1. **Extract the branch name from user input**
   - The input after `/branch` is the feature name
   - Convert to kebab-case (lowercase, hyphens)
   - Example: "Add dark mode" → `feature/add-dark-mode`

2. **Check current git status**
   - Run `git status` to see current state
   - If there are uncommitted changes, warn the user

3. **Create the branch**
   ```bash
   git checkout -b "feature/<branch-name>"
   ```

4. **Verify branch created**
   ```bash
   git branch --show-current
   ```

**Output**

- Confirm the branch was created
- Show the branch name
- Remind user to commit changes