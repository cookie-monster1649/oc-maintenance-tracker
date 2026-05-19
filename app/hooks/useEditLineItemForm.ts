import { useState, useCallback } from "react";
import type { LineItem } from "@/lib/line-items";

interface EditLineItemFormState {
  title: string;
  description: string;
  category: string;
  vendor_id: string | null;
  fy_budget: string | null;
  fy: number;
}

export function useEditLineItemForm(lineItemId: string, onSuccess: () => void) {
  const [form, setForm] = useState<EditLineItemFormState | null>(null);
  const [originalForm, setOriginalForm] = useState<EditLineItemFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isValid = () => form && Boolean(form.title && form.category);

  const updateForm = (updates: Partial<EditLineItemFormState>) => {
    setForm((f) => (f ? { ...f, ...updates } : null));
  };

  const initializeForm = useCallback((lineItem: LineItem) => {
    const initial: EditLineItemFormState = {
      title: lineItem.title,
      description: lineItem.description,
      category: lineItem.category,
      vendor_id: lineItem.vendor_id,
      fy_budget: lineItem.fy_budget ? String(lineItem.fy_budget) : null,
      fy: lineItem.fy,
    };
    setForm(initial);
    setOriginalForm(initial);
  }, []);

  const hasChanges = () => {
    if (!form || !originalForm) return false;
    return JSON.stringify(form) !== JSON.stringify(originalForm);
  };

  const submit = async () => {
    if (!isValid() || !form) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/line-items/${lineItemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          vendor_id: form.vendor_id,
          fy_budget: form.fy_budget ? Number(form.fy_budget) : null,
          fy: form.fy,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update line item");
      }

      setForm(null);
      setOriginalForm(null);
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error updating line item");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setForm(originalForm);
  };

  return {
    form,
    originalForm,
    updateForm,
    setForm,
    initializeForm,
    submit,
    reset,
    hasChanges: hasChanges(),
    error,
    isLoading,
    isValid: isValid(),
  };
}
