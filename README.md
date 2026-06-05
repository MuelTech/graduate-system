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
- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** MySQL
- **Authentication:** JWT

### AI Layer
- **LLM:** Qwen (via Ollama)
- **RAG Framework:** LangChain
- **OCR:** Tesseract.js

### Deployment
- **Process Manager:** PM2
- **Web Server:** Nginx

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
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
   - Copy `.env.example` to `.env` in the backend directory
   - Update database credentials and other settings

5. **Set up Database**
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate dev
   ```

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
│   └── prisma/       # Database schema
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

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
