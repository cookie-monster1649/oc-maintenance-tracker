import { useState, useCallback } from "react";

// ── Types ──
interface NewTaskFormState {
  title: string;
  description: string;
  task_type: "budget_item" | "once_off" | "recurring";
  frequency: string;
  start_date: string;
  budget_ocy: number;
  estimated_cost: string;
  vendor_id: string;
  category: string;
}

// ── Utilities ––
const getDefaultOCYear = () => {
  const now = new Date();
  // OC Year starts in April (month 3). If current month >= April, next OC year is current year + 1.
  return now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
};

const getInitialState = (): NewTaskFormState => ({
  title: "",
  description: "",
  task_type: "recurring",
  frequency: "Monthly",
  start_date: "",
  budget_ocy: getDefaultOCYear(),
  estimated_cost: "",
  vendor_id: "",
  category: "",
});

export function useNewTaskForm(onSuccess?: () => void) {
  // ── State ––
  const [form, setForm] = useState<NewTaskFormState>(getInitialState());
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Handlers ––
  const reset = useCallback(() => {
    setForm(getInitialState());
    setError("");
  }, []);

  const updateForm = useCallback((updates: Partial<NewTaskFormState>) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setError("");
  }, []);

  const isValid = useCallback(() => {
    return (
      form.title.trim() &&
      form.category &&
      (form.task_type === "budget_item" || form.start_date)
    );
  }, [form]);

  const submit = useCallback(
    async (endpoint: string = "/api/tasks") => {
      if (!isValid()) {
        setError("Missing required fields");
        return false;
      }

      setIsLoading(true);
      setError("");

      try {
        const start_date =
          form.task_type === "budget_item"
            ? `${form.budget_ocy - 1}-04-01`
            : form.start_date;

        const payload = {
          ...form,
          start_date,
          frequency: form.task_type === "recurring" ? form.frequency : null,
          estimated_cost: form.estimated_cost || null,
          vendor_id: form.vendor_id || null,
          no_extrapolate: form.task_type !== "recurring",
        };

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text();
          setError(`Failed: ${res.status} ${text}`);
          return false;
        }

        reset();
        onSuccess?.();
        return true;
      } catch (err) {
        setError(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [form, isValid, reset, onSuccess]
  );

  // ── Return ––
  return {
    form,
    updateForm,
    setForm,
    error,
    isLoading,
    isValid: isValid(),
    submit,
    reset,
  };
}
