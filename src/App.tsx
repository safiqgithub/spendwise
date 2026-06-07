import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { supabase, supabaseConfigured } from "@/lib/supabase";

type Currency = "INR" | "USD";

type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
};

type Expense = {
  id: string;
  categoryId: string;
  amount: number;
  description: string;
  date: string;
  isRecurring: boolean;
};

type Budget = {
  categoryId: string;
  month: string;
  monthlyLimit: number;
};

type Profile = {
  displayName: string;
  email: string;
  monthlyIncome: number;
  currency: Currency;
  onboardingComplete: boolean;
};

type AppData = {
  profile: Profile;
  categories: Category[];
  expenses: Expense[];
  budgets: Budget[];
};

const STORAGE_KEY = "spendwise-app-data-v2";

const defaultCategories: Category[] = [
  { id: "food", name: "Food", icon: "FD", color: "#0f766e", isDefault: true },
  { id: "rent", name: "Rent", icon: "RT", color: "#2563eb", isDefault: true },
  { id: "transport", name: "Transport", icon: "TR", color: "#d97706", isDefault: true },
  { id: "entertainment", name: "Entertainment", icon: "EN", color: "#7c3aed", isDefault: true },
  { id: "shopping", name: "Shopping", icon: "SH", color: "#db2777", isDefault: true },
  { id: "health", name: "Health", icon: "HL", color: "#dc2626", isDefault: true },
  { id: "education", name: "Education", icon: "ED", color: "#0891b2", isDefault: true },
  { id: "utilities", name: "Utilities", icon: "UT", color: "#65a30d", isDefault: true },
  { id: "savings", name: "Savings", icon: "SV", color: "#16a34a", isDefault: true },
  { id: "others", name: "Others", icon: "OT", color: "#475569", isDefault: true },
];

const defaultData: AppData = {
  profile: {
    displayName: "",
    email: "",
    monthlyIncome: 0,
    currency: "INR",
    onboardingComplete: false,
  },
  categories: defaultCategories,
  expenses: [],
  budgets: [],
};

function cloneDefaultData() {
  return JSON.parse(JSON.stringify(defaultData)) as AppData;
}

function createFreshUserData(email: string, displayName: string): AppData {
  const freshData = cloneDefaultData();
  return {
    ...freshData,
    profile: {
      ...freshData.profile,
      email,
      displayName,
      onboardingComplete: false,
    },
  };
}

function getPasswordResetRedirectUrl() {
  return `${window.location.origin}/reset-password`;
}

