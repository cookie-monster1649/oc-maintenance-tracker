"use client";

import { format, parseISO } from "date-fns";
import { Document, Task, NewTaskForm } from "./useDocumentMatching";

interface NewVendorForm {
  name: string;
  service_type: string;
}

interface MatchDocumentModalProps {
  doc: Document;
  tasks: Task[];
  vendors?: Array<{ id: string; name: string; service_type: string }>;
  categories: string[];
  defaultVendorId?: string;

  // State from useDocumentMatching
  selectedSeriesId: string;
  setSelectedSeriesId: (v: string) => void;
  selectedSeriesTitle: string;
  setSelectedSeriesTitle: (v: string) => void;
  selectedTaskId: string;
  setSelectedTaskId: (v: string) => void;
  createAsOccurrence: boolean;
  setCreateAsOccurrence: (v: boolean) => void;
  occurrenceDate: string;
  setOccurrenceDate: (v: string) => void;
  confirmedDate: string;
  setConfirmedDate: (v: string) => void;
  newTaskForm: NewTaskForm;
  setNewTaskForm: (v: NewTaskForm) => void;

  onManualMatch: () => void;
  onManualMatchAndComplete: () => void;
  onCreateAndMatch: () => void;
  onCreateAndMatchComplete: () => void;
  onClose: () => void;

  // Vendor creation (documents page only — omit on vendors page)
  isCreatingVendor?: boolean;
  setIsCreatingVendor?: (v: boolean) => void;
  newVendorForm?: NewVendorForm;
  setNewVendorForm?: (v: NewVendorForm) => void;
  onCreateVendor?: () => void;
  vendorError?: string;
}

