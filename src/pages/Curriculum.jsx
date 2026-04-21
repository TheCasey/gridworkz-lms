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

  const resetForm = () => {
    setSelectedStudents([]); setSubjectName(''); setTotalBlocks(10); setBlockLength(30);
    setSubjectColor('#3B82F6'); setRequireSummary(true); setResources([{ name: '', url: '' }]);
    setCustomFields([]); setRequireTimer(false); setShowAddForm(false); setEditingSubject(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            <div className="flex items-center justify-between p-6 sticky top-0 bg-white z-10" style={{ borderBottom: `1px solid ${C.parchment}` }}>
              <h2 className="text-[18px] font-display text-charcoal-ink">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <button onClick={resetForm} className="text-charcoal-ink/30 hover:text-charcoal-ink transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Students */}
              <div>
                <label className={labelCls}>Students *</label>
                <div className="rounded-lg overflow-hidden max-h-48 overflow-y-auto" style={{ border: `1px solid ${C.parchment}` }}>
                  {students.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                      style={{ borderBottom: `1px solid ${C.parchment}` }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = C.cream}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = ''}
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(s.id)}
                        onChange={(e) => setSelectedStudents(e.target.checked
                          ? [...selectedStudents, s.id]
                          : selectedStudents.filter(id => id !== s.id)
                        )}
                        className="w-4 h-4 accent-amethyst-link"
                      />
                      <span className="text-[14px] text-charcoal-ink font-body">{s.name}</span>
                    </label>
                  ))}
                </div>
                {selectedStudents.length === 0 && (
                  <p className="text-[12px] text-amethyst-link mt-1.5">Please select at least one student</p>
                )}
                {selectedStudents.length > 0 && (
                  <p className="text-[12px] text-charcoal-ink/40 mt-1.5">
                    {selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              {/* Subject Name */}
              <div>
                <label className={labelCls}>Subject Name *</label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className={inputCls}
                  style={inputStyle}
                  onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                  placeholder="e.g., 6th Grade Math"
                  required
                />
              </div>

              {/* Blocks & Length */}
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

              {/* Color */}
              <div>
                <label className={labelCls}>Subject Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={subjectColor}
                    onChange={(e) => setSubjectColor(e.target.value)}
                    className="w-14 h-10 rounded-lg cursor-pointer p-0.5 bg-white"
                    style={{ border: `1px solid ${C.parchment}` }} />
                  <span className="text-[13px] text-charcoal-ink/50 font-mono">{subjectColor}</span>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-body text-charcoal-ink">Require Summary</p>
                    <p className="text-[12px] text-charcoal-ink/40 mt-0.5">
                      {requireSummary ? 'Students must write a summary' : 'No summary required'}
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

              {/* Resources */}
              <div>
                <label className={labelCls}>Resource Links</label>
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

              {/* Custom Fields */}
              <div>
                <label className={labelCls}>Custom Submission Fields</label>
                <p className="text-[12px] text-charcoal-ink/40 mb-3 font-body">Add fields students must complete when finishing a block</p>
                <div className="space-y-3">
                  {customFields.map((field, i) => (
                    <div key={field.id} className="rounded-lg p-4 bg-[#faf9f8]" style={{ border: `1px solid ${C.parchment}` }}>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className={labelCls}>Field Type</label>
                          <select value={field.type}
                            onChange={(e) => handleCustomFieldChange(i, 'type', e.target.value)}
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
                        <input type="text" value={field.label}
                          onChange={(e) => handleCustomFieldChange(i, 'label', e.target.value)}
                          className={inputCls} style={inputStyle}
                          onFocus={e => Object.assign(e.currentTarget.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.currentTarget.style, inputStyle)}
                          placeholder="Field label (e.g., 'Which chapters did you read?')" />
                        <input type="text" value={field.placeholder}
                          onChange={(e) => handleCustomFieldChange(i, 'placeholder', e.target.value)}
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

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
                  style={{ backgroundColor: C.cream, color: C.charcoal }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = C.parchment}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.cream}>
                  Cancel
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2.5 rounded-lg font-label text-[14px] transition-colors"
                  style={{ backgroundColor: C.charcoal, color: '#ffffff' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#3a3937'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = C.charcoal}>
                  {editingSubject ? 'Update Subject' : 'Add Subject'}
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
