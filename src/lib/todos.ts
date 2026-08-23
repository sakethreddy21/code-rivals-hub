export type TodoEntry = {
  date: string;
  heading: string;
  subheading: string;
  body: string;
  bulletPoints: string[];
  updatedAt: string;
};

const storageKey = (accountId: string) => `code-rivals-todos:${accountId}`;

export function loadTodos(accountId: string): Record<string, TodoEntry> {
  try {
    const stored = localStorage.getItem(storageKey(accountId));
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, TodoEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveTodos(accountId: string, todos: Record<string, TodoEntry>) {
  localStorage.setItem(storageKey(accountId), JSON.stringify(todos));
}

export function todayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export function emptyTodo(date: string): TodoEntry {
  return { date, heading: "", subheading: "", body: "", bulletPoints: [], updatedAt: "" };
}