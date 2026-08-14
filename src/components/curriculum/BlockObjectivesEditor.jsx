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
        className="border px-2 py-0.5 text-[10px] font-label uppercase tracking-[0.08em]"
        style={{ backgroundColor: `${colors.lavender}22`, borderColor: `${colors.lavender}66`, color: colors.lavender }}
      >
        {label}
      </span>
    )) : (
      <span className="text-[11px] font-body text-[rgba(238,234,248,0.38)]">Not configured</span>
    )}
  </div>
);

const AdvancedToggle = ({ children, colors, count, isOpen, onClick, title }) => (
  <div className="op-panel-muted" style={{ borderLeft: `3px solid ${isOpen ? colors.lavender : 'rgba(238,234,248,0.14)'}` }}>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
    >
      <span>
        <span className="op-eyebrow block">
          {title}
        </span>
        <span className="op-subtle mt-1 block text-[12px] font-body">
          {count}
        </span>
      </span>
      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-[rgba(238,234,248,0.54)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
  <div className="op-surface p-3" style={{ borderLeft: `3px solid ${colors.lavender}88` }}>
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
      <label className="flex items-center gap-2 text-[13px] text-[rgba(238,234,248,0.68)] font-body">
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
      className="mt-2 text-[12px] font-body text-[rgba(238,234,248,0.44)] transition-colors hover:text-[rgba(250,249,255,0.92)]"
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
      <p className="op-subtle mb-4 text-[13px] font-body leading-5">
        Attach specific instructions to individual blocks. Students see these as guided blocks with a dot indicator. Leave blocks blank for independent learning.
      </p>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="op-surface min-w-0">
          <div className="px-3 py-2.5" style={{ borderBottom: '1px solid rgba(238,234,248,0.12)' }}>
            <p className="op-eyebrow">Blocks</p>
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
                  className="w-full px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isActive ? `${colors.lavender}1f` : 'transparent',
                    border: `1px solid ${isActive ? `${colors.lavender}88` : 'transparent'}`,
                    borderLeft: `3px solid ${isActive ? colors.lavender : status.configured ? `${colors.lavender}66` : 'transparent'}`,
                  }}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-body text-[rgba(250,249,255,0.9)]">
                      Block {blockIndex + 1}
                    </span>
                    {status.configured && (
                      <span className="h-2 w-2" style={{ backgroundColor: colors.lavender }} />
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

        <div className="op-surface min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(238,234,248,0.12)' }}>
            <div>
              <p className="op-eyebrow">
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
                className="text-[12px] font-body text-[rgba(238,234,248,0.44)] transition-colors hover:text-[rgba(250,249,255,0.92)]"
              >
                Clear Block
              </button>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label className={labelCls}>Shared Instruction</label>
              <p className="op-subtle mb-2 text-[11px] font-body">Applies to all assigned students unless overridden below.</p>
              <textarea
                value={activeObjective.instruction}
                onChange={(e) => onObjectiveChange(activeBlockIndex, e.target.value)}
                className={`${inputCls} min-h-[112px] resize-none text-[14px]`}
                style={inputStyle}
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
              <p className="op-subtle text-[11px] font-body">If set, replaces subject-level fields for this block.</p>
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
                  className="flex items-center gap-1.5 text-[12px] font-body text-[#cbb7fb] transition-colors hover:text-[#e0d5ff]"
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
                <p className="op-subtle text-[11px] font-body">Replace this block's instruction or fields for a specific student.</p>
                <div className="space-y-2">
                  {selectedStudents.map(studentId => {
                    const st = students.find(s => s.id === studentId);
                    if (!st) return null;
                    const override = activeObjective.student_overrides?.[studentId];
                    const overrideExpanded = expandedStudentOverrides[`${activeBlockIndex}_${studentId}`];

                    return (
                      <div
                        key={studentId}
                        className="op-surface"
                        style={{ borderLeft: `3px solid ${override ? colors.lavender : 'rgba(238,234,248,0.14)'}` }}
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
                              <span className="truncate text-[13px] font-body text-[rgba(250,249,255,0.9)]">{st.name}</span>
                              {override && (
                                <span className="border px-1.5 py-0.5 text-[10px] font-label uppercase tracking-[0.08em]" style={{ backgroundColor: `${colors.lavender}22`, borderColor: `${colors.lavender}66`, color: colors.lavender }}>
                                  Override
                                </span>
                              )}
                            </span>
                            {override?.instruction && (
                              <span className="op-subtle mt-1 block truncate text-[12px] font-body">{override.instruction}</span>
                            )}
                          </button>
                          {override ? (
                            <button
                              type="button"
                              onClick={() => onToggleStudentOverride(activeBlockIndex, studentId)}
                              className="text-[12px] font-body text-[rgba(238,234,248,0.44)] transition-colors hover:text-[rgba(250,249,255,0.92)]"
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
                              className="flex items-center gap-1 text-[12px] font-body text-[#cbb7fb] transition-colors hover:text-[#e0d5ff]"
                            >
                              <Plus className="h-3 w-3" /> Override
                            </button>
                          )}
                        </div>

                        {override && overrideExpanded && (
                          <div className="space-y-3 px-3 pb-3" style={{ borderTop: `1px solid ${colors.lavender}22` }}>
                            <div className="pt-3">
                              <label className={labelCls}>Instruction for {st.name}</label>
                              <textarea
                                value={override.instruction}
                                onChange={(e) => onStudentOverrideChange(activeBlockIndex, studentId, e.target.value)}
                                className={`${inputCls} min-h-[82px] resize-none text-[14px]`}
                                style={inputStyle}
                                onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                rows={2}
                                placeholder={`Specific instruction for ${st.name}...`}
                              />
                            </div>
                            <div>
                              <label className={labelCls}>Feedback Fields for {st.name}</label>
                              <p className="op-subtle mb-2 text-[11px] font-body">If set, overrides block-level fields for {st.name} only.</p>
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
                                  className="flex items-center gap-1.5 text-[12px] font-body text-[#cbb7fb] transition-colors hover:text-[#e0d5ff]"
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
