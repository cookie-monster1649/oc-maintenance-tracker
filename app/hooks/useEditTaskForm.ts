import { useState, useCallback } from "react";

// ── Types ──
export interface EditFormData {
  title?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  frequency?: string;
  estimated_cost?: number | string;
  category?: string;
  vendor_id?: string;
}

export function useEditTaskForm(onSuccess?: () => void) {
  // ── State ––
  const [form, setForm] = useState<EditFormData>({});
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Handlers ––
  const reset = useCallback(() => {
    setForm({});
    setError("");
  }, []);

  const updateForm = useCallback((updates: EditFormData) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setError("");
  }, []);

  const submit = useCallback(
    async (taskId: string) => {
      setIsLoading(true);
      setError("");

      try {
        const payload = {
          title: form.title,
          description: form.description,
          start_date: form.start_date,
          end_date: form.end_date || null,
          frequency: form.frequency || null,
          estimated_cost: form.estimated_cost
            ? parseFloat(String(form.estimated_cost))
            : null,
          category: form.category,
          vendor_id: form.vendor_id || null,
        };

        const res = await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
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
    [form, reset, onSuccess]
  );

  // ── Return ––
  return {
    form,
    setForm,
    updateForm,
    error,
    isLoading,
    submit,
    reset,
  };
}
