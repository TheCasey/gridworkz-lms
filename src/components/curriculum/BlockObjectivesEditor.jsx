import { useMemo, useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { getBlockObjectiveStatus } from '../../utils/blockObjectiveStatusUtils';

const emptyObjective = {
  instruction: '',
  custom_fields: [],
  student_overrides: {},
};

const getObjective = (blockObjectives, blockIndex) => ({
  ...emptyObjective,
  ...(blockObjectives[blockIndex] || {}),
  custom_fields: blockObjectives[blockIndex]?.custom_fields || [],
  student_overrides: blockObjectives[blockIndex]?.student_overrides || {},
});

const StatusPills = ({ colors, status }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    {status.configured ? status.labels.map((label) => (
      <span
        key={label}
        className="rounded-full px-2 py-0.5 text-[10px] font-label uppercase tracking-[0.08em]"
        style={{ backgroundColor: `${colors.lavender}55`, color: colors.charcoal }}
      >
        {label}
      </span>
    )) : (
      <span className="text-[11px] font-body text-charcoal-ink/35">Not configured</span>
    )}
  </div>
);

const AdvancedToggle = ({ children, colors, count, isOpen, onClick, title }) => (
  <div className="rounded-lg" style={{ border: `1px solid ${colors.parchment}` }}>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span>
        <span className="block text-[13px] font-label uppercase tracking-[0.12em] text-charcoal-ink/55">
          {title}
        </span>
        <span className="mt-0.5 block text-[12px] font-body text-charcoal-ink/40">
          {count}
        </span>
      </span>
      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-charcoal-ink/45 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    {isOpen && (
      <div className="space-y-3 px-4 pb-4">
        {children}
      </div>
    )}
  </div>
);

const FieldEditor = ({
  colors,
  field,
  inputCls,
  inputFocusStyle,
  inputStyle,
  onChange,
  onRemove,
}) => (
  <div className="rounded-lg bg-white p-3" style={{ border: `1px solid ${colors.parchment}` }}>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <select
        value={field.type}
        onChange={(e) => onChange('type', e.target.value)}
        className={inputCls}
        style={inputStyle}
        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
        onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
      >
        <option value="text">Text Input</option>
        <option value="number">Number Input</option>
        <option value="file">File Upload</option>
      </select>
      <label className="flex items-center gap-2 text-[13px] text-charcoal-ink/60 font-body">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange('required', e.target.checked)}
          className="h-4 w-4 accent-amethyst-link"
        />
        Required
      </label>
    </div>
    <div className="mt-2 space-y-2">
      <input
        type="text"
        value={field.label}
        onChange={(e) => onChange('label', e.target.value)}
        className={inputCls}
        style={inputStyle}
        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
        onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
        placeholder="Field label"
      />
      <input
        type="text"
        value={field.placeholder}
        onChange={(e) => onChange('placeholder', e.target.value)}
        className={inputCls}
        style={inputStyle}
        onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
        onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
        placeholder="Helper text for the student"
      />
    </div>
    <button
      type="button"
      onClick={onRemove}
      className="mt-2 text-[12px] font-body text-charcoal-ink/40 transition-colors hover:text-charcoal-ink"
    >
      Remove Field
    </button>
  </div>
);

