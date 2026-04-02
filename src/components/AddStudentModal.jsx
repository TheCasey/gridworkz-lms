import React, { useState } from 'react';
import { X } from 'lucide-react';

const AddStudentModal = ({ isOpen, onClose, onAddStudent, loading }) => {
  const [studentName, setStudentName] = useState('');
  const [accessPin, setAccessPin] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      onAddStudent({
        name: studentName.trim(),
        accessPin: accessPin.trim() || null
      });
      setStudentName('');
      setAccessPin('');
    }
  };

  const handleClose = () => {
    setStudentName('');
    setAccessPin('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Add New Student</h2>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="studentName" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Student Name *
            </label>
            <input
              id="studentName"
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter student's name"
            />
          </div>

          <div>
            <label htmlFor="accessPin" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Access PIN (Optional)
            </label>
            <input
              id="accessPin"
              type="text"
              maxLength="4"
              pattern="[0-9]{4}"
              value={accessPin}
              onChange={(e) => setAccessPin(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="4-digit PIN for sibling protection"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Optional 4-digit PIN to prevent siblings from accessing each other's progress
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !studentName.trim()}
              className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? 'Adding...' : 'Add Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddStudentModal;
