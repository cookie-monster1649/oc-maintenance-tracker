"use client";

interface MatchSuccessModalProps {
  title: string;
  docUrl: string;
  taskId?: string;
  lineItemId?: string;
  onClose: () => void;
}

export function MatchSuccessModal({
  title,
  docUrl,
  taskId,
  lineItemId,
  onClose,
}: MatchSuccessModalProps) {
  return (
    <div className="animate-backdrop fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="animate-modal bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-sm w-full p-8 text-center">
        <div className="w-12 h-12 bg-green-100 dark:bg-green-950 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          Task Completed!
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Document successfully linked to {title}.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
          >
            Close
          </button>
          {(lineItemId || taskId) && (
            <a
              href={lineItemId ? `/line-items/${lineItemId}` : `/tasks/${taskId}`}
              className="text-sm px-4 py-2 rounded-md bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium text-center"
            >
              {lineItemId ? "Go to Line Item →" : "Go to Task →"}
            </a>
          )}
          <a
            href={docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2 rounded-md bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Preview Document ↗
          </a>
        </div>
      </div>
    </div>
  );
}
