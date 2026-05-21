"use client";

import { ReactNode } from "react";
import { useRouter } from "next/navigation";

interface DetailPageLayoutProps {
  backHref?: string;
  title: string;
  subtitle?: string;
  menuButton?: ReactNode;
  headerLeftContent: ReactNode;
  headerRightContent: ReactNode;
  taskPatternsSection?: ReactNode;
  tasksAndDocumentsSection: ReactNode;
}

export default function DetailPageLayout({
  backHref,
  title,
  subtitle,
  menuButton,
  headerLeftContent,
  headerRightContent,
  taskPatternsSection,
  tasksAndDocumentsSection,
}: DetailPageLayoutProps) {
  const router = useRouter();

  return (
    <main className="animate-page content-container py-10">
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mb-8 inline-block bg-none border-none cursor-pointer p-0"
      >
        ← Back
      </button>

      <div className="mb-12">
        {/* Title section */}
        <div className="flex items-start justify-between gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {menuButton}
        </div>

        {/* Header content: 2-column grid */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div>{headerLeftContent}</div>
          <div>{headerRightContent}</div>
        </div>
      </div>

      {/* Task patterns section (optional, line items only) */}
      {taskPatternsSection}

      {/* Tasks and documents: 2-column grid */}
      {tasksAndDocumentsSection}
    </main>
  );
}
