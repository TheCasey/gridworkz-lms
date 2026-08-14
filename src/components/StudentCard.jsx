import { useState } from 'react';
import { Copy, Check, Trash2, Eye } from 'lucide-react';
import { buildPublicUrl } from '../utils/appHosts';

const StudentCard = ({
  student,
  onDelete,
  onViewChoresProgress,
  onViewSchoolProgress,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPortalLink = async () => {
    const publicStudentPath = buildPublicUrl(`/student/${student.slug}`);
    const portalLink = publicStudentPath.startsWith('/')
      ? `${window.location.origin}${publicStudentPath}`
      : publicStudentPath;
    try {
      await navigator.clipboard.writeText(portalLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="op-surface p-5 transition-colors hover:bg-[#292942]">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-[rgba(203,183,251,0.28)] bg-[#202034]">
            <span className="font-display text-[17px] text-[#cbb7fb]">
              {student.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-[18px] font-display text-white" style={{ lineHeight: 1.05 }}>
              {student.name}
            </h3>
            {student.access_pin && (
              <p className="op-subtle mt-1 text-[12px] font-body">PIN protected</p>
            )}
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(student.id)}
            className="op-icon-button h-8 w-8 hover:text-red-400"
            title="Delete student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="op-eyebrow mb-2">Portal URL</p>
        <span className="block truncate border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-2 font-mono text-[12px] text-[rgba(238,234,248,0.58)]">
          /student/{student.slug}
        </span>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={handleCopyPortalLink}
          className="op-button w-full"
        >
          {copied ? (
            <><Check className="w-4 h-4" />Copied!</>
          ) : (
            <><Copy className="w-4 h-4" />Copy Portal Link</>
          )}
        </button>

        <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-3">
          <p className="op-eyebrow mb-2">
            Progress Views
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={() => onViewSchoolProgress?.(student)}
              className="op-button"
            >
              <Eye className="w-4 h-4" />
              School Progress
            </button>

            <button
              onClick={() => onViewChoresProgress?.(student)}
              className="op-button op-button-secondary"
            >
              <Eye className="w-4 h-4" />
              Chores Progress
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentCard;
