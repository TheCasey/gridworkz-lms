import React, { useState } from 'react';
import { Copy, Check, Trash2, Archive } from 'lucide-react';

const StudentCard = ({ student, onDelete }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyMagicLink = async () => {
    const magicLink = `${window.location.origin}/student/${student.slug}`;
    
    try {
      await navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(student.id);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 hover:shadow-md transition-shadow dark:hover:bg-slate-750">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
            {student.name}
          </h3>
          {student.access_pin && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              PIN Protected
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={handleDelete}
              className="p-2 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete student"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center">
            <span className="text-indigo-600 dark:text-indigo-300 font-semibold text-lg">
              {student.name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center text-sm text-slate-600 dark:text-slate-400">
          <span className="font-medium">Slug:</span>
          <span className="ml-2 font-mono text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
            {student.slug}
          </span>
        </div>

        <button
          onClick={handleCopyMagicLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              Copy Magic Link
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StudentCard;
