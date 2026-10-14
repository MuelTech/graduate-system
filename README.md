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
- npm or yarn
- Ollama (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd graduate-system
   ```

2. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

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

The current integration branch is `refactor/system-ui-ux`. Unless the team explicitly changes the integration strategy, feature Pull Requests should target this branch rather than `main`.

Recommended workflow:

1. Update your local integration branch:
   ```bash
   git checkout refactor/system-ui-ux
   git pull origin refactor/system-ui-ux
   ```
2. Create or update your feature branch from the current integration state.
3. Implement and test only the intended feature scope.
4. If `schema.prisma` changes, generate and commit the corresponding Prisma migration.
5. Build/validate the affected application before pushing.
6. Push the feature branch.
7. Open a Pull Request with **base: `refactor/system-ui-ux`**.
8. Address review findings on the feature branch before merge.

### Pull Request Checklist

Before requesting merge:

- [ ] Pull Request targets `refactor/system-ui-ux`.
- [ ] Changes are limited to the intended feature/fix.
- [ ] Frontend changes pass the relevant lint/build checks.
- [ ] Backend changes compile successfully.
- [ ] Prisma schema validates when Prisma is affected.
- [ ] Every Prisma schema change includes its generated migration file.
- [ ] Existing committed migrations are not rewritten or deleted without an explicit migration-history reason.
- [ ] No unrelated files or local environment files are included.

## License

This project is licensed under the MIT License.
