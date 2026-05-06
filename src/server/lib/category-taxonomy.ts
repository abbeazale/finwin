export const CATEGORY_GROUP_NAMES = {
  INCOME: "Income",
  ESSENTIALS: "Essentials",
  LIFESTYLE: "Lifestyle",
  FINANCIAL: "Financial",
  TRANSFERS: "Transfers",
  OTHER: "Other",
} as const;

export const CATEGORY_NAMES = {
  PAYCHECK: "Paycheck",
  OTHER_INCOME: "Other Income",
  GROCERIES: "Groceries",
  RENT_AND_UTILITIES: "Rent & Utilities",
  TRANSPORTATION: "Transportation",
  GAS: "Gas",
  HEALTHCARE: "Healthcare",
  INSURANCE: "Insurance",
  RESTAURANTS: "Restaurants",
  ENTERTAINMENT: "Entertainment",
  SHOPPING: "Shopping",
  SUBSCRIPTIONS: "Subscriptions",
  PERSONAL_CARE: "Personal Care",
  TRAVEL: "Travel",
  LOAN_PAYMENTS: "Loan Payments",
  CREDIT_CARD_PAYMENT: "Credit Card Payment",
  BANK_FEES: "Bank Fees",
  TRANSFER: "Transfer",
  UNCATEGORIZED: "Uncategorized",
} as const;

type CategoryGroupName =
  (typeof CATEGORY_GROUP_NAMES)[keyof typeof CATEGORY_GROUP_NAMES];
type CategoryName = (typeof CATEGORY_NAMES)[keyof typeof CATEGORY_NAMES];

type CategoryDef = { name: CategoryName; defaultBudgetable?: boolean };
type GroupDef = {
  name: CategoryGroupName;
  sortOrder: number;
  categories: readonly CategoryDef[];
};

export const CATEGORY_TAXONOMY: readonly GroupDef[] = [
  {
    name: CATEGORY_GROUP_NAMES.INCOME,
    sortOrder: 0,
    categories: [
      { name: CATEGORY_NAMES.PAYCHECK, defaultBudgetable: false },
      { name: CATEGORY_NAMES.OTHER_INCOME, defaultBudgetable: false },
    ],
  },
  {
    name: CATEGORY_GROUP_NAMES.ESSENTIALS,
    sortOrder: 1,
    categories: [
      { name: CATEGORY_NAMES.GROCERIES },
      { name: CATEGORY_NAMES.RENT_AND_UTILITIES },
      { name: CATEGORY_NAMES.TRANSPORTATION },
      { name: CATEGORY_NAMES.GAS },
      { name: CATEGORY_NAMES.HEALTHCARE },
      { name: CATEGORY_NAMES.INSURANCE },
    ],
  },
  {
    name: CATEGORY_GROUP_NAMES.LIFESTYLE,
    sortOrder: 2,
    categories: [
      { name: CATEGORY_NAMES.RESTAURANTS },
      { name: CATEGORY_NAMES.ENTERTAINMENT },
      { name: CATEGORY_NAMES.SHOPPING },
      { name: CATEGORY_NAMES.SUBSCRIPTIONS },
      { name: CATEGORY_NAMES.PERSONAL_CARE },
      { name: CATEGORY_NAMES.TRAVEL },
    ],
  },
  {
    name: CATEGORY_GROUP_NAMES.FINANCIAL,
    sortOrder: 3,
    categories: [
      { name: CATEGORY_NAMES.LOAN_PAYMENTS },
      { name: CATEGORY_NAMES.CREDIT_CARD_PAYMENT, defaultBudgetable: false },
      { name: CATEGORY_NAMES.BANK_FEES },
    ],
  },
  {
    name: CATEGORY_GROUP_NAMES.TRANSFERS,
    sortOrder: 4,
    categories: [{ name: CATEGORY_NAMES.TRANSFER, defaultBudgetable: true }],
  },
  {
    name: CATEGORY_GROUP_NAMES.OTHER,
    sortOrder: 5,
    categories: [
      { name: CATEGORY_NAMES.UNCATEGORIZED, defaultBudgetable: false },
    ],
  },
] as const;

export const DEFAULT_CATEGORY_NAME = CATEGORY_NAMES.UNCATEGORIZED;
export const DEFAULT_CATEGORY_GROUP_NAME = CATEGORY_GROUP_NAMES.OTHER;
