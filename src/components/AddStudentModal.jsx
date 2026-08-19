import { useState } from 'react';
import { KeyRound, LockKeyhole, X } from 'lucide-react';

const AddStudentModal = ({ isOpen, onClose, onAddStudent, loading }) => {
  const [studentName, setStudentName] = useState('');
  const [accessPin, setAccessPin] = useState('');
  const [credentialMode, setCredentialMode] = useState('pin');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (studentName.trim()) {
      onAddStudent({
        name: studentName.trim(),
        accessPin: credentialMode === 'pin' ? accessPin.trim() || null : null,
      });
      setStudentName('');
      setAccessPin('');
      setCredentialMode('pin');
    }
  };

  const handleClose = () => {
    setStudentName('');
    setAccessPin('');
    setCredentialMode('pin');
    onClose();
  };

  if (!isOpen) return null;

  const labelCls = 'block text-[11px] font-label uppercase tracking-[0.16em] text-[rgba(203,183,251,0.72)] mb-2';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md border border-[rgba(203,183,251,0.18)] border-l-[3px] border-l-[#cbb7fb] bg-[#27273e] text-[rgba(248,247,255,0.94)]">
        <div className="flex items-center justify-between border-b border-[rgba(238,234,248,0.12)] p-6">
          <div>
            <p className="op-eyebrow">Students</p>
            <h2 className="mt-2 text-[24px] font-display leading-none text-white">Add Student</h2>
          </div>
          <button onClick={handleClose} className="op-icon-button" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label htmlFor="studentName" className={labelCls}>Student Name</label>
            <input
              id="studentName"
              type="text"
              required
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="op-input"
              placeholder="Enter student's name"
            />
          </div>

          <div>
            <p className={labelCls}>Portal Credential</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCredentialMode('pin')}
                className={`border px-3 py-3 text-left transition-colors ${
                  credentialMode === 'pin'
                    ? 'border-[#cbb7fb] bg-[rgba(203,183,251,0.1)]'
                    : 'border-[rgba(238,234,248,0.12)] bg-transparent'
                }`}
              >
                <KeyRound className="h-4 w-4 text-[#cbb7fb]" />
                <span className="mt-2 block text-[13px] font-label text-white">PIN</span>
                <span className="mt-1 block text-[12px] text-[rgba(238,234,248,0.5)]">4-6 digits</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentialMode('password')}
                className={`border px-3 py-3 text-left transition-colors ${
                  credentialMode === 'password'
                    ? 'border-[#cbb7fb] bg-[rgba(203,183,251,0.1)]'
                    : 'border-[rgba(238,234,248,0.12)] bg-transparent'
                }`}
              >
                <LockKeyhole className="h-4 w-4 text-[#cbb7fb]" />
                <span className="mt-2 block text-[13px] font-label text-white">Password</span>
                <span className="mt-1 block text-[12px] text-[rgba(238,234,248,0.5)]">Next migration</span>
              </button>
            </div>
          </div>

          {credentialMode === 'pin' ? (
            <div>
              <label htmlFor="accessPin" className={labelCls}>Access PIN <span className="normal-case tracking-normal">(Optional)</span></label>
              <input
                id="accessPin"
                type="text"
                inputMode="numeric"
                maxLength="6"
                pattern="[0-9]{4,6}"
                value={accessPin}
                onChange={(e) => setAccessPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="op-input"
                placeholder="4-6 digit PIN"
              />
              <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.46)]">
                Optional PIN to keep each student's portal separate.
              </p>
            </div>
          ) : (
            <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-4">
              <p className="text-[13px] leading-5 text-[rgba(238,234,248,0.62)]">
                Password credentials are part of the next student portal auth migration. Add the student now, then set password access after that migration lands.
              </p>
            </div>
          )}

          <div className="border border-[rgba(238,234,248,0.1)] bg-[#202034] p-4">
            <p className="text-[12px] font-label uppercase tracking-[0.14em] text-[rgba(203,183,251,0.72)]">Current write path</p>
            <p className="mt-2 text-[13px] leading-5 text-[rgba(238,234,248,0.56)]">
              PIN access is active now. Password access requires the planned portal credential migration.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="op-button op-button-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !studentName.trim()}
              className="op-button flex-1"
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
