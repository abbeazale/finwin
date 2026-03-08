# FinWin

## opensource AI Budget + Simulated Portfolio App

### Technical Architecture (v0.1)

---

# Overview

FinWin is a financial analysis and investing simulation platform that allows users to:

- Connect their bank accounts
- Analyze spending and budgeting with AI
- Simulate investing using their real income
- Track portfolio performance over time
- Learn investing through realistic simulations

The platform prioritizes:

- strong type safety
- SQL-based financial modeling
- scalable architecture
- modern React development practices

---

# Core Tech Stack

## Frontend

Framework

- Next.js
- TypeScript
- Bun

UI System

- TailwindCSS
- shadcn/ui

Data Fetching

- TanStack Query

API Layer

- tRPC

Why tRPC

- End-to-end type safety
- Shared types between backend and frontend
- Eliminates manual API schemas
- Excellent developer experience

Example usage

```tsx
trpc.transactions.getAll()
trpc.portfolio.buyStock()
trpc.portfolio.getValue()
```

# **Charts & Visualization**

The application will use **two chart systems**.

---

## **1. Dashboard Charts**

Library

- Recharts
- shadcn chart components

Used for

- Spending by category
- Monthly cashflow
- Savings rate
- Budget vs actual
- Asset allocation

Why

- React-first library
- Integrates well with shadcn UI
- Easy styling with Tailwind
- Fast development

Documentation

[https://recharts.org/](https://recharts.org/)

---

## **2. Portfolio / Market Charts**

Library

- TradingView Lightweight Charts

Used for

- Stock price charts
- Portfolio value over time
- Investment performance charts

Benefits

- Optimized for financial time series
- Zoom and crosshair support
- High performance for large datasets

Documentation

[https://www.tradingview.com/lightweight-charts/](https://www.tradingview.com/lightweight-charts/)

---

# **Backend Architecture**

Backend logic will run using:

- Next.js server runtime
- tRPC procedures

Instead of REST endpoints, the system exposes **typed procedures**.

Example

```tsx
export const portfolioRouter = router({
  buyStock: publicProcedure
    .input(z.object({
      symbol: z.string(),
      shares: z.number()
    }))
    .mutation(async ({ input }) => {
      // trading logic
    }),
});
```

Benefits

- Fully typed API
- Less boilerplate
- Faster development

---

# **Database**

Provider

- Neon

Database

- PostgreSQL

Documentation

[https://neon.tech/](https://neon.tech/)

Why Neon

- Serverless Postgres
- Generous free tier
- Easy scaling
- Compatible with modern ORMs

---

# **ORM**

ORM

- Drizzle ORM

Documentation

[https://orm.drizzle.team/](https://orm.drizzle.team/)

Why Drizzle

- SQL-first design
- Lightweight
- Excellent TypeScript support
- Easier query control than Prisma

Example schema

```tsx
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
});
```

# **Authentication**

- Clerk

---

# **Financial Data Integration**

Bank Data Provider

- Plaid

Documentation

[https://plaid.com/](https://plaid.com/docs/)

Capabilities

- Bank account linking
- Transaction import
- Account balances

MVP Strategy

1. Use Plaid sandbox
2. Import transactions
3. Categorize spending
4. Run AI insights

---

# **Portfolio Simulation System**

The app simulates investing using **virtual money derived from income**.

Initial Model

Simple investing only.

Supported actions

- Buy shares
- Sell shares
- Track positions
- Track portfolio value

# **Core Database Tables**

```tsx
users

bank_accounts
transactions
transaction_categories
budgets
income_events

ai_insights
```

# **AI System Design**

The AI will **not compute financial metrics directly**.

Instead the system uses a **two-layer model**.

---

## **Layer 1 — Deterministic Financial Analysis**

The backend calculates:

- total income
- total expenses
- savings rate
- category spending
- recurring subscriptions
- spending trends

Example

```tsx
{
  "income": 4200,
  "expenses": 3100,
  "food_spending": 700,
  "top_category": "restaurants",
  "subscription_count": 6
}
```

## **Layer 2 — AI Explanation**

The AI converts the structured data into insights.

Example

"You spent 22% more on restaurants this month compared to last month."

This ensures

- accuracy
- deterministic financial calculations
- useful insights

---

# **Infrastructure**

Frontend Hosting

- Vercel

Database

- Neon Postgres

Future infrastructure additions

- Background workers
- Job queues
- Stock price ingestion services
- AI insight generation workers

---

# **MVP Feature Scope**

Version 1 will include

1. Authentication
2. Bank account connection
3. Transaction import
  1. catecgorry confidence
4. Budget dashboard
5. Spending analytics
6. Simulated investing
7. Portfolio tracking
8. AI financial insights

---

# **Future Features**

Planned roadmap

- Dividend simulation
- Stock splits
- Tax lot tracking
- Investment strategy simulation
- Long-term financial projections
- Goal-based investing
- AI financial planning

---



