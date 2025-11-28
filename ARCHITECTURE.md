# Architecture & Scalability Guidelines

This project follows a **Service Layer Architecture** to ensure scalability, maintainability, and a clear separation between Frontend (UI) and Backend (Business Logic).

## 📂 Directory Structure (`src/`)

| Directory | Purpose |
| :--- | :--- |
| **`app/`** | **Frontend Entry Points**. Contains Next.js Pages, Layouts, and Routing. **No complex logic here.** |
| **`components/`** | **UI Components**. Reusable React components (Buttons, Forms, Cards). |
| **`server/`** | **The Core Backend**. Contains all business logic and data access. |
| **`db/`** | **Database Configuration**. Schema definitions (Drizzle) and connection setup. |
| **`lib/`** | **Shared Utilities**. Helper functions used across both frontend and backend. |

```text
src/
├── app/                 # Entry points (Routes & UI)
│   ├── (public)/        # Public pages
│   ├── (dashboard)/     # Protected app pages
│   └── api/             # REST Endpoints (Only for external integrations/webhooks)
├── components/          # React Components (UI)
├── lib/                 # Shared utilities
├── db/                  # Database Schema & Connection
├── server/              # Backend Logic (The "Core")
│   ├── actions/         # Server Actions (Callable from Frontend)
│   ├── services/        # Business Logic (Reusable, pure TS functions)
│   └── data-access/     # Database Queries (Drizzle specific code)
└── types/               # TypeScript definitions
```

---

## 🏗️ The `src/server` Pattern

To keep the application scalable, we divide the backend logic into three distinct layers:

### 1. 🟢 Actions (`src/server/actions`)
*   **Role:** The "Public API" for your Frontend.
*   **What it does:**
    *   Receives input from Client Components.
    *   Validates input (using Zod).
    *   Checks authentication/permissions.
    *   Calls **Services**.
    *   Returns data to the UI.
*   **Rule:** **NEVER** write business logic or database queries here directly.

### 2. 🔵 Services (`src/server/services`)
*   **Role:** The "Brain" of the application.
*   **What it does:**
    *   Contains pure business logic (e.g., "Calculate Grade", "Process Payment").
    *   Orchestrates multiple data operations.
    *   Throws errors if rules are violated.
*   **Rule:** This layer should be **framework-agnostic**. It shouldn't know about `NextRequest` or `FormData`.

### 3. 🟣 Data Access (`src/server/data-access`)
*   **Role:** The "Database Layer".
*   **What it does:**
    *   Executes Drizzle ORM queries.
    *   Handles SQL specifics.
*   **Rule:** Only this layer touches the database. If you switch from SQLite to Postgres, you only change files here.

---

## 🔄 Example Flow

1.  **User** clicks "Submit Grade" in the UI (`app/grades/page.tsx`).
2.  **Server Action** `submitGradeAction` is called (`server/actions/grades.ts`).
    *   *Checks if user is a teacher.*
3.  **Service** `GradeService.calculateFinalScore` is called (`server/services/grades.service.ts`).
    *   *Applies math formulas.*
4.  **Data Access** `saveGrade` is called (`server/data-access/grades.dao.ts`).
    *   *Runs `db.insert(grades)...`*

## 🚀 Best Practices
*   **Keep Controllers Skinny:** Server Actions should be short.
*   **Keep Services Pure:** Easy to test.
*   **Type Everything:** Use shared types in `src/types`.
