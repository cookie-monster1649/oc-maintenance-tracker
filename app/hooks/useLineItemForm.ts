import { useState } from "react";

interface LineItemFormState {
  title: string;
  description: string;
  category: string;
  vendor_id: string;
  fy_budget: string;
  fy: number;
}

function getCurrentFY(): number {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}

export function useLineItemForm(onSuccess: () => void) {
  const getInitialState = (): LineItemFormState => ({
    title: "",
    description: "",
    category: "",
    vendor_id: "",
    fy_budget: "",
    fy: getCurrentFY(),
  });

  const [form, setForm] = useState<LineItemFormState>(getInitialState());
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = () => Boolean(form.title && form.category);

  const updateForm = (updates: Partial<LineItemFormState>) => {
    setForm((f) => ({ ...f, ...updates }));
  };

  const submit = async () => {
    if (!isValid()) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/line-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || "",
          category: form.category,
          vendor_id: form.vendor_id || null,
          fy_budget: form.fy_budget ? Number(form.fy_budget) : null,
          fy: form.fy,
          archived: false,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to create line item: ${res.status} ${errorText}`);
      }

      await res.json();
      setForm(getInitialState());
      onSuccess();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Error creating line item";
      console.error("[useLineItemForm] Error:", errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => setForm(getInitialState());

  return {
    form,
    updateForm,
    setForm,
    submit,
    reset,
    error,
    isLoading,
    isValid: isValid(),
  };
}