function monthOf(date: string) {
  return date.slice(0, 7);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

function currencySymbol(currency: Currency) {
  return currency === "INR" ? "Rs." : "$";
}

function money(amount: number, currency: Currency) {
  return `${currencySymbol(currency)}${Math.round(amount).toLocaleString("en-IN")}`;
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCategory(categories: Category[], categoryId: string) {
  return categories.find((category) => category.id === categoryId) ?? categories[categories.length - 1];
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(!supabaseConfigured);
  const [data, setData] = useState<AppData>(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? { ...cloneDefaultData(), ...JSON.parse(saved) } : cloneDefaultData();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (!supabaseConfigured) {
      return;
    }

    supabase.auth.getSession().then(({ data: authData }) => {
      setSession(authData.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user?.email) {
        const metadataName =
          typeof nextSession.user.user_metadata?.display_name === "string"
            ? nextSession.user.user_metadata.display_name
            : "";
        setData((current) => ({
          ...current,
          profile: {
            ...current.profile,
            email: nextSession.user.email ?? current.profile.email,
            displayName: current.profile.displayName || metadataName,
          },
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!authChecked) {
    return <div className="screen-loader">Loading SpendWise...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={<AuthPage session={session} setData={setData} />}
        />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <AppShell data={data}>
              <OnboardingPage data={data} setData={setData} />
            </AppShell>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AppShell data={data}>
              <DashboardPage data={data} />
            </AppShell>
          }
        />
        <Route
          path="/expenses"
          element={
            <AppShell data={data}>
              <ExpensesPage data={data} setData={setData} />
            </AppShell>
          }
        />
        <Route
          path="/budgets"
          element={
            <AppShell data={data}>
              <BudgetsPage data={data} setData={setData} />
            </AppShell>
          }
        />
        <Route
          path="/profile"
          element={
            <AppShell data={data}>
              <ProfilePage data={data} setData={setData} />
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function AuthPage({
  session,
  setData,
}: {
  session: Session | null;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/dashboard", { replace: true });
  }, [navigate, session]);

  async function submitAuth(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (!email.includes("@")) {
      setMessage("Invalid email format");
      return;
    }

    const trimmedName = displayName.trim();
    if (mode === "register" && trimmedName.length < 2) {
      setMessage("Enter your name to create the account.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    if (supabaseConfigured) {
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: trimmedName },
              },
            });

      setLoading(false);

      if (result.error) {
        setMessage(result.error.message.includes("already") ? "Email already in use" : result.error.message);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      setLoading(false);
    }

    if (remember) {
      window.localStorage.setItem("spendwise-last-email", email);
    }

    setData((current) =>
      mode === "register"
        ? createFreshUserData(email, trimmedName)
        : {
            ...current,
            profile: {
              ...current.profile,
              email,
            },
          },
    );

    navigate(mode === "register" ? "/onboarding" : "/dashboard");
  }

  async function signInWithGoogle() {
    if (supabaseConfigured) {
      await supabase.auth.signInWithOAuth({ provider: "google" });
      return;
    }
    setMessage("Google sign-in is ready once Supabase environment keys are configured.");
  }

  async function forgotPassword() {
    if (!email.includes("@")) {
      setMessage("Enter your email first, then request a reset link.");
      return;
    }
    if (supabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      setMessage(error ? error.message : "Password reset email sent.");
      return;
    }
    setMessage("Demo mode: password reset will send through Supabase after keys are configured.");
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-lockup">
          <span className="brand-mark">$</span>
          <div>
            <h1>SpendWise</h1>
            <p>Track spending, shape budgets, and see where your money goes.</p>
          </div>
        </div>
        {/* <div className="ledger-preview">
          <div>
            <span>Monthly balance</span>
            <strong>Rs.21,951</strong>
          </div>
          <div className="spark-bars" aria-hidden="true">
            {[42, 64, 48, 78, 55, 88].map((height) => (
              <span key={height} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div> */}
      </section>

      <section className="auth-panel">
        <div className="tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Register
          </button>
        </div>

        <form onSubmit={submitAuth} className="form-stack">
          {mode === "register" && (
            <label>
              Name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
            </label>
          )}
          <label>
            Email
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label>
            Password
            <span className="password-row">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
              />
              <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          <div className="form-row">
            <label className="check-row">
              <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              Remember me
            </label>
            <button type="button" className="text-button" onClick={forgotPassword}>
              Forgot password
            </button>
          </div>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
          <button type="button" className="secondary-button" onClick={signInWithGoogle}>
            Continue with Google
          </button>
          <button type="button" className="text-button center" onClick={() => navigate("/dashboard")}>
            Continue in demo mode
          </button>
        </form>
      </section>
    </main>
  );
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage("");

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (!supabaseConfigured) {
      setMessage("Password reset will work after Supabase is configured.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated. You can login with the new password.");
    await supabase.auth.signOut();
    window.setTimeout(() => navigate("/login", { replace: true }), 800);
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="brand-lockup">
          <span className="brand-mark">$</span>
          <div>
            <h1>SpendWise</h1>
            <p>Reset your account password securely.</p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <h2 className="section-title">Create new password</h2>
        <form onSubmit={updatePassword} className="form-stack">
          <label>
            New password
            <span className="password-row">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
              />
              <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
          <label>
            Confirm password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              placeholder="Repeat new password"
            />
          </label>
          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={loading}>
            {loading ? "Updating..." : "Update password"}
          </button>
          <button type="button" className="text-button center" onClick={() => navigate("/login")}>
            Back to login
          </button>
        </form>
      </section>
    </main>
  );
}

function AppShell({ data, children }: { data: AppData; children: React.ReactNode }) {
  const navigate = useNavigate();

  async function logout() {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/dashboard" className="sidebar-brand">
          <span className="brand-mark">$</span>
          <span>SpendWise</span>
        </Link>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/expenses">Expenses</NavLink>
          <NavLink to="/budgets">Budgets</NavLink>
          <NavLink to="/profile">Profile</NavLink>
        </nav>
        <div className="sidebar-card">
          <span>Income</span>
          <strong>{money(data.profile.monthlyIncome, data.profile.currency)}</strong>
          <Link to="/onboarding">Update setup</Link>
        </div>
      </aside>
      <div className="content-shell">
        <header className="topbar">
          <div>
            <span className="eyebrow">Personal finance workspace</span>
            <strong>{data.profile.displayName || "SpendWise user"}</strong>
          </div>
          <button className="secondary-button compact" onClick={logout}>
            Logout
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

function OnboardingPage({
  data,
  setData,
}: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [income, setIncome] = useState(String(data.profile.monthlyIncome));
  const [currency, setCurrency] = useState<Currency>(data.profile.currency);
  const [budgets, setBudgets] = useState<Record<string, number>>(
    Object.fromEntries(data.categories.map((category) => [category.id, getBudget(data.budgets, category.id, currentMonth())])),
  );

  function finish(skipBudgets = false) {
    setData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        monthlyIncome: Number(income) || 0,
        currency,
        onboardingComplete: true,
      },
      budgets: skipBudgets
        ? current.budgets
        : upsertBudgets(current.budgets, current.categories, budgets, currentMonth()),
    }));
    navigate("/dashboard");
  }

  return (
    <main className="page narrow-page">
      <PageHeader
        eyebrow="Setup"
        title="Shape SpendWise around your month"
        action={<span className="step-pill">Step {step} of 3</span>}
      />
      <div className="progress-track">
        <span style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      {step === 1 && (
        <section className="panel">
          <h2>Monthly income</h2>
          <p className="muted">Use your take-home amount so savings rate and balances stay realistic.</p>
          <label className="field-label">
            Income
            <input value={income} onChange={(event) => setIncome(event.target.value)} type="number" min="0" />
          </label>
          <button className="primary-button" onClick={() => setStep(2)}>
            Continue
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="panel">
          <div className="section-head">
            <div>
              <h2>Budget goals</h2>
              <p className="muted">Set a monthly limit per category. You can change these anytime.</p>
            </div>
            <button className="text-button" onClick={() => setStep(3)}>
              Skip for now
            </button>
          </div>
          <div className="budget-grid compact-grid">
            {data.categories.map((category) => (
              <label key={category.id} className="budget-input-row">
                <CategoryBadge category={category} />
                <input
                  value={budgets[category.id] ?? 0}
                  min="0"
                  type="number"
                  onChange={(event) =>
                    setBudgets((current) => ({ ...current, [category.id]: Number(event.target.value) }))
                  }
                />
              </label>
            ))}
          </div>
          <button className="primary-button" onClick={() => setStep(3)}>
            Continue
          </button>
        </section>
      )}

      {step === 3 && (
        <section className="panel">
          <h2>Currency preference</h2>
          <div className="choice-grid">
            {(["INR", "USD"] as Currency[]).map((option) => (
              <button
                key={option}
                className={currency === option ? "choice active" : "choice"}
                onClick={() => setCurrency(option)}
              >
                <strong>{option}</strong>
                <span>{currencySymbol(option)}</span>
              </button>
            ))}
          </div>
          <button className="primary-button" onClick={() => finish()}>
            Finish setup
          </button>
          <button className="text-button center" onClick={() => finish(true)}>
            Finish without budget goals
          </button>
        </section>
      )}
    </main>
  );
}

function DashboardPage({ data }: { data: AppData }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const metrics = useFinanceMetrics(data, selectedMonth);
  const insights = buildInsights(data, selectedMonth);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Dashboard"
        title="Your money at a glance"
        action={<MonthSelector value={selectedMonth} onChange={setSelectedMonth} />}
      />

      {!data.profile.onboardingComplete && (
        <Link to="/onboarding" className="notice">
          Complete onboarding to personalize your income, budgets, and currency.
        </Link>
      )}

      <section className="summary-grid">
        <MetricCard label="Total income" value={money(data.profile.monthlyIncome, data.profile.currency)} />
        <MetricCard label="Total spent" value={money(metrics.totalSpent, data.profile.currency)} />
        <MetricCard label="Remaining balance" value={money(metrics.remaining, data.profile.currency)} />
        <MetricCard label="Savings rate" value={`${metrics.savingsRate}%`} />
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <SectionTitle title="Spending by category" />
          <DonutChart data={metrics.categorySpend} currency={data.profile.currency} />
        </div>
        <div className="panel">
          <SectionTitle title="Monthly spending trend" />
          <BarChart data={metrics.monthlyTrend} currency={data.profile.currency} />
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="panel">
          <SectionTitle title="Budget progress" />
          <div className="stack">
            {metrics.budgetProgress.map((item) => (
              <BudgetProgress key={item.category.id} item={item} currency={data.profile.currency} />
            ))}
          </div>
        </div>
        <div className="panel">
          <SectionTitle title="Monthly insights" />
          <div className="insight-list">
            {insights.map((insight) => (
              <p key={insight}>{insight}</p>
            ))}
          </div>
          <SectionTitle title="Recent transactions" />
          <TransactionList expenses={metrics.recentExpenses} categories={data.categories} currency={data.profile.currency} />
          <Link className="text-button" to="/expenses">
            View all
          </Link>
        </div>
      </section>
    </main>
  );
}

function ExpensesPage({
  data,
  setData,
}: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  const [month, setMonth] = useState(currentMonth());
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("date-desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => {
    const rows = data.expenses
      .filter((expense) => monthOf(expense.date) === month)
      .filter((expense) => categoryFilter === "all" || expense.categoryId === categoryFilter)
      .filter((expense) => expense.description.toLowerCase().includes(query.toLowerCase()));

    return [...rows].sort((left, right) => {
      if (sort === "amount-asc") return left.amount - right.amount;
      if (sort === "amount-desc") return right.amount - left.amount;
      return new Date(right.date).getTime() - new Date(left.date).getTime();
    });
  }, [categoryFilter, data.expenses, month, query, sort]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const recurring = detectRecurringExpenses(data.expenses, data.categories);

  function upsertExpense(expense: Expense) {
    setData((current) => {
      const exists = current.expenses.some((item) => item.id === expense.id);
      return {
        ...current,
        expenses: exists
          ? current.expenses.map((item) => (item.id === expense.id ? expense : item))
          : [expense, ...current.expenses],
      };
    });
    setShowForm(false);
    setEditingExpense(null);
  }

  function deleteExpenses(ids: string[]) {
    if (!window.confirm(`Delete ${ids.length} expense${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setData((current) => ({ ...current, expenses: current.expenses.filter((expense) => !ids.includes(expense.id)) }));
    setSelectedIds([]);
  }

  function exportCsv() {
    const csvRows = [
      "Date,Category,Description,Amount",
      ...filtered.map((expense) => {
        const category = getCategory(data.categories, expense.categoryId).name;
        return [expense.date, category, expense.description, expense.amount].map((value) => `"${value}"`).join(",");
      }),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `spendwise-expenses-${month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Expenses"
        title="Add, filter, and manage transactions"
        action={
          <div className="actions">
            <button className="secondary-button compact" onClick={exportCsv}>
              Export CSV
            </button>
            <button className="primary-button compact" onClick={() => setShowForm(true)}>
              Add expense
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="filter-bar">
          <MonthSelector value={month} onChange={setMonth} />
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes" />
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="date-desc">Newest first</option>
            <option value="amount-desc">Amount high to low</option>
            <option value="amount-asc">Amount low to high</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="bulk-bar">
            <span>{selectedIds.length} selected</span>
            <button className="danger-button compact" onClick={() => deleteExpenses(selectedIds)}>
              Bulk delete
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && visible.every((expense) => selectedIds.includes(expense.id))}
                    onChange={(event) =>
                      setSelectedIds(event.target.checked ? visible.map((expense) => expense.id) : [])
                    }
                  />
                </th>
                <th>Date</th>
                <th>Category</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((expense) => {
                const category = getCategory(data.categories, expense.categoryId);
                return (
                  <tr key={expense.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(expense.id)}
                        onChange={(event) =>
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, expense.id]
                              : current.filter((id) => id !== expense.id),
                          )
                        }
                      />
                    </td>
                    <td>{expense.date}</td>
                    <td>
                      <CategoryBadge category={category} />
                    </td>
                    <td>{expense.description || "No note"}</td>
                    <td>{money(expense.amount, data.profile.currency)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          onClick={() => {
                            setEditingExpense(expense);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button className="icon-button danger" onClick={() => deleteExpenses([expense.id])}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button className="secondary-button compact" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary-button compact"
            disabled={page === totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </section>

      <section className="panel">
        <SectionTitle title="Recurring expenses" />
        {recurring.length === 0 ? (
          <p className="muted">No recurring patterns found yet.</p>
        ) : (
          <div className="recurring-grid">
            {recurring.map((item) => (
              <div key={`${item.category.id}-${item.description}`} className="mini-card">
                <CategoryBadge category={item.category} />
                <strong>{item.description}</strong>
                <span>{item.count} months detected</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <ExpenseModal
          categories={data.categories}
          currency={data.profile.currency}
          expense={editingExpense}
          onClose={() => {
            setShowForm(false);
            setEditingExpense(null);
          }}
          onSave={upsertExpense}
        />
      )}
    </main>
  );
}

function BudgetsPage({
  data,
  setData,
}: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  const [month, setMonth] = useState(currentMonth());
  const metrics = useFinanceMetrics(data, month);
  const [editing, setEditing] = useState<Category | null>(null);
  const totalBudgeted = metrics.budgetProgress.reduce((sum, item) => sum + item.limit, 0);
  const overCount = metrics.budgetProgress.filter((item) => item.spent > item.limit && item.limit > 0).length;

  function saveBudget(categoryId: string, monthlyLimit: number) {
    setData((current) => ({
      ...current,
      budgets: upsertBudgets(current.budgets, current.categories, { [categoryId]: monthlyLimit }, month),
    }));
    setEditing(null);
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Budgets"
        title="Control category limits"
        action={<MonthSelector value={month} onChange={setMonth} />}
      />
      <section className="summary-grid">
        <MetricCard label="Total budgeted" value={money(totalBudgeted, data.profile.currency)} />
        <MetricCard label="Total spent" value={money(metrics.totalSpent, data.profile.currency)} />
        <MetricCard label="Budget used" value={`${totalBudgeted ? Math.round((metrics.totalSpent / totalBudgeted) * 100) : 0}%`} />
        <MetricCard label="Over budget" value={`${overCount} categories`} />
      </section>
      <section className="budget-grid">
        {metrics.budgetProgress.map((item) => (
          <button key={item.category.id} className="budget-card" onClick={() => setEditing(item.category)}>
            <div className="section-head">
              <CategoryBadge category={item.category} />
              <strong>{money(item.limit, data.profile.currency)}</strong>
            </div>
            <BudgetProgress item={item} currency={data.profile.currency} />
            <span className={item.remaining >= 0 ? "positive" : "negative"}>
              {item.remaining >= 0
                ? `${money(item.remaining, data.profile.currency)} remaining`
                : `${money(Math.abs(item.remaining), data.profile.currency)} over budget`}
            </span>
          </button>
        ))}
      </section>
      <section className="panel">
        <SectionTitle title="Budget history" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Budgeted</th>
                <th>Spent</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {buildBudgetHistory(data).map((row) => (
                <tr key={row.month}>
                  <td>{formatMonth(row.month)}</td>
                  <td>{money(row.budgeted, data.profile.currency)}</td>
                  <td>{money(row.spent, data.profile.currency)}</td>
                  <td className={row.budgeted - row.spent >= 0 ? "positive" : "negative"}>
                    {money(row.budgeted - row.spent, data.profile.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <BudgetModal
          category={editing}
          currentLimit={getBudget(data.budgets, editing.id, month)}
          currency={data.profile.currency}
          onClose={() => setEditing(null)}
          onSave={(value) => saveBudget(editing.id, value)}
        />
      )}
    </main>
  );
}

function ProfilePage({
  data,
  setData,
}: {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}) {
  const [displayName, setDisplayName] = useState(data.profile.displayName);
  const [monthlyIncome, setMonthlyIncome] = useState(String(data.profile.monthlyIncome));
  const [currency, setCurrency] = useState<Currency>(data.profile.currency);
  const [categoryName, setCategoryName] = useState("");
  const [categoryIcon, setCategoryIcon] = useState("CU");
  const [categoryColor, setCategoryColor] = useState("#0f766e");
  const [deleteText, setDeleteText] = useState("");
  const [message, setMessage] = useState("");

  async function saveProfile() {
    if (supabaseConfigured) {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
    }

    setData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        displayName: displayName.trim(),
        monthlyIncome: Number(monthlyIncome) || 0,
        currency,
      },
    }));
    setMessage("Profile saved.");
  }

  function addCategory() {
    if (!categoryName.trim()) return;
    setData((current) => ({
      ...current,
      categories: [
        ...current.categories,
        {
          id: uid("cat"),
          name: categoryName.trim(),
          icon: categoryIcon.trim().slice(0, 3).toUpperCase() || "CU",
          color: categoryColor,
          isDefault: false,
        },
      ],
    }));
    setCategoryName("");
  }

  function deleteCategory(categoryId: string) {
    setData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== categoryId),
      expenses: current.expenses.map((expense) =>
        expense.categoryId === categoryId ? { ...expense, categoryId: "others" } : expense,
      ),
      budgets: current.budgets.filter((budget) => budget.categoryId !== categoryId),
    }));
  }

  async function resetPassword() {
    if (supabaseConfigured) {
      if (!data.profile.email.includes("@")) {
        setMessage("No account email found. Login again, then request a reset.");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(data.profile.email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      setMessage(error ? error.message : "Password reset email sent.");
      return;
    }
    setMessage("Demo mode: password reset will send after Supabase is configured.");
  }

  function deleteAccount() {
    if (deleteText !== "DELETE") {
      setMessage("Type DELETE to confirm account deletion.");
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    setData(cloneDefaultData());
    setMessage("Demo data reset. Supabase auth deletion should be handled with a secure server function.");
  }

  return (
    <main className="page">
      <PageHeader eyebrow="Profile" title="Settings and category management" />
      <section className="dashboard-grid">
        <div className="panel">
          <SectionTitle title="Personal info" />
          <div className="avatar-row">
            <div className="avatar">{displayName.slice(0, 2).toUpperCase() || "SW"}</div>
            <div>
              <strong>{data.profile.email}</strong>
              <p className="muted">Email is managed by Supabase Auth.</p>
            </div>
          </div>
          <div className="form-stack">
            <label>
              Display name
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
            </label>
            <label>
              Monthly income
              <input value={monthlyIncome} onChange={(event) => setMonthlyIncome(event.target.value)} type="number" />
            </label>
            <label>
              Currency
              <select value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </label>
            <button className="primary-button" onClick={saveProfile}>
              Save profile
            </button>
          </div>
        </div>

        <div className="panel">
          <SectionTitle title="Account actions" />
          <button className="secondary-button" onClick={resetPassword}>
            Send password reset
          </button>
          <div className="danger-zone">
            <strong>Delete account</strong>
            <p className="muted">This resets local demo data. Production auth deletion needs a secure server function.</p>
            <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="Type DELETE" />
            <button className="danger-button" onClick={deleteAccount}>
              Delete account
            </button>
          </div>
          {message && <p className="form-message">{message}</p>}
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <SectionTitle title="Categories" />
          <div className="inline-form">
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Category name" />
            <input value={categoryIcon} onChange={(event) => setCategoryIcon(event.target.value)} placeholder="Icon" />
            <input type="color" value={categoryColor} onChange={(event) => setCategoryColor(event.target.value)} />
            <button className="primary-button compact" onClick={addCategory}>
              Add
            </button>
          </div>
        </div>
        <div className="category-grid">
          {data.categories.map((category) => (
            <div key={category.id} className="category-row">
              <CategoryBadge category={category} />
              <span>{category.isDefault ? "Default" : "Custom"}</span>
              {!category.isDefault && (
                <button className="icon-button danger" onClick={() => deleteCategory(category.id)}>
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="section-title">{title}</h2>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MonthSelector({ value, onChange }: { value: string; onChange: (month: string) => void }) {
  function shift(delta: number) {
    const [year, month] = value.split("-").map(Number);
    const next = new Date(year, month - 1 + delta, 1);
    onChange(next.toISOString().slice(0, 7));
  }

  return (
    <div className="month-selector">
      <button onClick={() => shift(-1)} aria-label="Previous month">
        &lt;
      </button>
      <input value={value} onChange={(event) => onChange(event.target.value)} type="month" />
      <button onClick={() => shift(1)} aria-label="Next month">
        &gt;
      </button>
    </div>
  );
}

function CategoryBadge({ category }: { category: Category }) {
  return (
    <span className="category-badge">
      <span style={{ background: category.color }}>{category.icon}</span>
      {category.name}
    </span>
  );
}

function BudgetProgress({
  item,
  currency,
}: {
  item: { category: Category; spent: number; limit: number; remaining: number; percent: number };
  currency: Currency;
}) {
  const status = item.percent > 90 ? "danger" : item.percent >= 70 ? "warning" : "good";

  return (
    <div className="budget-progress">
      <div className="section-head tight">
        <CategoryBadge category={item.category} />
        <span>
          {money(item.spent, currency)} / {money(item.limit, currency)}
        </span>
      </div>
      <div className="bar-track">
        <span className={status} style={{ width: `${Math.min(item.percent, 100)}%` }} />
      </div>
      {item.limit > 0 && item.spent > item.limit && <span className="over-badge">Over budget</span>}
    </div>
  );
}

function DonutChart({
  data,
  currency,
}: {
  data: { category: Category; amount: number; percent: number }[];
  currency: Currency;
}) {
  const segments = data
    .filter((item) => item.amount > 0)
    .reduce<{ nodes: React.ReactNode[]; offset: number }>(
      (accumulator, item) => {
      const dash = `${item.percent} ${100 - item.percent}`;
        accumulator.nodes.push(
        <circle
          key={item.category.id}
          r="15.9"
          cx="18"
          cy="18"
          fill="transparent"
          stroke={item.category.color}
          strokeWidth="7"
          strokeDasharray={dash}
            strokeDashoffset={accumulator.offset}
          />,
        );
        return { nodes: accumulator.nodes, offset: accumulator.offset - item.percent };
      },
      { nodes: [], offset: 25 },
    ).nodes;

  return (
    <div className="donut-layout">
      <svg viewBox="0 0 36 36" className="donut" aria-label="Spending by category chart">
        <circle r="15.9" cx="18" cy="18" fill="transparent" stroke="#e2e8f0" strokeWidth="7" />
        {segments}
      </svg>
      <div className="legend-list">
        {data.map((item) => (
          <div key={item.category.id}>
            <span style={{ background: item.category.color }} />
            <strong>{item.category.name}</strong>
            <em>
              {money(item.amount, currency)} ({item.percent}%)
            </em>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({
  data,
  currency,
}: {
  data: { month: string; amount: number }[];
  currency: Currency;
}) {
  const maxAmount = Math.max(...data.map((item) => item.amount), 1);

  return (
    <div className="bar-chart">
      {data.map((item) => (
        <div key={item.month} title={`${formatMonth(item.month)} - ${money(item.amount, currency)}`}>
          <span style={{ height: `${(item.amount / maxAmount) * 100}%` }} />
          <strong>{formatMonth(item.month).split(" ")[0]}</strong>
        </div>
      ))}
    </div>
  );
}

function TransactionList({
  expenses,
  categories,
  currency,
}: {
  expenses: Expense[];
  categories: Category[];
  currency: Currency;
}) {
  return (
    <div className="transaction-list">
      {expenses.length === 0 ? (
        <p className="muted">No transactions for this month.</p>
      ) : (
        expenses.map((expense) => (
          <div key={expense.id}>
            <CategoryBadge category={getCategory(categories, expense.categoryId)} />
            <span>{expense.description}</span>
            <strong>{money(expense.amount, currency)}</strong>
          </div>
        ))
      )}
    </div>
  );
}

function ExpenseModal({
  categories,
  currency,
  expense,
  onClose,
  onSave,
}: {
  categories: Category[];
  currency: Currency;
  expense: Expense | null;
  onClose: () => void;
  onSave: (expense: Expense) => void;
}) {
  const [amount, setAmount] = useState(String(expense?.amount ?? ""));
  const [categoryId, setCategoryId] = useState(expense?.categoryId ?? categories[0]?.id ?? "");
  const [date, setDate] = useState(expense?.date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(expense?.description ?? "");
  const [isRecurring, setIsRecurring] = useState(expense?.isRecurring ?? false);
  const [error, setError] = useState("");

  function save(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (numericAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!categoryId) {
      setError("Category required");
      return;
    }
    onSave({
      id: expense?.id ?? uid("expense"),
      amount: numericAmount,
      categoryId,
      date,
      description,
      isRecurring,
    });
  }

  return (
    <div className="modal-backdrop">
      <form className="modal-card form-stack" onSubmit={save}>
        <div className="section-head">
          <h2>{expense ? "Edit expense" : "Add expense"}</h2>
          <button type="button" className="icon-button" onClick={onClose}>
            Close
          </button>
        </div>
        <label>
          Amount ({currencySymbol(currency)})
          <input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" />
        </label>
        <label>
          Category
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input value={date} onChange={(event) => setDate(event.target.value)} type="date" />
        </label>
        <label>
          Description
          <input value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="check-row">
          <input checked={isRecurring} onChange={(event) => setIsRecurring(event.target.checked)} type="checkbox" />
          Is recurring?
        </label>
        {error && <p className="form-message">{error}</p>}
        <button className="primary-button">{expense ? "Save changes" : "Add expense"}</button>
      </form>
    </div>
  );
}

function BudgetModal({
  category,
  currentLimit,
  currency,
  onClose,
  onSave,
}: {
  category: Category;
  currentLimit: number;
  currency: Currency;
  onClose: () => void;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(String(currentLimit));

  return (
    <div className="modal-backdrop">
      <div className="modal-card form-stack">
        <div className="section-head">
          <h2>Edit budget</h2>
          <button className="icon-button" onClick={onClose}>
            Close
          </button>
        </div>
        <CategoryBadge category={category} />
        <label>
          Monthly limit ({currencySymbol(currency)})
          <input value={value} onChange={(event) => setValue(event.target.value)} type="number" min="0" />
        </label>
        <button className="primary-button" onClick={() => onSave(Number(value) || 0)}>
          Save budget
        </button>
      </div>
    </div>
  );
}

function useFinanceMetrics(data: AppData, selectedMonth: string) {
  return useMemo(() => {
    const monthExpenses = data.expenses.filter((expense) => monthOf(expense.date) === selectedMonth);
    const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const remaining = data.profile.monthlyIncome - totalSpent;
    const savingsRate = data.profile.monthlyIncome
      ? Math.max(0, Math.round((remaining / data.profile.monthlyIncome) * 100))
      : 0;

    const categorySpend = data.categories.map((category) => {
      const amount = monthExpenses
        .filter((expense) => expense.categoryId === category.id)
        .reduce((sum, expense) => sum + expense.amount, 0);
      return {
        category,
        amount,
        percent: totalSpent ? Math.round((amount / totalSpent) * 100) : 0,
      };
    });

    const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
      const anchor = new Date(`${selectedMonth}-01`);
      anchor.setMonth(anchor.getMonth() - (5 - index));
      const month = anchor.toISOString().slice(0, 7);
      return {
        month,
        amount: data.expenses
          .filter((expense) => monthOf(expense.date) === month)
          .reduce((sum, expense) => sum + expense.amount, 0),
      };
    });

    const budgetProgress = data.categories.map((category) => {
      const spent = categorySpend.find((item) => item.category.id === category.id)?.amount ?? 0;
      const limit = getBudget(data.budgets, category.id, selectedMonth);
      return {
        category,
        spent,
        limit,
        remaining: limit - spent,
        percent: limit ? Math.round((spent / limit) * 100) : 0,
      };
    });

    const recentExpenses = [...monthExpenses]
      .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
      .slice(0, 5);

    return { totalSpent, remaining, savingsRate, categorySpend, monthlyTrend, budgetProgress, recentExpenses };
  }, [data, selectedMonth]);
}

function getBudget(budgets: Budget[], categoryId: string, month: string) {
  const exact = budgets.find((budget) => budget.categoryId === categoryId && budget.month === month);
  const latest = [...budgets].reverse().find((budget) => budget.categoryId === categoryId);
  return exact?.monthlyLimit ?? latest?.monthlyLimit ?? 0;
}

function upsertBudgets(
  existing: Budget[],
  categories: Category[],
  changes: Record<string, number>,
  month: string,
) {
  const next = [...existing];
  categories.forEach((category) => {
    if (!(category.id in changes)) return;
    const index = next.findIndex((budget) => budget.categoryId === category.id && budget.month === month);
    const monthlyLimit = Number(changes[category.id]) || 0;
    if (monthlyLimit <= 0) {
      if (index >= 0) next.splice(index, 1);
      return;
    }
    const budget = { categoryId: category.id, month, monthlyLimit };
    if (index >= 0) next[index] = budget;
    else next.push(budget);
  });
  return next;
}

function buildInsights(data: AppData, selectedMonth: string) {
  const metrics = calculateSimpleMetrics(data, selectedMonth);
  const previousMonthDate = new Date(`${selectedMonth}-01`);
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = previousMonthDate.toISOString().slice(0, 7);
  const previous = calculateSimpleMetrics(data, previousMonth);
  const biggest = metrics.categorySpend.sort((left, right) => right.amount - left.amount)[0];
  const overBudget = metrics.budgetProgress.filter((item) => item.limit > 0 && item.spent <= item.limit).length;
  const recurring = detectRecurringExpenses(data.expenses, data.categories).length;
  const foodNow = metrics.categorySpend.find((item) => item.category.id === "food")?.amount ?? 0;
  const foodBefore = previous.categorySpend.find((item) => item.category.id === "food")?.amount ?? 0;
  const foodDelta = foodBefore ? Math.round(((foodNow - foodBefore) / foodBefore) * 100) : 0;

  return [
    foodDelta >= 0
      ? `Food spending is ${foodDelta}% higher than last month.`
      : `Food spending is ${Math.abs(foodDelta)}% lower than last month.`,
    `You stayed within budget in ${overBudget}/${data.categories.length} categories this month.`,
    biggest ? `Your biggest category is ${biggest.category.name} at ${money(biggest.amount, data.profile.currency)}.` : "No expenses logged yet.",
    `${recurring} recurring expense pattern${recurring === 1 ? "" : "s"} detected.`,
  ];
}

function calculateSimpleMetrics(data: AppData, selectedMonth: string) {
  const monthExpenses = data.expenses.filter((expense) => monthOf(expense.date) === selectedMonth);
  const categorySpend = data.categories.map((category) => ({
    category,
    amount: monthExpenses
      .filter((expense) => expense.categoryId === category.id)
      .reduce((sum, expense) => sum + expense.amount, 0),
  }));
  const budgetProgress = data.categories.map((category) => {
    const spent = categorySpend.find((item) => item.category.id === category.id)?.amount ?? 0;
    const limit = getBudget(data.budgets, category.id, selectedMonth);
    return { category, spent, limit };
  });
  return { categorySpend, budgetProgress };
}

function detectRecurringExpenses(expenses: Expense[], categories: Category[]) {
  const groups = new Map<string, { description: string; category: Category; months: Set<string> }>();
  expenses.forEach((expense) => {
    const key = `${expense.categoryId}-${expense.description.toLowerCase()}`;
    const existing = groups.get(key) ?? {
      description: expense.description,
      category: getCategory(categories, expense.categoryId),
      months: new Set<string>(),
    };
    existing.months.add(monthOf(expense.date));
    groups.set(key, existing);
  });
  return [...groups.values()]
    .filter((group) => group.months.size >= 2)
    .map((group) => ({ description: group.description, category: group.category, count: group.months.size }));
}

function buildBudgetHistory(data: AppData) {
  const months = [...new Set([...data.expenses.map((expense) => monthOf(expense.date)), ...data.budgets.map((budget) => budget.month)])]
    .sort()
    .reverse()
    .slice(0, 6);

  return months.map((month) => ({
    month,
    budgeted: data.categories.reduce((sum, category) => sum + getBudget(data.budgets, category.id, month), 0),
    spent: data.expenses
      .filter((expense) => monthOf(expense.date) === month)
      .reduce((sum, expense) => sum + expense.amount, 0),
  }));
}

export default App;
