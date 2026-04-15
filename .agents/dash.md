

# FinWin Dashboard, Initial Page Wireframe

## Goal
The initial page should feel like a financial control center. It should answer the most important questions immediately:

- how much money came in this month
- how much money went out this month
- what the user’s net cashflow is
- whether they are on track with their budget
- where their money is going
- what needs attention right now

The page should prioritize clarity, usefulness, and quick scanning over trying to show everything at once.

---

## Core recommendation
For phase one, the dashboard should focus mainly on personal finance health, not investing discovery.

A stock section can still exist, but it should be small and secondary. The homepage should first prove value through budgeting, transaction visibility, and simple financial insights.

---

## Suggested layout

```text
------------------------------------------------------------
Top bar
- Greeting / page title
- Current month selector
- Quick actions

Row 1
- Money In This Month
- Money Out This Month
- Net Cashflow
- Savings Rate

Row 2
- Cashflow chart
- Spending by category chart

Row 3
- Budget progress / budget alerts
- Recent transactions

Row 4
- Watchlist or market snapshot
- AI insight / financial tip card
------------------------------------------------------------
```

---

## Section-by-section wireframe

### 1. Header section
**Purpose:** orient the user and give them quick control.

**Contents:**
- Page title: `Dashboard`
- Small subtitle: `Your financial snapshot for this month`
- Month filter dropdown
- Optional quick action buttons:
  - `Add transaction`
  - `View budgets`
  - `Go to simulator`

**Why it matters:**
This makes the page feel active and personalized without adding clutter.

---

### 2. KPI cards
**Purpose:** show the most important metrics immediately.

Use 4 summary cards.

#### Card 1, Money In This Month
- Total income received this month
- Small comparison text like: `+8% vs last month`

#### Card 2, Money Out This Month
- Total spending this month
- Small comparison text like: `-3% vs last month`

#### Card 3, Net Cashflow
- `income - expenses`
- Positive should feel encouraging, negative should stand out clearly

#### Card 4, Savings Rate
- Formula: `(money saved / money in) * 100`
- Show percent and maybe a small progress indicator

**Why these 4:**
They are easy to understand and tell the user instantly whether the month is going well.

---

### 3. Cashflow chart
**Purpose:** help users understand the flow of income and spending visually.

**Recommended chart:**
- Bar chart or dual-line chart
- Income vs expenses over time

**Default view:**
- current month by week

**Optional toggles later:**
- 3 months
- 6 months
- 12 months

**What this answers:**
- When money is coming in
- Whether spending is stable or spiking
- How cashflow changes over time

---

### 4. Spending by category chart
**Purpose:** show where the money is actually going.

**Recommended chart:**
- donut chart for fast visual breakdown
- or bar chart if you want easier comparison

**Categories example:**
- Housing
- Groceries
- Restaurants
- Transportation
- Shopping
- Entertainment
- Bills
- Other

**Why it matters:**
This is one of the fastest ways for users to understand their own behavior.

---

### 5. Budget progress section
**Purpose:** make the dashboard actionable.

Instead of showing every budget, show the most important ones.

**Recommended content:**
- 3 to 5 budget rows
- prioritize categories that are:
  - closest to the limit
  - over budget
  - most active this month

**Example format:**
- Groceries: `$420 / $500`
- Restaurants: `$310 / $300`
- Entertainment: `$85 / $150`

**Optional status labels:**
- On track
- Near limit
- Over budget

**Why it matters:**
This section tells the user what needs attention right now, which is more useful than just showing historical information.

---

### 6. Recent transactions
**Purpose:** make the dashboard feel real and connected to live financial data.

**Show:**
- last 5 to 8 transactions

**Columns:**
- merchant
- category
- amount
- date

**Example entries:**
- Save-On-Foods, Groceries, `$48.22`, Mar 8
- Shell, Transportation, `$72.10`, Mar 7
- Spotify, Subscriptions, `$11.99`, Mar 6

**Why it matters:**
Users often want quick confirmation that transactions are categorized correctly and nothing looks off.

---

### 7. Small investing section
**Purpose:** introduce investing without letting it dominate the dashboard.

For phase one, keep this small.

**Better than “Top 8 best tech stocks”:**
A generic “best stocks” list can feel noisy, opinionated, and disconnected from the user’s finances.

Use one of these instead:

#### Option A, Tech watchlist
A compact list of 4 to 6 major names:
- Apple
- Microsoft
- Nvidia
- Amazon
- Meta
- Alphabet

Show only simple info:
- ticker
- price
- daily change

#### Option B, Market snapshot
A small market card with:
- S&P 500
- Nasdaq
- Bitcoin
- 2 to 4 tracked stocks

#### Option C, Simulator prompt
A card that says something like:
- `Try a simulated portfolio`
- `See how investing $100/month would perform`

**Best phase one recommendation:**
Use a simple watchlist or simulator entry point, not a large “best stock picks” block.

---

### 8. AI insight card
**Purpose:** make the page feel smarter and more personal.

**Example insight types:**
- `You spent 18% more on restaurants than last month.`
- `Your largest expense category this month is transportation.`
- `You are on track to stay within 3 of your 4 active budgets.`
- `If you reduce restaurant spending by $80, your savings rate would improve noticeably.`

**Why it matters:**
This creates a sense that the app is helping interpret the numbers, not just showing them.

For early versions, this can be rule-based instead of AI-generated.

---

## Recommended priority for phase one
If you want the best balance of speed and usefulness, build these first:

1. Header
2. KPI cards
3. Cashflow chart
4. Spending by category chart
5. Recent transactions
6. Budget progress
7. Small investing widget
8. Insight card

---

## Best practical v1 homepage
If you want the most realistic and polished version one, use this exact structure:

### Top row
- Money In This Month
- Money Out This Month
- Net Cashflow
- Savings Rate

### Middle row
- Cashflow chart
- Spending by category chart

### Bottom row
- Budget progress
- Recent transactions

### Footer row or side panel
- Small watchlist / simulator card
- Insight card

---

## What to avoid on the first dashboard
- too many widgets
- long tables
- lots of stock picks
- market news feed
- advanced investing analytics
- anything that distracts from budgeting and spending clarity

The initial page should feel focused, clean, and immediately useful.

---

## Final recommendation
Yes, include a small investing element, but do not make “top 8 best tech stocks” a major homepage feature.

The best initial dashboard for FinWin is one that helps the user understand:
- money in
- money out
- net position
- budget health
- spending breakdown
- recent activity
- one smart next action

That makes the homepage feel valuable even before the investing side becomes more advanced.