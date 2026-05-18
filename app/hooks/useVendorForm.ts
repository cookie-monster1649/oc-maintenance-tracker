import { useState, useCallback } from "react";

// ── Types ––
export interface VendorFormData {
  name: string;
  service_type: string;
  paperless_correspondent_id?: number | null;
}

const getInitialState = (): Omit<VendorFormData, "paperless_correspondent_id"> => ({
  name: "",
  service_type: "",
});

export function useVendorForm(onSuccess?: () => void) {
  // ── State ––
  const [form, setForm] = useState<Omit<VendorFormData, "paperless_correspondent_id">>(
    getInitialState()
  );
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // ── Handlers ––
  const reset = useCallback(() => {
    setForm(getInitialState());
    setError("");
  }, []);

  const updateForm = useCallback(
    (updates: Partial<Omit<VendorFormData, "paperless_correspondent_id">>) => {
      setForm((prev) => ({ ...prev, ...updates }));
      setError("");
    },
    []
  );

  const isValid = useCallback(() => {
    return form.name.trim();
  }, [form]);

  const submit = useCallback(
    async (correspondentId?: number | null, endpoint: string = "/api/vendors") => {
      if (!isValid()) {
        setError("Vendor name is required");
        return false;
      }

      setIsLoading(true);
      setError("");

      try {
        const payload: VendorFormData = {
          ...form,
          ...(correspondentId !== undefined && {
            paperless_correspondent_id: correspondentId,
          }),
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
    setForm,
    updateForm,
    error,
    isLoading,
    isValid: isValid(),
    submit,
    reset,
  };
}