const BlockObjectivesEditor = ({
  blockCount,
  blockObjectives,
  colors,
  expandedObjectiveBlock,
  expandedStudentOverrides,
  inputCls,
  inputFocusStyle,
  inputStyle,
  labelCls,
  onAddObjectiveCustomField,
  onAddStudentOverrideCustomField,
  onObjectiveChange,
  onObjectiveCustomFieldChange,
  onRemoveObjectiveCustomField,
  onRemoveStudentOverrideCustomField,
  onStudentOverrideChange,
  onStudentOverrideCustomFieldChange,
  onToggleObjective,
  onToggleStudentOverride,
  selectedStudents,
  setExpandedObjectiveBlock,
  setExpandedStudentOverrides,
  students,
}) => {
  const [blockFieldsOpen, setBlockFieldsOpen] = useState(false);
  const [studentOverridesOpen, setStudentOverridesOpen] = useState(false);
  const blockIndexes = useMemo(() => Array.from({ length: blockCount }, (_, index) => index), [blockCount]);
  const activeBlockIndex = Number.isInteger(expandedObjectiveBlock)
    && expandedObjectiveBlock >= 0
    && expandedObjectiveBlock < blockCount
    ? expandedObjectiveBlock
    : 0;
  const activeObjective = getObjective(blockObjectives, activeBlockIndex);
  const activeStatus = getBlockObjectiveStatus(activeObjective);
  const activeStudentOverrides = Object.keys(activeObjective.student_overrides || {});

  const selectBlock = (blockIndex) => {
    setExpandedObjectiveBlock(blockIndex);
    setBlockFieldsOpen(false);
    setStudentOverridesOpen(false);
  };

  return (
    <div>
      <p className="mb-4 text-[13px] font-body text-charcoal-ink/50">
        Attach specific instructions to individual blocks. Students see these as guided blocks with a dot indicator. Leave blocks blank for independent learning.
      </p>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-w-0 rounded-lg bg-white" style={{ border: `1px solid ${colors.parchment}` }}>
          <div className="px-3 py-2.5" style={{ borderBottom: `1px solid ${colors.parchment}` }}>
            <p className="text-[12px] font-label uppercase tracking-[0.12em] text-charcoal-ink/45">Blocks</p>
          </div>
          <div className="max-h-[440px] space-y-1 overflow-y-auto p-2">
            {blockIndexes.map((blockIndex) => {
              const objective = getObjective(blockObjectives, blockIndex);
              const status = getBlockObjectiveStatus(objective);
              const isActive = activeBlockIndex === blockIndex;

              return (
                <button
                  type="button"
                  key={blockIndex}
                  onClick={() => selectBlock(blockIndex)}
                  className="w-full rounded-md px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? `${colors.lavender}33` : 'transparent',
                    border: `1px solid ${isActive ? colors.lavender : 'transparent'}`,
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-body" style={{ color: colors.charcoal }}>
                      Block {blockIndex + 1}
                    </span>
                    {status.configured && (
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors.amethyst }} />
                    )}
                  </span>
                  <span className="mt-1 block">
                    <StatusPills colors={colors} status={status} />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0 rounded-lg bg-white" style={{ border: `1px solid ${colors.parchment}` }}>
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${colors.parchment}` }}>
            <div>
              <p className="text-[12px] font-label uppercase tracking-[0.12em] text-charcoal-ink/45">
                Block {activeBlockIndex + 1}
              </p>
              <div className="mt-1">
                <StatusPills colors={colors} status={activeStatus} />
              </div>
            </div>
            {blockObjectives[activeBlockIndex] && (
              <button
                type="button"
                onClick={() => onToggleObjective(activeBlockIndex)}
                className="text-[12px] font-body text-charcoal-ink/40 transition-colors hover:text-charcoal-ink"
              >
                Clear Block
              </button>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className={labelCls}>Shared Instruction</label>
              <p className="mb-2 text-[11px] font-body text-charcoal-ink/40">Applies to all assigned students unless overridden below.</p>
              <textarea
                value={activeObjective.instruction}
                onChange={(e) => onObjectiveChange(activeBlockIndex, e.target.value)}
                className="w-full resize-none rounded-lg bg-white px-3 py-2.5 text-[14px] font-body transition-colors focus:outline-none"
                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                rows={4}
                placeholder="e.g., Play a chess game with your sibling"
              />
            </div>

            <AdvancedToggle
              colors={colors}
              count={`${activeObjective.custom_fields.length} configured field${activeObjective.custom_fields.length === 1 ? '' : 's'}`}
              isOpen={blockFieldsOpen}
              onClick={() => setBlockFieldsOpen(open => !open)}
              title="Block-Specific Feedback Fields"
            >
              <p className="text-[11px] font-body text-charcoal-ink/40">If set, replaces subject-level fields for this block.</p>
              <div className="space-y-2">
                {activeObjective.custom_fields.map((field) => (
                  <FieldEditor
                    key={field.id}
                    colors={colors}
                    field={field}
                    inputCls={inputCls}
                    inputFocusStyle={inputFocusStyle}
                    inputStyle={inputStyle}
                    onChange={(key, value) => onObjectiveCustomFieldChange(activeBlockIndex, field.id, key, value)}
                    onRemove={() => onRemoveObjectiveCustomField(activeBlockIndex, field.id)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setBlockFieldsOpen(true);
                    onAddObjectiveCustomField(activeBlockIndex);
                  }}
                  className="flex items-center gap-1.5 text-[12px] font-body text-amethyst-link transition-colors hover:text-[#5c3d9e]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Feedback Field
                </button>
              </div>
            </AdvancedToggle>

            {selectedStudents.length > 1 && (
              <AdvancedToggle
                colors={colors}
                count={`${activeStudentOverrides.length} active override${activeStudentOverrides.length === 1 ? '' : 's'}`}
                isOpen={studentOverridesOpen}
                onClick={() => setStudentOverridesOpen(open => !open)}
                title="Per-Student Overrides"
              >
                <p className="text-[11px] font-body text-charcoal-ink/40">Replace this block's instruction or fields for a specific student.</p>
                <div className="space-y-2">
                  {selectedStudents.map(studentId => {
                    const st = students.find(s => s.id === studentId);
                    if (!st) return null;
                    const override = activeObjective.student_overrides?.[studentId];
                    const overrideExpanded = expandedStudentOverrides[`${activeBlockIndex}_${studentId}`];

                    return (
                      <div
                        key={studentId}
                        className="rounded-lg"
                        style={{ border: `1px solid ${override ? colors.amethyst + '55' : colors.parchment}` }}
                      >
                        <div className="flex items-center justify-between gap-3 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (override) {
                                setExpandedStudentOverrides(prev => ({
                                  ...prev,
                                  [`${activeBlockIndex}_${studentId}`]: !prev[`${activeBlockIndex}_${studentId}`],
                                }));
                              }
                            }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-body" style={{ color: colors.charcoal }}>{st.name}</span>
                              {override && (
                                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-label uppercase tracking-[0.08em]" style={{ backgroundColor: `${colors.amethyst}22`, color: colors.amethyst }}>
                                  Override
                                </span>
                              )}
                            </span>
                            {override?.instruction && (
                              <span className="mt-1 block truncate text-[12px] font-body text-charcoal-ink/40">{override.instruction}</span>
                            )}
                          </button>
                          {override ? (
                            <button
                              type="button"
                              onClick={() => onToggleStudentOverride(activeBlockIndex, studentId)}
                              className="text-[12px] font-body text-charcoal-ink/40 transition-colors hover:text-charcoal-ink"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setStudentOverridesOpen(true);
                                onToggleStudentOverride(activeBlockIndex, studentId);
                              }}
                              className="flex items-center gap-1 text-[12px] font-body text-amethyst-link transition-colors hover:text-[#5c3d9e]"
                            >
                              <Plus className="h-3 w-3" /> Override
                            </button>
                          )}
                        </div>

                        {override && overrideExpanded && (
                          <div className="space-y-3 px-3 pb-3" style={{ borderTop: `1px solid ${colors.amethyst}22` }}>
                            <div className="pt-3">
                              <label className={labelCls}>Instruction for {st.name}</label>
                              <textarea
                                value={override.instruction}
                                onChange={(e) => onStudentOverrideChange(activeBlockIndex, studentId, e.target.value)}
                                className="w-full resize-none rounded-lg bg-white px-3 py-2.5 text-[14px] font-body transition-colors focus:outline-none"
                                style={{ border: `1px solid ${colors.parchment}`, color: colors.charcoal }}
                                onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                rows={2}
                                placeholder={`Specific instruction for ${st.name}...`}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Feedback Fields for {st.name}</label>
                              <p className="mb-2 text-[11px] font-body text-charcoal-ink/40">If set, overrides block-level fields for {st.name} only.</p>
                              <div className="space-y-2">
                                {(override.custom_fields || []).map((field) => (
                                  <FieldEditor
                                    key={field.id}
                                    colors={colors}
                                    field={field}
                                    inputCls={inputCls}
                                    inputFocusStyle={inputFocusStyle}
                                    inputStyle={inputStyle}
                                    onChange={(key, value) => onStudentOverrideCustomFieldChange(activeBlockIndex, studentId, field.id, key, value)}
                                    onRemove={() => onRemoveStudentOverrideCustomField(activeBlockIndex, studentId, field.id)}
                                  />
                                ))}
                                <button
                                  type="button"
                                  onClick={() => onAddStudentOverrideCustomField(activeBlockIndex, studentId)}
                                  className="flex items-center gap-1.5 text-[12px] font-body text-amethyst-link transition-colors hover:text-[#5c3d9e]"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Add Field
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AdvancedToggle>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockObjectivesEditor;
