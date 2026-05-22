import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { BookOpen, Plus, Trash2, Archive, Edit, ExternalLink, X } from 'lucide-react';
import BlockObjectivesEditor from '../components/curriculum/BlockObjectivesEditor';
import WeeklyPlanReviewPanel from '../components/curriculum/WeeklyPlanReviewPanel';
import useEntitlements from '../hooks/useEntitlements';
import useStudents from '../hooks/useStudents';
import useSubjects from '../hooks/useSubjects';
import useSubjectMutations from '../hooks/useSubjectMutations';
import {
  buildEntitlementUsageSummary,
  isActiveCurriculumSubject,
} from '../utils/entitlementUtils';

const C = {
  mysteria: '#1b1938',
  lavender: '#cbb7fb',
  charcoal: '#292827',
  amethyst: '#714cb6',
  cream: '#e9e5dd',
  parchment: '#dcd7d3',
  lavenderTint: '#f0eaff',
};

const inputCls = 'w-full px-3 py-2.5 rounded-lg placeholder:text-[#292827]/30 focus:outline-none text-[15px] font-body transition-colors bg-white';
const inputStyle = { border: `1px solid ${C.parchment}`, color: C.charcoal };
const inputFocusStyle = { border: `1px solid ${C.charcoal}` };

const labelCls = 'block text-[13px] font-label uppercase tracking-wider text-charcoal-ink/50 mb-2';

const parsePositiveInt = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
const hasConfiguredField = (field) => hasText(field?.label);
const getConfiguredFields = (fields) => (
  Array.isArray(fields) ? fields.filter(hasConfiguredField) : []
);
const hasConfiguredOverride = (override) => (
  hasText(override?.instruction) || getConfiguredFields(override?.custom_fields).length > 0
);

