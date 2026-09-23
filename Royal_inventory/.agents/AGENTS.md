# Workspace Coding Rules

To conserve tokens and optimize performance, the AI coding assistant must adhere to the following file and directory exclusion rules:

## 1. Directory Exclusions
Do not read, search, list, or index files in the following directories:
- `node_modules/`
- `build/`
- `.dart_tool/`
- `.git/`
- `coverage/`
- `dist/`
- `ios/Pods/`
- `android/.gradle/`
- `scratch/`

## 2. File Pattern Exclusions
Ignore the following file types and extensions completely:
- `*.lock` (e.g., `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`)
- `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.webp`, `*.ico`, `*.svg` (images and assets)
- `*.mp4`, `*.mov`, `*.avi`, `*.webm` (videos)
- `*.pdf`, `*.zip`, `*.tar.gz`, `*.rar` (binary documents and archives)
- Any compiled build output or binary files.

## 3. Tool Usage Guidance
- When using `grep_search`, always restrict the search scope to source folders (e.g., `src/`, `public/`) and use file type filters whenever possible.
- Avoid calling `list_dir` or `view_file` on ignored paths or patterns.
