# dream-chat - Agent Instructions

This project follows a decoupled MEAN stack architecture.

## Architecture
- **Frontend**: Angular v21+ (located in `/frontend`)
- **Backend**: Node/Express + Mongoose (located in `/backend`)

## Portfolio Requirements
- **Security**: Iframe headers are set to allow embedding in `carter-portfolio.fyi`.
- **CSS**: Using tailwind.
- **Features**: Standard.
- **Vercel Watcher**: Persistent sync enabled via `pre-push` git hook.

## Agent Rules
- Always maintain the iframe security headers in `backend/app.js`.
- Prefer Signals for Angular state.
- Use standalone components.
- **Environment**: Normal `git push` pushes code without syncing `.env.local`. When you change `.env.local`, use `npm run sync` (or `git push-sync`) to sync with Vercel.

## Agent Operational Directives
- **File Deletions**: When deleting multiple files, do so one at a time.
- **Syntax**: Use standard POSIX/bash shell commands.
- **Persistence**: If a command fails, inspect the error output and try alternative shell commands.
- **Privacy**: Never expose the `.env.local` file content in logs.

