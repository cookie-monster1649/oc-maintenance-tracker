import { useState } from "react";

export interface Document {
  id: number;
  title: string;
  created?: string;
  url: string;
  document_type_label: string | null;
  correspondent?: number | null;
}

export interface Task {
  id: string;
  series_id: string;
  title: string;
  description: string;
  frequency: string;
  category: string;
  start_date: string;
  status: string;
  vendor_id: string | null;
  estimated_cost: number | null;
  archived?: boolean;
  last_completed_date: string | null;
}

export interface NewTaskForm {
  title: string;
  description?: string;
  category: string;
  start_date: string;
  frequency: string;
  vendor_id?: string;
  estimated_cost?: string;
}

export interface UseDocumentMatchingConfig {
  tasks: Task[];
  vendors?: Array<{ id: string; name: string }>;
  defaultVendorId?: string;
  onSuccess: () => void | Promise<void>;
}

export function useDocumentMatching(config: UseDocumentMatchingConfig) {
  const [matchingDoc, setMatchingDoc] = useState<Document | null>(null);
  const [selectedSeriesId, setSelectedSeriesId] = useState("");
  const [selectedSeriesTitle, setSelectedSeriesTitle] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [createAsOccurrence, setCreateAsOccurrence] = useState(false);
  const [occurrenceDate, setOccurrenceDate] = useState("");
  const [confirmedDate, setConfirmedDate] = useState("");
  const [newTaskForm, setNewTaskForm] = useState<NewTaskForm>({
    title: "",
    description: "",
    category: "",
    start_date: "",
    frequency: "",
    vendor_id: config.defaultVendorId || "",
    estimated_cost: "",
  });
  const [successInfo, setSuccessInfo] = useState<{
    title: string;
    docUrl: string;
    taskId?: string;
  } | null>(null);
  const [pendingSmartAction, setPendingSmartAction] = useState<{
    doc: Document;
    taskId: string;
    taskTitle: string;
    confirmDate: string;
  } | null>(null);

  const resetMatchingState = () => {
    setMatchingDoc(null);
    setSelectedSeriesId("");
    setSelectedSeriesTitle("");
    setSelectedTaskId("");
    setCreateAsOccurrence(false);
    setOccurrenceDate("");
    setConfirmedDate("");
    setNewTaskForm({
      title: "",
      description: "",
      category: "",
      start_date: "",
      frequency: "",
      vendor_id: config.defaultVendorId || "",
      estimated_cost: "",
    });
  };

  async function handleManualMatch() {
    if (!matchingDoc) return;
    if (!createAsOccurrence && !selectedTaskId) return;

    try {
      let taskId = selectedTaskId;

      if (createAsOccurrence && occurrenceDate) {
        const templateTask = config.tasks.find((t) => t.series_id === selectedSeriesId);
        if (!templateTask) return;

        const newTaskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: templateTask.title,
            description: templateTask.description,
            frequency: templateTask.frequency,
            category: templateTask.category,
            start_date: occurrenceDate,
            status: "Completed",
            last_completed_date: occurrenceDate,
            estimated_cost: templateTask.estimated_cost,
            vendor_id: templateTask.vendor_id,
            series_id: templateTask.series_id,
            no_extrapolate: true,
          }),
        });

        if (!newTaskRes.ok) throw new Error("Failed to create occurrence");
        const newTask = await newTaskRes.json();
        taskId = newTask.id;
      }

      const originalTask = config.tasks.find((t) => t.id === taskId);
      if (!createAsOccurrence && confirmedDate && originalTask && confirmedDate !== originalTask.start_date) {
        await fetch(`/api/tasks/${taskId}/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_date: confirmedDate }),
        });
      }

      const res = await fetch(`/api/tasks/${taskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });

      if (res.ok) {
        setMatchingDoc(null);
        setSelectedTaskId("");
        setSelectedSeriesId("");
        setSelectedSeriesTitle("");
        setCreateAsOccurrence(false);
        setOccurrenceDate("");
        setConfirmedDate("");
        await config.onSuccess();
      }
    } catch (err) {
      console.error("Manual match failed", err);
    }
  }

  async function handleSmartAction(doc: Document, action: { type: string; taskId: string; taskTitle: string }) {
    if (action.type === "COMPLETE_SCHEDULED") {
      const confirmDate = doc.created ? doc.created.split("T")[0] : new Date().toISOString().split("T")[0];
      setPendingSmartAction({
        doc,
        taskId: action.taskId,
        taskTitle: action.taskTitle,
        confirmDate,
      });
    } else {
      try {
        const res = await fetch(`/api/tasks/${action.taskId}/documents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: doc }),
        });

        if (res.ok) {
          setSuccessInfo({ title: action.taskTitle, docUrl: doc.url, taskId: action.taskId });
          await config.onSuccess();
        }
      } catch (err) {
        console.error("Smart action failed", err);
      }
    }
  }

  async function confirmSmartAction() {
    if (!pendingSmartAction) return;
    try {
      const { doc, taskId, confirmDate } = pendingSmartAction;
      const originalTask = config.tasks.find((t) => t.id === taskId);

      if (originalTask && confirmDate !== originalTask.start_date) {
        await fetch(`/api/tasks/${taskId}/reschedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ new_date: confirmDate }),
        });
      }

      await fetch(`/api/tasks/${taskId}/complete`, { method: "POST" });

      const res = await fetch(`/api/tasks/${taskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: doc }),
      });

      if (res.ok) {
        setSuccessInfo({ title: pendingSmartAction.taskTitle, docUrl: doc.url, taskId });
        setPendingSmartAction(null);
        await config.onSuccess();
      }
    } catch (err) {
      console.error("Smart action confirmation failed", err);
    }
  }

  async function handleManualMatchAndComplete() {
    if (!matchingDoc) return;

    try {
      let taskId: string;

      if (selectedTaskId) {
        // Existing task selected — reschedule if either date field was set, then complete
        taskId = selectedTaskId;
        const dateToUse = confirmedDate || occurrenceDate;
        const originalTask = config.tasks.find((t) => t.id === selectedTaskId);
        if (dateToUse && originalTask && dateToUse !== originalTask.start_date) {
          await fetch(`/api/tasks/${taskId}/reschedule`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ new_date: dateToUse }),
          });
        }
        await fetch(`/api/tasks/${taskId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ no_extrapolate: true }),
        });
      } else if (createAsOccurrence && occurrenceDate) {
        // No specific task selected — create a new completed occurrence
        const templateTask = config.tasks.find((t) => t.series_id === selectedSeriesId);
        if (!templateTask) return;

        const newTaskRes = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: templateTask.title,
            description: templateTask.description,
            frequency: templateTask.frequency,
            category: templateTask.category,
            start_date: occurrenceDate,
            status: "Completed",
            last_completed_date: occurrenceDate,
            estimated_cost: templateTask.estimated_cost,
            vendor_id: templateTask.vendor_id,
            series_id: templateTask.series_id,
            no_extrapolate: true,
          }),
        });

        if (!newTaskRes.ok) throw new Error("Failed to create occurrence");
        const newTask = await newTaskRes.json();
        taskId = newTask.id;
      } else {
        return;
      }

      const res = await fetch(`/api/tasks/${taskId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });

      if (res.ok) {
        setMatchingDoc(null);
        setSelectedTaskId("");
        setSelectedSeriesId("");
        setSelectedSeriesTitle("");
        setCreateAsOccurrence(false);
        setOccurrenceDate("");
        setConfirmedDate("");
        await config.onSuccess();
      }
    } catch (err) {
      console.error("Manual match and complete failed", err);
    }
  }

  async function handleCreateAndMatch(complete?: boolean) {
    if (!matchingDoc || !newTaskForm.title || !newTaskForm.category || !newTaskForm.start_date) return;
    try {
      const taskBody: Record<string, unknown> = {
        title: newTaskForm.title,
        description: newTaskForm.description || "",
        category: newTaskForm.category,
        start_date: newTaskForm.start_date,
        frequency: newTaskForm.frequency || "Monthly",
        ...(complete && {
          status: "Completed",
          last_completed_date: newTaskForm.start_date,
        }),
      };

      if (newTaskForm.vendor_id || config.defaultVendorId) {
        taskBody.vendor_id = newTaskForm.vendor_id || config.defaultVendorId;
      }
      if (newTaskForm.estimated_cost) {
        taskBody.estimated_cost = Number(newTaskForm.estimated_cost);
      }

      const taskRes = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskBody),
      });

      if (!taskRes.ok) throw new Error("Failed to create task");
      const newTaskData = await taskRes.json();

      const linkRes = await fetch(`/api/tasks/${newTaskData.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document: matchingDoc }),
      });

      if (linkRes.ok) {
        setMatchingDoc(null);
        setSelectedSeriesId("");
        setSelectedSeriesTitle("");
        setSelectedTaskId("");
        setSuccessInfo({ title: newTaskForm.title, docUrl: matchingDoc.url, taskId: newTaskData.id });
        setNewTaskForm({
          title: "",
          description: "",
          category: "",
          start_date: "",
          frequency: "",
          vendor_id: config.defaultVendorId || "",
          estimated_cost: "",
        });
        await config.onSuccess();
      }
    } catch (err) {
      console.error("Create and match failed", err);
    }
  }

  return {
    matchingDoc,
    setMatchingDoc,
    selectedSeriesId,
    setSelectedSeriesId,
    selectedSeriesTitle,
    setSelectedSeriesTitle,
    selectedTaskId,
    setSelectedTaskId,
    createAsOccurrence,
    setCreateAsOccurrence,
    occurrenceDate,
    setOccurrenceDate,
    confirmedDate,
    setConfirmedDate,
    newTaskForm,
    setNewTaskForm,
    successInfo,
    setSuccessInfo,
    pendingSmartAction,
    setPendingSmartAction,
    handleManualMatch,
    handleManualMatchAndComplete,
    handleSmartAction,
    confirmSmartAction,
    handleCreateAndMatch,
    resetMatchingState,
  };
}
