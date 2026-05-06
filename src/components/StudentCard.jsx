import { useState } from 'react';
import { Copy, Check, Trash2, Eye } from 'lucide-react';

const StudentCard = ({ student, onDelete, onViewProgress }) => {
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

  return (
    <div className="bg-white rounded-2xl border border-parchment p-6 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-[#f0eaff] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-amethyst-link font-display text-[17px]">
              {student.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-[16px] font-display text-charcoal-ink" style={{ lineHeight: 1.2 }}>
              {student.name}
            </h3>
            {student.access_pin && (
              <p className="text-[12px] text-charcoal-ink/40 font-body mt-0.5">PIN protected</p>
            )}
          </div>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(student.id)}
            className="p-1.5 text-charcoal-ink/30 hover:text-red-500 transition-colors"
            title="Delete student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mb-4">
        <p className="text-[11px] font-label uppercase tracking-wider text-charcoal-ink/40 mb-1">Portal URL</p>
        <span className="text-[12px] font-mono text-charcoal-ink/50 bg-warm-cream px-2 py-1 rounded">
          /student/{student.slug}
        </span>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={handleCopyMagicLink}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
          style={{ backgroundColor: '#e9e5dd', color: '#292827' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ddd7cf'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#e9e5dd'}
        >
          {copied ? (
            <><Check className="w-4 h-4" />Copied!</>
          ) : (
            <><Copy className="w-4 h-4" />Copy Magic Link</>
          )}
        </button>

        <button
          onClick={() => onViewProgress?.(student)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
          style={{ backgroundColor: '#292827', color: '#ffffff' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = '#292827'}
        >
          <Eye className="w-4 h-4" />
          View Progress
        </button>
      </div>
    </div>
  );
};

export default StudentCard;
