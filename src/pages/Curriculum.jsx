import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { ArrowRight, BookOpen, CalendarDays, Plus, Trash2, Archive, Edit, ExternalLink, X } from 'lucide-react';
import BlockObjectivesEditor from '../components/curriculum/BlockObjectivesEditor';
import { dashboardFeaturesById } from '../constants/dashboardFeatures';
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

const inputCls = 'op-input text-[15px] font-body transition-colors';
const inputStyle = {
  backgroundColor: '#202034',
  border: '1px solid rgba(238,234,248,0.18)',
  color: 'rgba(250,249,255,0.94)',
};
const inputFocusStyle = { border: `1px solid ${C.lavender}` };

const labelCls = 'block text-[11px] font-label uppercase tracking-[0.16em] text-[rgba(203,183,251,0.72)] mb-2';

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
    className="relative inline-flex h-6 w-11 items-center border transition-colors"
    style={{
      backgroundColor: value ? 'rgba(203,183,251,0.92)' : 'rgba(238,234,248,0.08)',
      borderColor: value ? C.lavender : 'rgba(238,234,248,0.18)',
    }}
  >
    <span className={`inline-block h-4 w-4 transform bg-white transition-transform shadow-sm ${value ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const Curriculum = () => {
  const { currentUser } = useAuth();
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
      <div className="op-page">
        <div className="op-shell flex min-h-[360px] items-center justify-center">
          <div className="h-7 w-7 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
        </div>
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
    <div className="op-page">
      <div className="op-shell space-y-6">
      <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <p className="op-eyebrow">Curriculum</p>
          <h1 className="op-title mt-3">Per-student subject library</h1>
          <p className="op-subtle mt-4 max-w-2xl text-[14px] font-body leading-6">
            Manage subject plans, learning resources, completion requirements, and the compatibility bridge into weekly planning.
          </p>
        </div>
        <button
          onClick={openCreateSubjectForm}
          disabled={!canAddCurriculumItem}
          className="op-button w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          {curriculumLimitReached ? 'Subject Limit Reached' : 'Add Subject'}
        </button>
      </section>

      <section className="op-panel-muted grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="max-w-3xl">
          <p className="op-eyebrow">Weekly Planning</p>
          <h2 className="mt-3 text-[24px] font-display leading-none text-white">
            Publish weekly blocks from the dedicated planner
          </h2>
          <p className="op-subtle mt-3 text-[13px] font-body leading-5">
            Curriculum remains the compatibility input path. After editing subject blocks or resources, reset the student-week in Weekly Blocking before saving or publishing.
          </p>
        </div>
        <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-button">
          <CalendarDays className="h-4 w-4" />
          Weekly Blocking
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="op-eyebrow mb-2">
            Compatibility Input Path
          </p>
          <h3 className="text-[26px] font-display text-white" style={{ lineHeight: 1 }}>
            Subject Editor
          </h3>
          <p className="op-subtle text-[14px] font-body mt-2">
            Subjects remain the source input for weekly-plan generation in this phase. New subjects are written per student; legacy shared records still render and can be edited in place.
          </p>
        </div>
        <button
          onClick={openCreateSubjectForm}
          disabled={!canAddCurriculumItem}
          className="op-button hidden sm:inline-flex"
        >
          <Plus className="w-4 h-4" />
          {curriculumLimitReached ? 'Subject Limit Reached' : 'Add Subject'}
        </button>
      </div>

      {curriculumLimitCheck && (
        <div
          className="op-panel-muted mb-6 px-4 py-3"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="op-eyebrow">
              Active Subject Usage
            </p>
            <span className="text-[12px] font-label text-[rgba(238,234,248,0.56)]">
              {curriculumLimitCheck.isUnlimited ? `${curriculumLimitCheck.usage} active` : `${curriculumLimitCheck.usage}/${curriculumLimitCheck.limit}`}
            </span>
          </div>
          <p className="op-subtle mt-1.5 text-[13px] font-body leading-5">
            {curriculumLimitMessage}
          </p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-3 sm:p-4">
          <div
            className="op-panel w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col overflow-hidden"
          >

            {/* Sticky header + step indicator */}
            <div className="sticky top-0 z-10 flex-shrink-0 bg-[#27273e]" style={{ borderBottom: '1px solid rgba(238,234,248,0.12)' }}>
              <div className="flex items-center justify-between px-6 pt-6 pb-3">
                <div>
                  <p className="op-eyebrow">Subject Editor</p>
                  <h2 className="mt-2 text-[24px] font-display leading-none text-white">
                    {editingSubject ? 'Edit Subject' : 'Add New Subject'}
                  </h2>
                  <p className="op-subtle text-[12px] font-body mt-2">
                    {STEPS[currentStep - 1].description}
                  </p>
                </div>
                <button onClick={resetForm} className="op-icon-button" title="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {!editingSubject && curriculumLimitCheck && (
                <div
                  className="op-panel-muted mx-6 mb-4 px-4 py-3"
                >
                  <p className="op-eyebrow">
                    Active Subject Limit
                  </p>
                  <p className="op-subtle mt-1.5 text-[13px] font-body leading-5">
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
                        <div className="w-6 h-6 flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: done ? 'rgba(203,183,251,0.92)' : active ? 'rgba(203,183,251,0.18)' : 'transparent',
                            border: `1.5px solid ${done || active ? C.lavender : 'rgba(238,234,248,0.18)'}`,
                            color: done ? '#1f1f32' : active ? C.lavender : 'rgba(238,234,248,0.44)',
                            fontSize: 11, fontWeight: 700
                          }}>
                          {done ? '✓' : n}
                        </div>
                        <span style={{ fontSize: 9, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: active ? 700 : 400, color: active ? C.lavender : 'rgba(238,234,248,0.44)', textAlign: 'center', lineHeight: 1.3 }}>
                          {step.label}
                        </span>
                      </div>
                      {idx < STEPS.length - 1 && (
                        <div style={{ flex: 1, height: 1.5, marginTop: 11, backgroundColor: n < currentStep ? C.lavender : 'rgba(238,234,248,0.16)' }} />
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
                  <div className="overflow-hidden max-h-48 overflow-y-auto border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)]">
                    {students.map((s) => (
                      <label key={s.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                        style={{ borderBottom: '1px solid rgba(238,234,248,0.1)' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(238,234,248,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}>
                        <input type="checkbox" checked={selectedStudents.includes(s.id)}
                          onChange={(e) => setSelectedStudents(e.target.checked ? [...selectedStudents, s.id] : selectedStudents.filter(id => id !== s.id))}
                          className="w-4 h-4 accent-amethyst-link" />
                        <span className="text-[14px] text-[rgba(238,234,248,0.78)] font-body">{s.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedStudents.length === 0
                    ? <p className="text-[12px] text-[#cbb7fb] mt-1.5">Select at least one student</p>
                    : <p className="op-subtle text-[12px] mt-1.5">{selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected</p>}
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
                      className="w-14 h-10 cursor-pointer bg-[#202034] p-1" style={{ border: '1px solid rgba(238,234,248,0.18)' }} />
                    <span className="text-[13px] text-[rgba(238,234,248,0.5)] font-mono">{subjectColor}</span>
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
                      <p className="text-[14px] font-body text-[rgba(250,249,255,0.9)]">Require Summary</p>
                      <p className="op-subtle mt-0.5 text-[12px]">
                        {requireSummary ? 'Students must write a summary (min. 150 characters)' : 'No summary required'}
                      </p>
                    </div>
                    <Toggle value={requireSummary} onChange={setRequireSummary} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-body text-[rgba(250,249,255,0.9)]">Require Timer</p>
                      <p className="op-subtle mt-0.5 text-[12px]">
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
                  <p className="op-subtle mb-3 text-[12px] font-body">Links or materials students can reference during a block</p>
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
                            className="self-start p-2 text-[rgba(238,234,248,0.38)] transition-colors hover:text-[rgba(250,249,255,0.92)] sm:self-auto">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={handleAddResource}
                      className="flex items-center gap-2 text-[13px] text-[#cbb7fb] hover:text-[#e0d5ff] font-body transition-colors">
                      <Plus className="w-4 h-4" /> Add Resource
                    </button>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(238,234,248,0.12)' }} />
                <div>
                  <label className={labelCls}>Custom Submission Fields</label>
                  <p className="op-subtle mb-3 text-[12px] font-body">Extra info requested from students on every block completion for this subject</p>
                  <div className="space-y-3">
                    {customFields.map((field, i) => (
                      <div key={field.id} className="op-surface p-4" style={{ borderLeft: '3px solid rgba(203,183,251,0.68)' }}>
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
                            <label className="text-[13px] text-[rgba(238,234,248,0.68)] font-body">Required</label>
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
                          className="mt-3 text-[12px] text-[rgba(238,234,248,0.44)] hover:text-[rgba(250,249,255,0.92)] font-body transition-colors">
                          Remove Field
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddCustomField}
                      className="flex items-center gap-2 text-[13px] text-[#cbb7fb] hover:text-[#e0d5ff] font-body transition-colors">
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
              <div className="sticky bottom-0 flex flex-shrink-0 gap-3 bg-[#27273e] p-4 sm:p-6" style={{ borderTop: '1px solid rgba(238,234,248,0.12)' }}>
                <button type="button"
                  onClick={currentStep === 1 ? resetForm : () => setCurrentStep(s => s - 1)}
                  className="op-button op-button-secondary flex-1">
                  {currentStep === 1 ? 'Cancel' : '← Back'}
                </button>
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={isCreateSubjectBlocked}
                  className="op-button flex-1 disabled:cursor-not-allowed">
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
        <div className="op-panel flex min-h-[360px] flex-col items-center justify-center px-6 py-16 text-center">
          <BookOpen className="w-10 h-10 text-[#cbb7fb] mx-auto mb-4" />
          <h3 className="text-[22px] font-display text-white mb-2">No subjects yet</h3>
          <p className="op-subtle text-[14px] font-body mb-6">Add your first per-student subject to get started.</p>
          <button onClick={openCreateSubjectForm}
            disabled={!canAddCurriculumItem}
            className="op-button disabled:cursor-not-allowed">
            <Plus className="w-4 h-4" /> {curriculumLimitReached ? 'Subject Limit Reached' : 'Add Your First Subject'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeSubjects.map((subject) => {
            const studentIds = subject.student_ids || [subject.student_id].filter(Boolean);
            const studentNames = studentIds.map(id => students.find(s => s.id === id)?.name || 'Unknown').join(', ');

            return (
              <div key={subject.id} className="op-surface p-5 transition-colors hover:bg-[#292942]">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-8 flex-shrink-0" style={{ backgroundColor: subject.color || '#3B82F6' }} />
                      <h3 className="text-[18px] font-display text-white truncate" style={{ lineHeight: 1.05 }}>
                        {subject.title}
                      </h3>
                    </div>
                    <p className="op-subtle text-[13px] font-body truncate">{studentNames || 'Unknown students'}</p>
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button onClick={() => handleEdit(subject)}
                      className="op-icon-button h-8 w-8" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => archiveSubject(subject.id)}
                      className="op-icon-button h-8 w-8" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSubject(subject.id)}
                      className="op-icon-button h-8 w-8" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="op-subtle text-[13px] font-body">Weekly Blocks</span>
                    <span className="text-[13px] font-display text-white">{subject.block_count || 10}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="op-subtle text-[13px] font-body">Block Length</span>
                    <span className="text-[13px] font-display text-white">{subject.block_length || 30} min</span>
                  </div>

                  {subject.resources && subject.resources.length > 0 && (
                    <div className="pt-3" style={{ borderTop: '1px solid rgba(238,234,248,0.12)' }}>
                      <p className="op-eyebrow mb-2">Resources</p>
                      <div className="space-y-1.5">
                        {subject.resources.map((r, i) => (
                          <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[13px] text-[#cbb7fb] hover:text-[#e0d5ff] font-body transition-colors">
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
    </div>
  );
};

export default Curriculum;
