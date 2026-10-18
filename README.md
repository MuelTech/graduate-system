# Graduate School System

A comprehensive Graduate School Management System with AI-powered features including chatbot, OCR, and intelligent document processing.

## Tech Stack

### Frontend
- **Framework:** Next.js with TypeScript
- **UI Components:** shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** TanStack Query
- **Data Visualization:** Chart.js
- **Authentication:** NextAuth

### Backend
- **Runtime:** Node.js (v22.13.0 or higher)
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** MySQL
- **Authentication:** JWT
- **Document extraction:** PDF.js (`pdfjs-dist`) native PDF text extraction

### AI Layer
- **LLM:** Qwen (via Ollama)
- **RAG Framework:** LangChain
- **OCR:** Tesseract.js

### Deployment
- **Process Manager:** PM2
- **Web Server:** Nginx

## Getting Started

### Prerequisites
- Node.js (v22.13.0 or higher) — required by `pdfjs-dist` and Prisma on the backend
- MySQL (v8 or higher)
- npm
- Ollama (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd graduate-system
   ```

2. **Install Existing Frontend Dependencies**

   For a fresh clone or when installing the dependency set already committed to the repository, use `npm ci` so the exact versions from `package-lock.json` are installed:

   ```bash
   cd frontend
   npm ci
   ```

3. **Install Existing Backend Dependencies**

   The backend tree currently contains an upstream required-peer conflict
   (`@langchain/community` peers on `@browserbasehq/stagehand`, which peers on
   `dotenv@^16`, while this project uses `dotenv@^17`). A plain `npm ci`
   therefore cannot resolve the current backend tree. Use:

   ```bash
   cd backend
   npm ci --legacy-peer-deps
   npx prisma generate
   ```

   `npx prisma generate` should run before the backend build so the generated Prisma Client matches the committed schema.

4. **Set up Environment Variables**
   - Copy `.env.example` to `.env` in the backend directory.
   - Update database credentials and other settings.

5. **Set up Database**

   If the repository already contains the required migration files, apply them with:

   ```bash
   cd backend
   npx prisma migrate deploy
   npx prisma generate
   ```

   Use `prisma migrate dev` only when you are actively creating a new Prisma schema change and need to generate a new migration. See [Prisma / Database Workflow](#prisma--database-workflow).

6. **Start Development Servers**

   **Backend:**
   ```bash
   cd backend
   npm run dev
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

7. **Set up Ollama (for AI features)**
   ```bash
   # Install Ollama from https://ollama.ai
   ollama pull qwen2.5:7b
   ```

## Development networking / backend origin

The frontend and backend are separate processes. In development, browser REST and Defense Socket.IO follow the hostname used to open the frontend unless an explicit backend URL is configured.

| Frontend URL | Browser backend in development |
| --- | --- |
| `http://localhost:3000` | `http://localhost:5000` |
| `http://127.0.0.1:3000` | `http://127.0.0.1:5000` |
| `http://<LAN_IP>:3000` | `http://<same-LAN-IP>:5000` |
| Production | Explicit configured `NEXT_PUBLIC_BACKEND_API_URL` |

### Localhost development

Use the committed examples as the baseline:

```env
# frontend/.env
BACKEND_API_URL="http://localhost:5000"
# NEXT_PUBLIC_BACKEND_API_URL is intentionally left unset
```

The browser derives `http://localhost:5000` from `window.location.hostname`. Frontend and backend are still separate processes, so DevTools will show requests to port 5000; they remain on loopback.

If you open the frontend at `http://127.0.0.1:3000`, the browser targets `http://127.0.0.1:5000`. Include `http://127.0.0.1:3000` in the backend `FRONTEND_URL` allowlist. The example backend configuration includes both loopback forms.

### LAN / phone / multi-device development

Open the frontend using the host machine's LAN address:

```text
http://<LAN_IP>:3000
```

The browser will target `http://<same-LAN-IP>:5000`. Also update these untracked local settings:

```env
# frontend/.env
ALLOWED_DEV_ORIGINS="<LAN_IP>"

# backend/.env
FRONTEND_URL="http://localhost:3000,http://<LAN_IP>:3000"
```

`ALLOWED_DEV_ORIGINS` controls Next.js development resources/HMR only. It is not the REST or Socket.IO backend URL. `FRONTEND_URL` remains the explicit CORS allowlist for REST and Socket.IO; do not use wildcard CORS with credentialed requests.

### Explicit backend override

`NEXT_PUBLIC_BACKEND_API_URL` is optional in development. Set it only when the browser must use a backend different from the frontend host. It is compiled into the browser bundle, so restart `next dev` or rebuild after changing it.

```env
# frontend/.env
NEXT_PUBLIC_BACKEND_API_URL="http://localhost:5000"
```

### Production

Production must set both values explicitly:

```env
NEXT_PUBLIC_BACKEND_API_URL="https://api.example.edu"
BACKEND_API_URL="https://api.example.edu"
```

Production never infers the backend from `window.location`. Missing required configuration fails clearly instead of silently falling back to localhost or a LAN address.

### Documents and downloads

Document viewing stays same-origin through `/api/documents/...`. The Next.js document proxy uses the server-side `BACKEND_API_URL`; browser code does not need a separate document origin.

### Troubleshooting checklist

1. Open DevTools Network and confirm whether REST calls target `localhost:5000`, `127.0.0.1:5000`, or a LAN IP.
2. Check that `frontend/.env` does not contain an old LAN value in `NEXT_PUBLIC_BACKEND_API_URL`.
3. Restart `next dev` after changing any `NEXT_PUBLIC_*` value.
4. Confirm `http://<target-host>:5000/api/health` is reachable from the browser environment.
5. For LAN testing, add the LAN frontend origin to `backend/.env` `FRONTEND_URL` and the LAN hostname to `frontend/.env` `ALLOWED_DEV_ORIGINS`.
6. If the backend is on another machine, set explicit `BACKEND_API_URL` and `NEXT_PUBLIC_BACKEND_API_URL` values.

## Dependency Installation Workflow

`npm ci` and `npm install` serve different purposes. **`npm ci` does not replace `npm install` when the project intentionally changes dependencies.**

### Installing the Existing Committed Dependency Tree

Use this after cloning, pulling dependency changes, switching branches, or when reproducing the repository's committed dependency state.

Frontend:

```bash
cd frontend
npm ci
```

Backend:

```bash
cd backend
npm ci --legacy-peer-deps
npx prisma generate
```

`npm ci` installs the exact dependency tree recorded in `package-lock.json` and does not intentionally update dependency definitions.

### Adding, Removing, or Updating Dependencies

When development work intentionally adds, removes, or upgrades a dependency, use `npm install` / `npm uninstall`.

Examples:

```bash
# Add a runtime dependency
npm install <package>

# Add a development-only dependency
npm install -D <package>

# Install a specific version
npm install <package>@<version>

# Remove a dependency
npm uninstall <package>
```

For backend dependency changes, use `--legacy-peer-deps` when npm needs the same currently documented peer-resolution behavior:

```bash
npm install <package> --legacy-peer-deps
npm install -D <package> --legacy-peer-deps
```

When a dependency changes, review and commit **both** files when modified:

```text
package.json
package-lock.json
```

Do not manually edit `package-lock.json`. Let npm update it from the intended dependency command.

### Quick Rule

| Situation | Recommended command |
| --- | --- |
| Fresh clone / install dependencies already committed | `npm ci` |
| Backend fresh clone / existing committed dependencies | `npm ci --legacy-peer-deps` |
| Add a new package | `npm install <package>` |
| Add a new dev package | `npm install -D <package>` |
| Upgrade/downgrade a package intentionally | `npm install <package>@<version>` |
| Remove a package | `npm uninstall <package>` |

## Project Structure

```
graduate-system/
├── frontend/          # Next.js frontend application
│   ├── src/
│   │   ├── app/      # App router pages
│   │   ├── components/ # Reusable components
│   │   └── lib/      # Utility functions
│   └── public/       # Static assets
├── backend/           # Express.js backend API
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/ # Custom middleware
│   │   └── services/ # Business logic
│   └── prisma/       # Database schema and migrations
└── references/        # Documentation
```

## Features

- **Student Portal:** Admission forms, thesis tracking, enrollment
- **AI Chatbot:** Answers academic inquiries using RAG
- **OCR Processing:** Extracts data from scanned documents
- **Thesis Repository:** Semantic search and recommendations
- **Analytics Dashboard:** Visualizes academic data
- **Role-based Access:** Students, Faculty, Administrators

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/students` - Get students list
- `GET /api/thesis` - Get thesis list
- `POST /api/chat` - AI chatbot endpoint

## Prisma / Database Workflow

Prisma schema changes must always be accompanied by the migration required to reproduce the database change on another developer machine, staging environment, or production server.

### Creating a New Schema Change

When you add, remove, rename, or modify a Prisma model or field in `backend/prisma/schema.prisma`, create a migration before opening a Pull Request:

```bash
cd backend
npx prisma migrate dev --name <descriptive_migration_name>
npx prisma generate
```

Commit both the schema change and the generated migration:

```text
backend/prisma/schema.prisma
backend/prisma/migrations/<timestamp>_<migration_name>/migration.sql
```

**Do not submit a Pull Request containing Prisma schema changes without the corresponding migration file.**

### Applying Existing Migrations

When you pull or switch to a branch where the migration file already exists, apply pending committed migrations with:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

This is also the migration command intended for staging and production deployment.

### Prisma Command Reference

| Command | Purpose |
| --- | --- |
| `npx prisma generate` | Regenerates Prisma Client. Does not change the database and does not create a migration. |
| `npx prisma migrate dev --name <name>` | Creates and applies a new migration while developing a schema change. |
| `npx prisma migrate deploy` | Applies migration files that already exist in the repository. Does not create new migrations. |
| `npx prisma db push` | Pushes the schema directly to a database without creating migration history. Do not use this as a replacement for committed migrations in shared repository work. |
| `npx prisma studio` | Opens Prisma's data browser/editor. It is not a migration command. |

## Contributing

The current shared integration baseline is `main`. Unless the team explicitly chooses another target for a specific workstream, new feature/fix branches should start from the latest `main` and open Pull Requests back into `main`.

Recommended workflow:

1. Update your local `main`:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create a bounded feature/fix branch from the current `main`.
3. Implement and test only the intended scope.
4. If dependencies change, use `npm install` / `npm uninstall` and commit the resulting `package.json` and `package-lock.json` changes.
5. If `schema.prisma` changes, generate and commit the corresponding Prisma migration.
6. Build/validate the affected application before pushing.
7. Push the feature/fix branch.
8. Open a Pull Request with **base: `main`**.
9. Address review findings on the feature/fix branch before merge.

### Pull Request Checklist

Before requesting merge:

- [ ] Pull Request targets `main` unless a different integration target was explicitly agreed.
- [ ] Changes are limited to the intended feature/fix.
- [ ] Frontend changes pass the relevant lint/build checks.
- [ ] Backend changes compile successfully.
- [ ] Dependency changes include the intended `package.json` and `package-lock.json` updates.
- [ ] Prisma schema validates when Prisma is affected.
- [ ] Every Prisma schema change includes its generated migration file.
- [ ] Existing committed migrations are not rewritten or deleted without an explicit migration-history reason.
- [ ] No unrelated files or local environment files are included.

## License

This project is licensed under the MIT License.
