# Project Title

This is a [Next.js](https://nextjs.org) project that provides a robust authentication system using [NextAuth.js](https://next-auth.js.org/) and a database managed with [Drizzle ORM](https://orm.drizzle.team/).

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

* npm
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/your_username_/Project-Name.git
   ```
2. Install NPM packages
   ```sh
   npm install
   ```
3. Create a `.env` file in the root of the project and add the following environment variable:
   ```
   DATABASE_URL="file:local.db"
   ```
4. Run the database migrations to create the tables:
   ```sh
   npm run drizzle:migrate
   ```
5. Seed the database with initial data:
    ```sh
    npm run db:seed
    ```

### Running the Application

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Project Structure

Here is an overview of the project structure:

```
.
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts  // NextAuth.js API route handlers
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── auth.config.ts        // NextAuth.js configuration
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts      // Drizzle ORM setup
│   │   │   ├── schema.ts     // Database schema
│   │   │   └── seed.ts       // Database seeding script
│   │   └── utils/
│   │       └── password.ts   // Password hashing utilities
│   └── types/
│       └── next-auth.d.ts    // TypeScript definitions for NextAuth.js
├── .env.example              // Example environment file
├── drizzle.config.ts         // Drizzle ORM configuration
├── next.config.ts
└── package.json
```

## Learn More

To learn more about the technologies used in this project, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [NextAuth.js Documentation](https://next-auth.js.org/getting-started/introduction) - learn about NextAuth.js.
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) - learn about Drizzle ORM.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
