import React, { useState } from 'react';
import { X } from 'lucide-react';

const AddStudentModal = ({ isOpen, onClose, onAddStudent, loading }) => {
  const [studentName, setStudentName] = useState('');
  const [accessPin, setAccessPin] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      onAddStudent({ name: studentName.trim(), accessPin: accessPin.trim() || null });
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

  const inputCls = 'w-full px-3 py-2.5 border border-parchment rounded-lg text-charcoal-ink placeholder:text-charcoal-ink/30 focus:outline-none focus:border-charcoal-ink text-[15px] font-body transition-colors';
  const labelCls = 'block text-[13px] font-label uppercase tracking-wider text-charcoal-ink/50 mb-2';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 border border-parchment">
        <div className="flex items-center justify-between p-6 border-b border-parchment">
          <h2 className="text-[18px] font-display text-charcoal-ink" style={{ lineHeight: 1.2 }}>Add New Student</h2>
          <button onClick={handleClose} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="studentName" className={labelCls}>Student Name *</label>
            <input
              id="studentName"
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className={inputCls}
              placeholder="Enter student's name"
            />
          </div>

          <div>
            <label htmlFor="accessPin" className={labelCls}>Access PIN <span className="normal-case">(Optional)</span></label>
            <input
              id="accessPin"
              type="text"
              maxLength="4"
              pattern="[0-9]{4}"
              value={accessPin}
              onChange={(e) => setAccessPin(e.target.value)}
              className={inputCls}
              placeholder="4-digit PIN"
            />
            <p className="mt-1.5 text-[12px] text-charcoal-ink/40 font-body">
              Optional PIN to prevent siblings from accessing each other's portal
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-warm-cream text-charcoal-ink rounded-lg font-label text-[15px] hover:bg-[#ddd7cf] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !studentName.trim()}
              className="flex-1 px-4 py-2.5 bg-charcoal-ink text-white rounded-lg font-label text-[15px] hover:bg-[#3a3937] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