export function MatchDocumentModal({
  doc,
  tasks,
  vendors,
  categories,
  defaultVendorId,
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
  onManualMatch,
  onManualMatchAndComplete,
  onCreateAndMatch,
  onCreateAndMatchComplete,
  onClose,
  isCreatingVendor = false,
  setIsCreatingVendor,
  newVendorForm,
  setNewVendorForm,
  onCreateVendor,
  vendorError,
}: MatchDocumentModalProps) {
  // Get series and recurrences for matching
  const latestBySeries = tasks.reduce(
    (acc, t) => {
      if (!acc[t.series_id] || (t.start_date || "") > (acc[t.series_id].start_date || "")) {
        acc[t.series_id] = t;
      }
      return acc;
    },
    {} as Record<string, Task>,
  );

  const distinctSeries = Object.entries(latestBySeries)
    .filter(([, t]) => t.archived !== true)
    .map(([seriesId, latestTask]) => ({ seriesId, title: latestTask.title }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const recurrences = selectedSeriesId
    ? tasks
        .filter((t) => t.series_id === selectedSeriesId && t.archived !== true)
        .sort((a, b) => (b.start_date || "").localeCompare(a.start_date || ""))
    : [];

  const past = recurrences.filter((t) => t.status === "Completed");
  const future = recurrences.filter((t) => t.status !== "Completed").reverse();
  const visibleRecurrences = [...future, ...past].sort((a, b) =>
    (b.start_date || "").localeCompare(a.start_date || ""),
  );

  const handleClose = () => {
    setSelectedSeriesId("");
    setSelectedSeriesTitle("");
    setSelectedTaskId("");
    setCreateAsOccurrence(false);
    setOccurrenceDate("");
    setConfirmedDate("");
    onClose();
  };

  return (
    <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {isCreatingVendor ? "New Vendor for Correspondent" : "Match Document"}
          </h2>
          {!isCreatingVendor && setIsCreatingVendor && (
            <button
              onClick={() => {
                if (setNewVendorForm) {
                  setNewVendorForm({ name: "", service_type: "" });
                }
                setIsCreatingVendor(true);
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 px-2 py-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            >
              Make new vendor
            </button>
          )}
          {isCreatingVendor && setIsCreatingVendor && (
            <button
              onClick={() => {
                setIsCreatingVendor(false);
              }}
              className="text-xs font-bold text-gray-500 hover:underline"
            >
              Back to matching
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
            <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">
              Document
            </p>
            <p className="text-sm font-medium truncate">{doc.title}</p>
          </div>

          {!isCreatingVendor ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    1. Select Task Series
                  </label>
                  <select
                    value={selectedSeriesId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSeriesId(val);
                      setSelectedTaskId("");
                      if (val === "NEW TASK") {
                        setSelectedSeriesTitle("NEW TASK");
                        setNewTaskForm({
                          title: doc.title,
                          description: "",
                          category: categories[0] || "",
                          start_date: doc.created ? doc.created.split("T")[0] : "",
                          frequency: "",
                          vendor_id: defaultVendorId || "",
                          estimated_cost: "",
                        });
                      } else {
                        const selected = distinctSeries.find((s) => s.seriesId === val);
                        setSelectedSeriesTitle(selected?.title || "");
                      }
                    }}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="">Select a task series...</option>
                    <option value="NEW TASK" className="font-bold text-blue-600">
                      + NEW TASK
                    </option>
                    {distinctSeries.map(({ seriesId, title }) => (
                      <option key={seriesId} value={seriesId}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSeriesId === "NEW TASK" && (
                  <div className="p-4 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                        New Task Title
                      </label>
                      <input
                        value={newTaskForm.title}
                        onChange={(e) =>
                          setNewTaskForm({ ...newTaskForm, title: e.target.value })
                        }
                        className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                        Description
                      </label>
                      <textarea
                        value={newTaskForm.description || ""}
                        onChange={(e) =>
                          setNewTaskForm({ ...newTaskForm, description: e.target.value })
                        }
                        placeholder="Task details and notes..."
                        rows={2}
                        className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                          Category
                        </label>
                        <select
                          value={newTaskForm.category}
                          onChange={(e) =>
                            setNewTaskForm({ ...newTaskForm, category: e.target.value })
                          }
                          className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          <option value="">Select category</option>
                          {categories.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={newTaskForm.start_date}
                          onChange={(e) =>
                            setNewTaskForm({ ...newTaskForm, start_date: e.target.value })
                          }
                          className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                        Frequency (leave blank for one-off)
                      </label>
                      <select
                        value={newTaskForm.frequency}
                        onChange={(e) =>
                          setNewTaskForm({ ...newTaskForm, frequency: e.target.value })
                        }
                        className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="">One-off task</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Bi-weekly">Bi-weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quarterly">Quarterly</option>
                        <option value="Semi-Annually">Semi-Annually</option>
                        <option value="Annually">Annually</option>
                      </select>
                    </div>
                    {vendors && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                            Vendor (optional)
                          </label>
                          <select
                            value={newTaskForm.vendor_id || ""}
                            onChange={(e) =>
                              setNewTaskForm({ ...newTaskForm, vendor_id: e.target.value })
                            }
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="">No vendor</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name} ({v.service_type})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-blue-400 mb-1">
                            Estimated Cost (optional)
                          </label>
                          <input
                            type="number"
                            value={newTaskForm.estimated_cost || ""}
                            onChange={(e) =>
                              setNewTaskForm({ ...newTaskForm, estimated_cost: e.target.value })
                            }
                            placeholder="0.00"
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedSeriesId && selectedSeriesId !== "NEW TASK" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        2. Select Recurrence
                      </label>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {visibleRecurrences.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => {
                              setSelectedTaskId(task.id);
                              setConfirmedDate(task.start_date);
                              setCreateAsOccurrence(false);
                            }}
                            className={`w-full text-left p-3 rounded-md border transition-all ${
                              selectedTaskId === task.id && !createAsOccurrence
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500"
                                : "border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium">
                                {task.last_completed_date
                                  ? format(parseISO(task.last_completed_date), "dd MMM yyyy")
                                  : format(parseISO(task.start_date), "dd MMM yyyy")}
                              </span>
                              <span
                                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                                  task.status === "Completed"
                                    ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                                    : "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                {task.status}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {selectedTaskId && !createAsOccurrence && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-md">
                        <label className="block text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 mb-2">
                          Confirm date
                        </label>
                        <input
                          type="date"
                          value={confirmedDate}
                          onChange={(e) => setConfirmedDate(e.target.value)}
                          className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                        />
                      </div>
                    )}

                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createAsOccurrence}
                          onChange={(e) => {
                            setCreateAsOccurrence(e.target.checked);
                            if (!e.target.checked) {
                              setOccurrenceDate("");
                            }
                          }}
                          className="rounded border-gray-300 dark:border-gray-600"
                        />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Or create a custom occurrence
                        </span>
                      </label>
                      {createAsOccurrence && (
                        <div className="mt-3 p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-md">
                          <label className="block text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 mb-2">
                            Date task occurred
                          </label>
                          <input
                            type="date"
                            value={occurrenceDate}
                            onChange={(e) => setOccurrenceDate(e.target.value)}
                            className="w-full border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleClose}
                  className="text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
                <div className="flex gap-2 flex-1">
                  <button
                    type="button"
                    onClick={
                      selectedSeriesId === "NEW TASK"
                        ? onCreateAndMatch
                        : onManualMatch
                    }
                    disabled={
                      selectedSeriesId === "NEW TASK"
                        ? !newTaskForm.title ||
                          !newTaskForm.category ||
                          !newTaskForm.start_date
                        : createAsOccurrence
                          ? !occurrenceDate
                          : !selectedTaskId
                    }
                    className="flex-1 text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {selectedSeriesId === "NEW TASK" ? "Create & Link" : "Link"}
                  </button>
                  <button
                    type="button"
                    onClick={
                      selectedSeriesId === "NEW TASK"
                        ? onCreateAndMatchComplete
                        : onManualMatchAndComplete
                    }
                    disabled={
                      selectedSeriesId === "NEW TASK"
                        ? !newTaskForm.title ||
                          !newTaskForm.category ||
                          !newTaskForm.start_date
                        : createAsOccurrence
                          ? !occurrenceDate
                          : !selectedTaskId
                    }
                    className="flex-1 text-sm px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {selectedSeriesId === "NEW TASK" ? "Create & Link + Complete" : "Link + Complete"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {vendorError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950 border border-rose-200 dark:border-rose-800 rounded-md">
                  <p className="text-sm text-rose-700 dark:text-rose-400">{vendorError}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Vendor Name
                  </label>
                  <input
                    value={newVendorForm?.name || ""}
                    onChange={(e) => {
                      if (setNewVendorForm) {
                        setNewVendorForm({
                          ...newVendorForm,
                          name: e.target.value,
                        } as NewVendorForm);
                      }
                    }}
                    placeholder="e.g. Acme Services"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Service Type
                  </label>
                  <input
                    value={newVendorForm?.service_type || ""}
                    onChange={(e) => {
                      if (setNewVendorForm) {
                        setNewVendorForm({
                          ...newVendorForm,
                          service_type: e.target.value,
                        } as NewVendorForm);
                      }
                    }}
                    placeholder="e.g. Electrician"
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={onCreateVendor}
                  disabled={!newVendorForm?.name}
                  className="flex-1 text-sm px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors font-medium"
                >
                  Create Vendor
                </button>
                <button
                  onClick={() => {
                    if (setIsCreatingVendor) {
                      setIsCreatingVendor(false);
                    }
                  }}
                  className="flex-1 text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
