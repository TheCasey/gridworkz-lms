import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';
import { BookOpen, Plus, Trash2, Archive, Edit, ExternalLink, X } from 'lucide-react';

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
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
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

  const db = getFirestore(app);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'students'), where('parent_id', '==', currentUser.uid), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [currentUser, db]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, 'subjects'), where('parent_id', '==', currentUser.uid), orderBy('title'));
    const unsub = onSnapshot(q, (snap) => {
      setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [currentUser, db]);

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
      if (expandedObjectiveBlock === blockIndex) setExpandedObjectiveBlock(null);
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
        ...prev[blockIndex],
        custom_fields: [...(prev[blockIndex].custom_fields || []), { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: false }]
      }
    }));
  };
  const handleRemoveObjectiveCustomField = (blockIndex, fieldId) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: { ...prev[blockIndex], custom_fields: prev[blockIndex].custom_fields.filter(f => f.id !== fieldId) }
    }));
  };
  const handleObjectiveCustomFieldChange = (blockIndex, fieldId, key, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...prev[blockIndex],
        custom_fields: prev[blockIndex].custom_fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
      }
    }));
  };

  const handleToggleStudentOverride = (blockIndex, studentId) => {
    const overrideKey = `${blockIndex}_${studentId}`;
    if (blockObjectives[blockIndex]?.student_overrides?.[studentId]) {
      setBlockObjectives(prev => {
        const overrides = { ...(prev[blockIndex].student_overrides || {}) };
        delete overrides[studentId];
        return { ...prev, [blockIndex]: { ...prev[blockIndex], student_overrides: overrides } };
      });
      setExpandedStudentOverrides(prev => { const next = { ...prev }; delete next[overrideKey]; return next; });
    } else {
      setBlockObjectives(prev => ({
        ...prev, [blockIndex]: {
          ...prev[blockIndex],
          student_overrides: { ...(prev[blockIndex].student_overrides || {}), [studentId]: { instruction: '', custom_fields: [] } }
        }
      }));
      setExpandedStudentOverrides(prev => ({ ...prev, [overrideKey]: true }));
    }
  };
  const handleStudentOverrideChange = (blockIndex, studentId, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...prev[blockIndex],
        student_overrides: {
          ...(prev[blockIndex].student_overrides || {}),
          [studentId]: { ...(prev[blockIndex].student_overrides?.[studentId] || {}), instruction: value }
        }
      }
    }));
  };
  const handleAddStudentOverrideCustomField = (blockIndex, studentId) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...prev[blockIndex],
        student_overrides: {
          ...(prev[blockIndex].student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex].student_overrides?.[studentId] || {}),
            custom_fields: [
              ...(prev[blockIndex].student_overrides?.[studentId]?.custom_fields || []),
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
        ...prev[blockIndex],
        student_overrides: {
          ...(prev[blockIndex].student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex].student_overrides?.[studentId] || {}),
            custom_fields: (prev[blockIndex].student_overrides?.[studentId]?.custom_fields || []).filter(f => f.id !== fieldId)
          }
        }
      }
    }));
  };
  const handleStudentOverrideCustomFieldChange = (blockIndex, studentId, fieldId, key, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...prev[blockIndex],
        student_overrides: {
          ...(prev[blockIndex].student_overrides || {}),
          [studentId]: {
            ...(prev[blockIndex].student_overrides?.[studentId] || {}),
            custom_fields: (prev[blockIndex].student_overrides?.[studentId]?.custom_fields || []).map(f => f.id === fieldId ? { ...f, [key]: value } : f)
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

  const resetForm = () => {
    setSelectedStudents([]); setSubjectName(''); setTotalBlocks(10); setBlockLength(30);
    setSubjectColor('#3B82F6'); setRequireSummary(true); setResources([{ name: '', url: '' }]);
    setCustomFields([]); setRequireTimer(false); setBlockObjectives({}); setExpandedObjectiveBlock(null);
    setExpandedStudentOverrides({}); setCurrentStep(1); setShowAddForm(false); setEditingSubject(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentStep < STEPS.length) { handleNext(); return; }
    if (!selectedStudents.length || !subjectName.trim()) {
      alert('Please select at least one student and enter a subject name');
      return;
    }
    try {
      const data = {
        student_ids: selectedStudents,
        parent_id: currentUser.uid,
        title: subjectName.trim(),
        block_count: totalBlocks,
        block_length: blockLength,
        color: subjectColor,
        resources: resources.filter(r => r.name.trim()),
        require_input: requireSummary,
        custom_fields: customFields.filter(f => f.label.trim()),
        require_timer: requireTimer,
        block_objectives: Object.fromEntries(
          Object.entries(blockObjectives)
            .filter(([, obj]) => {
              if (obj.instruction.trim()) return true;
              return Object.values(obj.student_overrides || {}).some(ov => ov.instruction.trim());
            })
            .map(([k, obj]) => {
              const cleanedOverrides = Object.fromEntries(
                Object.entries(obj.student_overrides || {})
                  .filter(([, ov]) => ov.instruction.trim())
                  .map(([sid, ov]) => [sid, { instruction: ov.instruction, custom_fields: (ov.custom_fields || []).filter(f => f.label.trim()) }])
              );
              return [k, {
                instruction: obj.instruction,
                custom_fields: (obj.custom_fields || []).filter(f => f.label.trim()),
                student_overrides: cleanedOverrides
              }];
            })
        ),
        is_active: true,
        updated_at: serverTimestamp()
      };
      if (editingSubject) {
        await updateDoc(doc(db, 'subjects', editingSubject.id), data);
      } else {
        await addDoc(collection(db, 'subjects'), { ...data, created_at: serverTimestamp() });
      }
      resetForm();
    } catch (err) {
      console.error('Error saving subject:', err);
      alert('Failed to save subject. Please try again.');
    }
  };

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

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try { await deleteDoc(doc(db, 'subjects', id)); }
      catch (err) { alert('Failed to delete subject.'); }
    }
  };

  const handleArchive = async (id) => {
    try { await updateDoc(doc(db, 'subjects', id), { is_active: false, updated_at: serverTimestamp() }); }
    catch (err) { alert('Failed to archive subject.'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: C.lavender }} />
      </div>
    );
  }

  const activeSubjects = subjects.filter(s => s.is_active);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-[26px] font-display text-charcoal-ink" style={{ lineHeight: 1.1, letterSpacing: '-0.5px' }}>Curriculum</h2>
          <p className="text-[14px] text-charcoal-ink/50 font-body mt-1">Manage subjects and learning resources</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
          style={{ backgroundColor: C.charcoal, color: '#ffffff' }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" style={{ border: `1px solid ${C.parchment}` }}>

            {/* Sticky header + step indicator */}
            <div className="sticky top-0 bg-white z-10" style={{ borderBottom: `1px solid ${C.parchment}` }}>
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">

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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Blocks per Week</label>
                    <input type="number" min="1" max="20" value={totalBlocks}
                      onChange={(e) => setTotalBlocks(parseInt(e.target.value))}
                      className={inputCls} style={inputStyle}
                      onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                      onBlur={e => Object.assign(e.currentTarget.style, inputStyle)} />
                  </div>
                  <div>
                    <label className={labelCls}>Block Length (min)</label>
                    <input type="number" min="5" max="120" step="5" value={blockLength}
                      onChange={(e) => setBlockLength(parseInt(e.target.value))}
                      className={inputCls} style={inputStyle}
                      onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                      onBlur={e => Object.assign(e.currentTarget.style, inputStyle)} />
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
                      <div key={i} className="flex gap-2">
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
                            className="p-2 text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
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
                        <div className="grid grid-cols-2 gap-3 mb-3">
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
                          <div className="flex items-center gap-2 mt-6">
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
                <div>
                  <p className="text-[13px] text-charcoal-ink/50 font-body mb-4">
                    Attach specific instructions to individual blocks. Students see these as guided blocks with a dot indicator. Leave blocks blank for independent learning.
                  </p>
                  <div className="space-y-2">
                    {Array.from({ length: totalBlocks }, (_, i) => {
                      const obj = blockObjectives[i];
                      const isExpanded = expandedObjectiveBlock === i;
                      return (
                        <div key={i} className="rounded-lg overflow-hidden" style={{ border: `1px solid ${obj ? C.lavender : C.parchment}` }}>
                          <div className="flex items-center justify-between px-4 py-2.5"
                            style={{ backgroundColor: obj ? `${C.lavender}22` : '#faf9f8', cursor: obj ? 'pointer' : 'default' }}
                            onClick={() => { if (obj) setExpandedObjectiveBlock(isExpanded ? null : i); }}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-[13px] font-body flex-shrink-0" style={{ color: C.charcoal }}>Block {i + 1}</span>
                              {obj && <span className="text-[11px] px-2 py-0.5 rounded-full font-label flex-shrink-0" style={{ backgroundColor: C.lavender, color: C.charcoal }}>Guided</span>}
                              {obj?.instruction && <span className="text-[12px] text-charcoal-ink/40 font-body truncate">{obj.instruction}</span>}
                              {obj && !obj.instruction && Object.keys(obj.student_overrides || {}).length > 0 && (
                                <span className="text-[12px] text-charcoal-ink/40 font-body">{Object.keys(obj.student_overrides).length} student override{Object.keys(obj.student_overrides).length > 1 ? 's' : ''}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-3" onClick={e => e.stopPropagation()}>
                              {obj ? (
                                <button type="button" onClick={() => handleToggleObjective(i)}
                                  className="text-[12px] text-charcoal-ink/40 hover:text-charcoal-ink font-body transition-colors">Remove</button>
                              ) : (
                                <button type="button" onClick={() => handleToggleObjective(i)}
                                  className="flex items-center gap-1 text-[12px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                                  <Plus className="w-3.5 h-3.5" /> Add Objective
                                </button>
                              )}
                            </div>
                          </div>
                          {obj && isExpanded && (
                            <div className="p-4 space-y-4" style={{ borderTop: `1px solid ${C.lavender}44` }}>
                              <div>
                                <label className={labelCls}>Shared Instruction</label>
                                <p className="text-[11px] text-charcoal-ink/40 mb-2 font-body">Applies to all assigned students unless overridden below</p>
                                <textarea value={obj.instruction} onChange={(e) => handleObjectiveChange(i, e.target.value)}
                                  className="w-full px-3 py-2.5 rounded-lg text-[14px] focus:outline-none transition-colors resize-none bg-white font-body"
                                  style={{ border: `1px solid ${C.parchment}`, color: C.charcoal }}
                                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                  rows={2} placeholder="e.g., Play a chess game with your sibling" />
                              </div>
                              <div>
                                <label className={labelCls}>Block-Specific Feedback Fields</label>
                                <p className="text-[11px] text-charcoal-ink/40 mb-2.5 font-body">If set, replaces subject-level fields for this block.</p>
                                <div className="space-y-2">
                                  {(obj.custom_fields || []).map((field) => (
                                    <div key={field.id} className="rounded-lg p-3 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                        <select value={field.type} onChange={(e) => handleObjectiveCustomFieldChange(i, field.id, 'type', e.target.value)}
                                          className={inputCls} style={inputStyle}
                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}>
                                          <option value="text">Text Input</option>
                                          <option value="number">Number Input</option>
                                          <option value="file">File Upload</option>
                                        </select>
                                        <div className="flex items-center gap-2 mt-2">
                                          <input type="checkbox" checked={field.required}
                                            onChange={(e) => handleObjectiveCustomFieldChange(i, field.id, 'required', e.target.checked)}
                                            className="w-4 h-4 accent-amethyst-link" />
                                          <label className="text-[13px] text-charcoal-ink/60 font-body">Required</label>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <input type="text" value={field.label} onChange={(e) => handleObjectiveCustomFieldChange(i, field.id, 'label', e.target.value)}
                                          className={inputCls} style={inputStyle}
                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                          placeholder="Field label" />
                                        <input type="text" value={field.placeholder} onChange={(e) => handleObjectiveCustomFieldChange(i, field.id, 'placeholder', e.target.value)}
                                          className={inputCls} style={inputStyle}
                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                          placeholder="Helper text for the student" />
                                      </div>
                                      <button type="button" onClick={() => handleRemoveObjectiveCustomField(i, field.id)}
                                        className="mt-2 text-[12px] text-charcoal-ink/40 hover:text-charcoal-ink font-body transition-colors">Remove Field</button>
                                    </div>
                                  ))}
                                  <button type="button" onClick={() => handleAddObjectiveCustomField(i)}
                                    className="flex items-center gap-1.5 text-[12px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Add Feedback Field
                                  </button>
                                </div>
                              </div>
                              {selectedStudents.length > 1 && (
                                <div>
                                  <label className={labelCls}>Per-Student Overrides</label>
                                  <p className="text-[11px] text-charcoal-ink/40 mb-2.5 font-body">Replace this block's instruction for a specific student.</p>
                                  <div className="space-y-2">
                                    {selectedStudents.map(studentId => {
                                      const st = students.find(s => s.id === studentId);
                                      if (!st) return null;
                                      const override = obj.student_overrides?.[studentId];
                                      const overrideExpanded = expandedStudentOverrides[`${i}_${studentId}`];
                                      return (
                                        <div key={studentId} className="rounded-lg overflow-hidden"
                                          style={{ border: `1px solid ${override ? C.amethyst + '55' : C.parchment}` }}>
                                          <div className="flex items-center justify-between px-3 py-2"
                                            style={{ backgroundColor: override ? `${C.amethyst}0d` : '#faf9f8', cursor: override ? 'pointer' : 'default' }}
                                            onClick={() => { if (override) setExpandedStudentOverrides(prev => ({ ...prev, [`${i}_${studentId}`]: !prev[`${i}_${studentId}`] })); }}>
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="text-[13px] font-body flex-shrink-0" style={{ color: C.charcoal }}>{st.name}</span>
                                              {override && <span className="text-[11px] px-1.5 py-0.5 rounded-full font-label flex-shrink-0" style={{ backgroundColor: `${C.amethyst}22`, color: C.amethyst }}>Override</span>}
                                              {override?.instruction && <span className="text-[12px] text-charcoal-ink/40 font-body truncate">{override.instruction}</span>}
                                            </div>
                                            <div onClick={e => e.stopPropagation()}>
                                              {override ? (
                                                <button type="button" onClick={() => handleToggleStudentOverride(i, studentId)}
                                                  className="text-[12px] text-charcoal-ink/40 hover:text-charcoal-ink font-body transition-colors">Remove</button>
                                              ) : (
                                                <button type="button" onClick={() => handleToggleStudentOverride(i, studentId)}
                                                  className="flex items-center gap-1 text-[12px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                                                  <Plus className="w-3 h-3" /> Override
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                          {override && overrideExpanded && (
                                            <div className="p-3 space-y-3" style={{ borderTop: `1px solid ${C.amethyst}22` }}>
                                              <div>
                                                <label className={labelCls}>Instruction for {st.name}</label>
                                                <textarea value={override.instruction} onChange={(e) => handleStudentOverrideChange(i, studentId, e.target.value)}
                                                  className="w-full px-3 py-2.5 rounded-lg text-[14px] focus:outline-none transition-colors resize-none bg-white font-body"
                                                  style={{ border: `1px solid ${C.parchment}`, color: C.charcoal }}
                                                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                                  rows={2} placeholder={`Specific instruction for ${st.name}...`} />
                                              </div>
                                              <div>
                                                <label className={labelCls}>Feedback Fields for {st.name}</label>
                                                <p className="text-[11px] text-charcoal-ink/40 mb-2 font-body">If set, overrides block-level fields for {st.name} only.</p>
                                                <div className="space-y-2">
                                                  {(override.custom_fields || []).map((field) => (
                                                    <div key={field.id} className="rounded-lg p-3 bg-white" style={{ border: `1px solid ${C.parchment}` }}>
                                                      <div className="grid grid-cols-2 gap-2 mb-2">
                                                        <select value={field.type} onChange={(e) => handleStudentOverrideCustomFieldChange(i, studentId, field.id, 'type', e.target.value)}
                                                          className={inputCls} style={inputStyle}
                                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}>
                                                          <option value="text">Text Input</option>
                                                          <option value="number">Number Input</option>
                                                          <option value="file">File Upload</option>
                                                        </select>
                                                        <div className="flex items-center gap-2 mt-2">
                                                          <input type="checkbox" checked={field.required}
                                                            onChange={(e) => handleStudentOverrideCustomFieldChange(i, studentId, field.id, 'required', e.target.checked)}
                                                            className="w-4 h-4 accent-amethyst-link" />
                                                          <label className="text-[13px] text-charcoal-ink/60 font-body">Required</label>
                                                        </div>
                                                      </div>
                                                      <div className="space-y-2">
                                                        <input type="text" value={field.label} onChange={(e) => handleStudentOverrideCustomFieldChange(i, studentId, field.id, 'label', e.target.value)}
                                                          className={inputCls} style={inputStyle}
                                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                                          placeholder="Field label" />
                                                        <input type="text" value={field.placeholder} onChange={(e) => handleStudentOverrideCustomFieldChange(i, studentId, field.id, 'placeholder', e.target.value)}
                                                          className={inputCls} style={inputStyle}
                                                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                                                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                                                          placeholder="Helper text for the student" />
                                                      </div>
                                                      <button type="button" onClick={() => handleRemoveStudentOverrideCustomField(i, studentId, field.id)}
                                                        className="mt-2 text-[12px] text-charcoal-ink/40 hover:text-charcoal-ink font-body transition-colors">Remove Field</button>
                                                    </div>
                                                  ))}
                                                  <button type="button" onClick={() => handleAddStudentOverrideCustomField(i, studentId)}
                                                    className="flex items-center gap-1.5 text-[12px] text-amethyst-link hover:text-[#5c3d9e] font-body transition-colors">
                                                    <Plus className="w-3.5 h-3.5" /> Add Field
                                                  </button>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step navigation */}
              <div className="flex gap-3 pt-2" style={{ borderTop: `1px solid ${C.parchment}` }}>
                <button type="button"
                  onClick={currentStep === 1 ? resetForm : () => setCurrentStep(s => s - 1)}
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                  {currentStep === 1 ? 'Cancel' : '← Back'}
                </button>
                <button
                  type={currentStep === STEPS.length ? 'submit' : 'button'}
                  onClick={currentStep === STEPS.length ? undefined : handleNext}
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
                  style={{ backgroundColor: C.charcoal, color: '#ffffff' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                  {currentStep === STEPS.length ? (editingSubject ? 'Update Subject' : 'Add Subject') : 'Next →'}
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
          <button onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
            style={{ backgroundColor: C.charcoal, color: '#ffffff' }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
            <Plus className="w-4 h-4" /> Add Your First Subject
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
                    <button onClick={() => handleArchive(subject.id)}
                      className="p-1.5 text-charcoal-ink/30 hover:text-charcoal-ink transition-colors" title="Archive">
                      <Archive className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(subject.id)}
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