const STEPS = [
  { label: 'Basics', description: 'Name, students & color' },
  { label: 'Schedule', description: 'Blocks & time settings' },
  { label: 'Resources & Feedback', description: 'Links & custom fields (optional)' },
  { label: 'Block Objectives', description: 'Per-block instructions (optional)' },
];

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
    style={{ backgroundColor: value ? C.lavender : C.parchment }}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${value ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const Curriculum = () => {
  const { currentUser } = useAuth();
  const outletContext = useOutletContext() || {};
  const parentSettings = outletContext.parentSettings || {};
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);

  const [selectedStudents, setSelectedStudents] = useState([]);
  const [subjectName, setSubjectName] = useState('');
  const [totalBlocks, setTotalBlocks] = useState(10);
  const [blockLength, setBlockLength] = useState(30);
  const [subjectColor, setSubjectColor] = useState('#3B82F6');
  const [requireSummary, setRequireSummary] = useState(true);
  const [resources, setResources] = useState([{ name: '', url: '' }]);
  const [customFields, setCustomFields] = useState([]);
  const [requireTimer, setRequireTimer] = useState(false);
  const [blockObjectives, setBlockObjectives] = useState({});
  const [expandedObjectiveBlock, setExpandedObjectiveBlock] = useState(null);
  const [expandedStudentOverrides, setExpandedStudentOverrides] = useState({});
  const [currentStep, setCurrentStep] = useState(1);

  const { students } = useStudents({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    sortField: 'name',
    sortDirection: 'asc',
  });
  const { subjects, loading } = useSubjects({
    parentId: currentUser?.uid,
    enabled: Boolean(currentUser),
    sortField: 'title',
    sortDirection: 'asc',
  });
  const {
    plan,
    curriculumLimitCheck,
    canAddCurriculumItem,
  } = useEntitlements({
    parentId: currentUser?.uid,
    students,
    subjects,
    enabled: Boolean(currentUser),
  });
  const {
    archiveSubject,
    deleteSubject,
    saveSubject,
  } = useSubjectMutations({
    canAddCurriculumItem,
    currentUser,
    curriculumLimitCheck,
    planName: plan?.displayName || 'Free',
  });

  const handleAddResource = () => setResources([...resources, { name: '', url: '' }]);
  const handleRemoveResource = (i) => setResources(resources.filter((_, idx) => idx !== i));
  const handleResourceChange = (i, field, value) => {
    const updated = [...resources];
    updated[i][field] = value;
    setResources(updated);
  };

  const handleAddCustomField = () => setCustomFields([...customFields, { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: false }]);
  const handleRemoveCustomField = (i) => setCustomFields(customFields.filter((_, idx) => idx !== i));
  const handleCustomFieldChange = (i, field, value) => {
    const updated = [...customFields];
    updated[i] = { ...updated[i], [field]: value };
    setCustomFields(updated);
  };

  const handleToggleObjective = (blockIndex) => {
    if (blockObjectives[blockIndex]) {
      setBlockObjectives(prev => { const next = { ...prev }; delete next[blockIndex]; return next; });
      setExpandedObjectiveBlock(blockIndex);
    } else {
      setBlockObjectives(prev => ({ ...prev, [blockIndex]: { instruction: '', custom_fields: [] } }));
      setExpandedObjectiveBlock(blockIndex);
    }
  };
  const handleObjectiveChange = (blockIndex, value) => {
    setBlockObjectives(prev => ({ ...prev, [blockIndex]: { ...prev[blockIndex], instruction: value } }));
  };
  const handleAddObjectiveCustomField = (blockIndex) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: [...(prev[blockIndex]?.custom_fields || []), { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: false }]
      }
    }));
  };
  const handleRemoveObjectiveCustomField = (blockIndex, fieldId) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: { ...(prev[blockIndex] || {}), custom_fields: (prev[blockIndex]?.custom_fields || []).filter(f => f.id !== fieldId) }
    }));
  };
  const handleObjectiveCustomFieldChange = (blockIndex, fieldId, key, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: (prev[blockIndex]?.custom_fields || []).map(f => f.id === fieldId ? { ...f, [key]: value } : f)
      }
    }));
  };

  const handleToggleStudentOverride = (blockIndex, studentId) => {
    const overrideKey = `${blockIndex}_${studentId}`;
    if (blockObjectives[blockIndex]?.student_overrides?.[studentId]) {
      setBlockObjectives(prev => {
        const overrides = { ...(prev[blockIndex]?.student_overrides || {}) };
        delete overrides[studentId];
        return { ...prev, [blockIndex]: { ...prev[blockIndex], student_overrides: overrides } };
      });
      setExpandedStudentOverrides(prev => { const next = { ...prev }; delete next[overrideKey]; return next; });
    } else {
      setBlockObjectives(prev => ({
        ...prev, [blockIndex]: {
          ...(prev[blockIndex] || {}),
          instruction: prev[blockIndex]?.instruction || '',
          custom_fields: prev[blockIndex]?.custom_fields || [],
          student_overrides: { ...(prev[blockIndex]?.student_overrides || {}), [studentId]: { instruction: '', custom_fields: [] } }
        }
      }));
      setExpandedStudentOverrides(prev => ({ ...prev, [overrideKey]: true }));
    }
  };
  const handleStudentOverrideChange = (blockIndex, studentId, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: prev[blockIndex]?.custom_fields || [],
        student_overrides: {
          ...(prev[blockIndex]?.student_overrides || {}),
          [studentId]: { ...(prev[blockIndex]?.student_overrides?.[studentId] || {}), instruction: value }
        }
      }
    }));
  };
  const handleAddStudentOverrideCustomField = (blockIndex, studentId) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: prev[blockIndex]?.custom_fields || [],
        student_overrides: {
          ...(prev[blockIndex]?.student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex]?.student_overrides?.[studentId] || {}),
            custom_fields: [
              ...(prev[blockIndex]?.student_overrides?.[studentId]?.custom_fields || []),
              { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: false }
            ]
          }
        }
      }
    }));
  };
  const handleRemoveStudentOverrideCustomField = (blockIndex, studentId, fieldId) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: prev[blockIndex]?.custom_fields || [],
        student_overrides: {
          ...(prev[blockIndex]?.student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex]?.student_overrides?.[studentId] || {}),
            custom_fields: (prev[blockIndex]?.student_overrides?.[studentId]?.custom_fields || []).filter(f => f.id !== fieldId)
          }
        }
      }
    }));
  };
  const handleStudentOverrideCustomFieldChange = (blockIndex, studentId, fieldId, key, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...(prev[blockIndex] || {}),
        instruction: prev[blockIndex]?.instruction || '',
        custom_fields: prev[blockIndex]?.custom_fields || [],
        student_overrides: {
          ...(prev[blockIndex]?.student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex]?.student_overrides?.[studentId] || {}),
            custom_fields: (prev[blockIndex]?.student_overrides?.[studentId]?.custom_fields || []).map(f => f.id === fieldId ? { ...f, [key]: value } : f)
          }
        }
      }
    }));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedStudents.length) { alert('Please select at least one student.'); return; }
      if (!subjectName.trim()) { alert('Please enter a subject name.'); return; }
    }
    setCurrentStep(s => Math.min(s + 1, STEPS.length));
  };

  const handlePrimaryAction = async (e) => {
    e.preventDefault();
    if (currentStep < STEPS.length) {
      handleNext();
      return;
    }
    await handleSubmit(e);
  };

  const resetForm = () => {
    setSelectedStudents([]); setSubjectName(''); setTotalBlocks(10); setBlockLength(30);
    setSubjectColor('#3B82F6'); setRequireSummary(true); setResources([{ name: '', url: '' }]);
    setCustomFields([]); setRequireTimer(false); setBlockObjectives({}); setExpandedObjectiveBlock(null);
    setExpandedStudentOverrides({}); setCurrentStep(1); setShowAddForm(false); setEditingSubject(null);
  };

  const openCreateSubjectForm = () => {
    if (!canAddCurriculumItem) return;
    resetForm();
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < STEPS.length) { handleNext(); return; }
    if (!selectedStudents.length || !subjectName.trim()) {
      alert('Please select at least one student and enter a subject name');
      return;
    }

    if (!editingSubject && !canAddCurriculumItem) {
      alert(
        `${buildEntitlementUsageSummary({
          limitCheck: curriculumLimitCheck,
          nounSingular: 'active subject',
          nounPlural: 'active subjects',
          planName: plan.displayName,
        })} ${curriculumLimitCheck?.upgradeCopy || ''} You can still edit, archive, or delete existing subjects, and inactive records do not count toward this cap.`
      );
      return;
    }

    try {
      const safeTotalBlocks = parsePositiveInt(totalBlocks, 10, { min: 1, max: 20 });
      const safeBlockLength = parsePositiveInt(blockLength, 30, { min: 5, max: 120 });
      const data = {
        student_ids: selectedStudents,
        parent_id: currentUser.uid,
        title: subjectName.trim(),
        block_count: safeTotalBlocks,
        block_length: safeBlockLength,
        color: subjectColor,
        resources: resources.filter(r => r.name.trim()),
        require_input: requireSummary,
        custom_fields: customFields.filter(f => f.label.trim()),
        require_timer: requireTimer,
        block_objectives: Object.fromEntries(
          Object.entries(blockObjectives)
            .filter(([, obj]) => {
              if (hasText(obj?.instruction)) return true;
              if (getConfiguredFields(obj?.custom_fields).length > 0) return true;
              return Object.values(obj?.student_overrides || {}).some(hasConfiguredOverride);
            })
            .map(([k, obj]) => {
              const cleanedOverrides = Object.fromEntries(
                Object.entries(obj.student_overrides || {})
                  .filter(([, ov]) => hasConfiguredOverride(ov))
                  .map(([sid, ov]) => [sid, { instruction: ov.instruction || '', custom_fields: getConfiguredFields(ov.custom_fields) }])
              );
              return [k, {
                instruction: obj.instruction || '',
                custom_fields: getConfiguredFields(obj.custom_fields),
                student_overrides: cleanedOverrides
              }];
            })
        ),
        is_active: true,
        updated_at: serverTimestamp()
      };
      const saved = await saveSubject({
        editingSubject,
        subjectData: data,
      });

      if (saved) {
        resetForm();
      }
    } catch (err) {
      console.error('Unexpected subject submission error:', err);
    }
  };

  const activeSubjects = useMemo(
    () => subjects.filter(isActiveCurriculumSubject),
    [subjects]
  );

  const handleEdit = (subject) => {
    const studentIds = subject.student_ids || [subject.student_id].filter(Boolean);
    setSelectedStudents(studentIds);
    setSubjectName(subject.title);
    setTotalBlocks(subject.block_count || 10);
    setBlockLength(subject.block_length || 30);
    setSubjectColor(subject.color || '#3B82F6');
    setRequireSummary(subject.require_input !== false);
    setResources(subject.resources?.length ? subject.resources : [{ name: '', url: '' }]);
    setCustomFields(subject.custom_fields || []);
    setRequireTimer(subject.require_timer || false);
    setBlockObjectives(subject.block_objectives || {});
    setExpandedObjectiveBlock(null);
    setEditingSubject(subject);
    setShowAddForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: C.lavender }} />
      </div>
    );
  }

  const normalizedTotalBlocks = parsePositiveInt(totalBlocks, 10, { min: 1, max: 20 });
  const curriculumLimitReached = Boolean(curriculumLimitCheck?.hasReachedLimit);
  const curriculumLimitSummary = buildEntitlementUsageSummary({
    limitCheck: curriculumLimitCheck,
    nounSingular: 'active subject',
    nounPlural: 'active subjects',
    planName: plan.displayName,
  });
  const curriculumLimitMessage = curriculumLimitReached
    ? `${curriculumLimitSummary} ${curriculumLimitCheck?.upgradeCopy || ''} You can still edit, archive, or delete existing subjects, and inactive or archived records do not count toward this cap.`
    : `${curriculumLimitSummary} Inactive or archived subjects stay available for history and do not count toward this cap.`;
  const isCreateSubjectBlocked = !editingSubject && curriculumLimitReached;

  return (
    <div className="p-8">
      <div className="mb-8">
        <div>
          <h2 className="text-[26px] font-display text-charcoal-ink" style={{ lineHeight: 1.1, letterSpacing: '-0.5px' }}>Curriculum</h2>
          <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">
            Manage subjects, learning resources, and the first weekly-plan review surface.
          </p>
        </div>
      </div>

      <WeeklyPlanReviewPanel
        activeSubjects={activeSubjects}
        colors={C}
        currentUser={currentUser}
        parentSettings={parentSettings}
        students={students}
      />

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] font-label text-charcoal-ink/40 mb-2">
            Compatibility Input Path
          </p>
          <h3 className="text-[22px] font-display text-charcoal-ink" style={{ lineHeight: 1.08 }}>
            Subject Editor
          </h3>
          <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">
            Subjects remain the source input for weekly-plan generation in this phase.
          </p>
        </div>
        <button
          onClick={openCreateSubjectForm}
          disabled={!canAddCurriculumItem}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors disabled:cursor-not-allowed"
          style={{
            backgroundColor: canAddCurriculumItem ? C.charcoal : 'rgba(41,40,39,0.2)',
            color: '#ffffff',
            opacity: canAddCurriculumItem ? 1 : 0.75,
          }}
          onMouseEnter={e => { if (canAddCurriculumItem) e.currentTarget.style.backgroundColor = '#3a3937'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = canAddCurriculumItem ? C.charcoal : 'rgba(41,40,39,0.2)'; }}
        >
          <Plus className="w-4 h-4" />
          {curriculumLimitReached ? 'Subject Limit Reached' : 'Add Subject'}
        </button>
      </div>

      {curriculumLimitCheck && (
        <div
          className="mb-6 rounded-2xl px-4 py-3"
          style={{
            backgroundColor: curriculumLimitReached ? `${C.lavenderTint}` : '#fbfaf8',
            border: `1px solid ${curriculumLimitReached ? `${C.lavender}90` : C.parchment}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: curriculumLimitReached ? C.amethyst : 'rgba(41,40,39,0.5)' }}>
              Active Subject Usage
            </p>
            <span className="text-[12px] font-label" style={{ color: curriculumLimitReached ? C.amethyst : 'rgba(41,40,39,0.45)' }}>
              {curriculumLimitCheck.isUnlimited ? `${curriculumLimitCheck.usage} active` : `${curriculumLimitCheck.usage}/${curriculumLimitCheck.limit}`}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] font-body" style={{ color: curriculumLimitReached ? C.charcoal : 'rgba(41,40,39,0.68)' }}>
            {curriculumLimitMessage}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-3 sm:p-4">
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-hidden"
            style={{ border: `1px solid ${C.parchment}` }}
          >

            {/* Sticky header + step indicator */}
            <div className="sticky top-0 bg-white z-10 flex-shrink-0" style={{ borderBottom: `1px solid ${C.parchment}` }}>
              <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <div>
                  <h2 className="text-[18px] font-display text-charcoal-ink">
                    {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                  </h2>
                  <p className="text-[12px] text-charcoal-ink/40 font-body mt-0.5">
                    {STEPS[currentStep - 1].description}
                  </p>
                </div>
                <button onClick={resetForm} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!editingSubject && curriculumLimitCheck && (
                <div
                  className="mx-6 mb-4 rounded-xl px-4 py-3"
                  style={{
                    backgroundColor: isCreateSubjectBlocked ? `${C.lavenderTint}` : '#fbfaf8',
                    border: `1px solid ${isCreateSubjectBlocked ? `${C.lavender}90` : C.parchment}`,
                  }}
                >
                  <p className="text-[12px] uppercase tracking-wider font-label" style={{ color: isCreateSubjectBlocked ? C.amethyst : 'rgba(41,40,39,0.5)' }}>
                    Active Subject Limit
                  </p>
                  <p className="mt-1.5 text-[13px] font-body" style={{ color: C.charcoal }}>
                    {curriculumLimitMessage}
                  </p>
                </div>
              )}
              {/* Step indicator */}
              <div className="flex items-start px-6 pb-5">
                {STEPS.map((step, idx) => {
                  const n = idx + 1;
                  const active = n === currentStep;
                  const done = n < currentStep;
                  return (
                    <React.Fragment key={n}>
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 56 }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: done ? C.charcoal : active ? C.lavender : 'transparent',
                            border: `1.5px solid ${done ? C.charcoal : active ? C.lavender : C.parchment}`,
                            color: done ? '#fff' : active ? C.charcoal : 'rgba(41,40,39,0.25)',
                            fontSize: 11, fontWeight: 700
                          }}>
                          {done ? '✓' : n}
                        </div>
                        <span style={{ fontSize: 9, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: active ? 700 : 400, color: active ? C.charcoal : 'rgba(41,40,39,0.35)', textAlign: 'center', lineHeight: 1.3 }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 1.5, marginTop: 11, backgroundColor: n < currentStep ? C.charcoal : C.parchment }} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="min-h-0 flex flex-1 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6">

              {/* Step 1: Basics */}
              {currentStep === 1 && (<>
                <div>
                  <label className={labelCls}>Assign Students *</label>
                  <div className="rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ border: `1px solid ${C.parchment}` }}>
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                        style={{ borderBottom: `1px solid ${C.parchment}` }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cream}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <input type="checkbox" checked={selectedStudents.includes(s.id)}
                          onChange={(e) => setSelectedStudents(e.target.checked ? [...selectedStudents, s.id] : selectedStudents.filter(id => id !== s.id))}
                          className="w-4 h-4 accent-amethyst-link" />
                        <span className="text-[14px] text-charcoal-ink font-body">{s.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedStudents.length === 0
                    ? <p className="text-[12px] text-amethyst-link mt-1.5">Select at least one student</p>
                    : <p className="text-[12px] text-charcoal-ink/40 mt-1.5">{selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected</p>}
                </div>
                <div>
                  <label className={labelCls}>Subject Name *</label>
                  <input type="text" value={subjectName} onChange={(e) => setSubjectName(e.target.value)}
                    className={inputCls} style={inputStyle}
                    onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                    placeholder="e.g., Chess Curriculum" autoFocus />
                </div>
                <div>
                  <label className={labelCls}>Subject Color</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={subjectColor} onChange={(e) => setSubjectColor(e.target.value)}
                      className="w-14 h-10 rounded-lg cursor-pointer p-0.5 bg-white" style={{ border: `1px solid ${C.parchment}` }} />
                    <span className="text-[13px] text-charcoal-ink/50 font-mono">{subjectColor}</span>
                  </div>
                </div>
              </>)}

              {/* Step 2: Schedule */}
              {currentStep === 2 && (<>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Blocks per Week</label>
                    <input type="number" min="1" max="20" value={totalBlocks}
                      onChange={(e) => setTotalBlocks(e.target.value === '' ? '' : parsePositiveInt(e.target.value, 10, { min: 1, max: 20 }))}
                      className={inputCls} style={inputStyle}
                      onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                      onBlur={e => {
                        Object.assign(e.currentTarget.style, inputStyle);
                        setTotalBlocks(parsePositiveInt(e.target.value, 10, { min: 1, max: 20 }));
                      }} />
                  </div>
                  <div>
                    <label className={labelCls}>Block Length (min)</label>
                    <input type="number" min="5" max="120" step="5" value={blockLength}
                      onChange={(e) => setBlockLength(e.target.value === '' ? '' : parsePositiveInt(e.target.value, 30, { min: 5, max: 120 }))}
                      className={inputCls} style={inputStyle}
                      onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                      onBlur={e => {
                        Object.assign(e.currentTarget.style, inputStyle);
                        setBlockLength(parsePositiveInt(e.target.value, 30, { min: 5, max: 120 }));
                      }} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-body text-charcoal-ink">Require Summary</p>
                      <p className="text-[12px] text-charcoal-ink/40 mt-0.5">
                        {requireSummary ? 'Students must write a summary (min. 150 characters)' : 'No summary required'}
                      </p>
                    </div>
                    <Toggle value={requireSummary} onChange={setRequireSummary} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-body text-charcoal-ink">Require Timer</p>
                      <p className="text-[12px] text-charcoal-ink/40 mt-0.5">
                        {requireTimer ? 'Timer must complete before submitting' : 'Timer is optional'}
                      </p>
                    </div>
                    <Toggle value={requireTimer} onChange={setRequireTimer} />
                  </div>
                </div>
              </>)}

              {/* Step 3: Resources & Feedback */}
              {currentStep === 3 && (<>
                <div>
                  <label className={labelCls}>Resource Links</label>
                  <p className="text-[12px] text-charcoal-ink/40 mb-3 font-body">Links or materials students can reference during a block</p>
                  <div className="space-y-2.5">
                    {resources.map((resource, i) => (
                      <div key={i} className="flex flex-col gap-2 sm:flex-row">
                        <input type="text" value={resource.name}
                          onChange={(e) => handleResourceChange(i, 'name', e.target.value)}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                          placeholder="Resource name" />
                        <input type="url" value={resource.url}
                          onChange={(e) => handleResourceChange(i, 'url', e.target.value)}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                          placeholder="https://..." />
                        {resources.length > 1 && (
                          <button type="button" onClick={() => handleRemoveResource(i)}
                            className="self-start p-2 text-charcoal-ink/30 hover:text-charcoal-ink transition-colors sm:self-auto">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={handleAddResource}
                      className="flex items-center gap-2 text-[13px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                      <Plus className="w-4 h-4" /> Add Resource
                    </button>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${C.parchment}` }} />
                <div>
                  <label className={labelCls}>Custom Submission Fields</label>
                  <p className="text-[12px] text-charcoal-ink/40 mb-3 font-body">Extra info requested from students on every block completion for this subject</p>
                  <div className="space-y-3">
                    {customFields.map((field, i) => (
                      <div key={field.id} className="rounded-lg p-4 bg-[#faf9f8]" style={{ border: `1px solid ${C.parchment}` }}>
                        <div className="grid grid-cols-1 gap-3 mb-3 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>Field Type</label>
                            <select value={field.type} onChange={(e) => handleCustomFieldChange(i, 'type', e.target.value)}
                              className={inputCls} style={inputStyle}
                              onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                              onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}>
                              <option value="text">Text Input</option>
                              <option value="number">Number Input</option>
                              <option value="file">File Upload</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2 sm:mt-6">
                            <input type="checkbox" checked={field.required}
                              onChange={(e) => handleCustomFieldChange(i, 'required', e.target.checked)}
                              className="w-4 h-4 accent-amethyst-link" />
                            <label className="text-[13px] text-charcoal-ink/60 font-body">Required</label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <input type="text" value={field.label} onChange={(e) => handleCustomFieldChange(i, 'label', e.target.value)}
                            className={inputCls} style={inputStyle}
                            onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                            placeholder="Field label (e.g., 'Which chapters did you read?')" />
                          <input type="text" value={field.placeholder} onChange={(e) => handleCustomFieldChange(i, 'placeholder', e.target.value)}
                            className={inputCls} style={inputStyle}
                            onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                            onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                            placeholder="Helper text for the student" />
                        </div>
                        <button type="button" onClick={() => handleRemoveCustomField(i)}
                          className="mt-3 text-[12px] text-charcoal-ink/40 hover:text-charcoal-ink font-body transition-colors">
                          Remove Field
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddCustomField}
                      className="flex items-center gap-2 text-[13px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                      <Plus className="w-4 h-4" /> Add Custom Field
                    </button>
                  </div>
                </div>
              </>)}

              {/* Step 4: Block Objectives */}
              {currentStep === 4 && (
                <BlockObjectivesEditor
                  blockCount={normalizedTotalBlocks}
                  blockObjectives={blockObjectives}
                  colors={C}
                  expandedObjectiveBlock={expandedObjectiveBlock}
                  expandedStudentOverrides={expandedStudentOverrides}
                  inputCls={inputCls}
                  inputFocusStyle={inputFocusStyle}
                  inputStyle={inputStyle}
                  labelCls={labelCls}
                  onAddObjectiveCustomField={handleAddObjectiveCustomField}
                  onAddStudentOverrideCustomField={handleAddStudentOverrideCustomField}
                  onObjectiveChange={handleObjectiveChange}
                  onObjectiveCustomFieldChange={handleObjectiveCustomFieldChange}
                  onRemoveObjectiveCustomField={handleRemoveObjectiveCustomField}
                  onRemoveStudentOverrideCustomField={handleRemoveStudentOverrideCustomField}
                  onStudentOverrideChange={handleStudentOverrideChange}
                  onStudentOverrideCustomFieldChange={handleStudentOverrideCustomFieldChange}
                  onToggleObjective={handleToggleObjective}
                  onToggleStudentOverride={handleToggleStudentOverride}
                  selectedStudents={selectedStudents}
                  setExpandedObjectiveBlock={setExpandedObjectiveBlock}
                  setExpandedStudentOverrides={setExpandedStudentOverrides}
                  students={students}
                />
              )}
              </div>

              {/* Step navigation */}
              <div className="sticky bottom-0 flex flex-shrink-0 gap-3 bg-white p-4 sm:p-6" style={{ borderTop: `1px solid ${C.parchment}` }}>
                <button type="button"
                  onClick={currentStep === 1 ? resetForm : () => setCurrentStep(s => s - 1)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                  {currentStep === 1 ? 'Cancel' : '← Back'}
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isCreateSubjectBlocked}
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isCreateSubjectBlocked ? 'rgba(41,40,39,0.2)' : C.charcoal,
                    color: '#ffffff',
                    opacity: isCreateSubjectBlocked ? 0.75 : 1,
                  }}
                  onMouseEnter={e => { if (!isCreateSubjectBlocked) e.currentTarget.style.backgroundColor = '#3a3937'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isCreateSubjectBlocked ? 'rgba(41,40,39,0.2)' : C.charcoal; }}>
                  {isCreateSubjectBlocked
                    ? 'Upgrade Required'
                    : currentStep === STEPS.length
                      ? (editingSubject ? 'Update Subject' : 'Add Subject')
                      : 'Next →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subjects Grid */}
      {activeSubjects.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-charcoal-ink/20 mx-auto mb-4" />
          <h3 className="text-[18px] font-display text-charcoal-ink mb-2">No subjects yet</h3>
          <p className="text-[14px] text-charcoal-ink/40 font-body mb-6">Add your first subject to get started</p>
          <button onClick={openCreateSubjectForm}
            disabled={!canAddCurriculumItem}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors disabled:cursor-not-allowed"
            style={{
              backgroundColor: canAddCurriculumItem ? C.charcoal : 'rgba(41,40,39,0.2)',
              color: '#ffffff',
              opacity: canAddCurriculumItem ? 1 : 0.75,
            }}
            onMouseEnter={e => { if (canAddCurriculumItem) e.currentTarget.style.backgroundColor = '#3a3937'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = canAddCurriculumItem ? C.charcoal : 'rgba(41,40,39,0.2)'; }}>
            <Plus className="w-4 h-4" /> {curriculumLimitReached ? 'Subject Limit Reached' : 'Add Your First Subject'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeSubjects.map((subject) => {
            const studentIds = subject.student_ids || [subject.student_id].filter(Boolean);
            const studentNames = studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', ');

            return (
              <div key={subject.id} className="bg-white rounded-2xl p-6 hover:shadow-sm transition-shadow" style={{ border: `1px solid ${C.parchment}` }}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color || '#3B82F6' }} />
                      <h3 className="text-[16px] font-display text-charcoal-ink truncate" style={{ lineHeight: 1.2 }}>
                        {subject.title}
                      </h3>
                    </div>
                    <p className="text-[13px] text-charcoal-ink/40 font-body truncate">{studentNames || 'Unknown students'}</p>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => handleEdit(subject)}
                      className="p-1.5 text-charcoal-ink/30 hover:text-charcoal-ink transition-colors" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => archiveSubject(subject.id)}
                      className="p-1.5 text-charcoal-ink/30 hover:text-charcoal-ink transition-colors" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSubject(subject.id)}
                      className="p-1.5 text-charcoal-ink/30 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-charcoal-ink/50 font-body">Weekly Blocks</span>
                    <span className="text-[13px] font-display text-charcoal-ink">{subject.block_count || 10}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-charcoal-ink/50 font-body">Block Length</span>
                    <span className="text-[13px] font-display text-charcoal-ink">{subject.block_length || 30} min</span>
                  </div>

                  {subject.resources && subject.resources.length > 0 && (
                    <div className="pt-3" style={{ borderTop: `1px solid ${C.parchment}` }}>
                      <p className="text-[11px] font-label uppercase tracking-wider text-charcoal-ink/40 mb-2">Resources</p>
                      <div className="space-y-1.5">
                        {subject.resources.map((r, i) => (
                          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[13px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                            <ExternalLink className="w-3 h-3" />
                            {r.name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Curriculum;
