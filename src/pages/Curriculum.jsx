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
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Archive, 
  Edit, 
  ExternalLink, 
  Save,
  X,
  Palette
} from 'lucide-react';

const Curriculum = () => {
  const { currentUser } = useAuth();
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  
  // Form state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [totalBlocks, setTotalBlocks] = useState(10);
  const [blockLength, setBlockLength] = useState(30);
  const [subjectColor, setSubjectColor] = useState('#3B82F6');
  const [requireSummary, setRequireSummary] = useState(true);
  const [resources, setResources] = useState([{ name: '', url: '' }]);
  
  const db = getFirestore(app);

  // Fetch students
  useEffect(() => {
    if (!currentUser) return;

    const studentsQuery = query(
      collection(db, 'students'),
      where('parent_id', '==', currentUser.uid),
      orderBy('name')
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      const studentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStudents(studentsData);
    }, (error) => {
      console.error('Error fetching students:', error);
    });

    return unsubscribeStudents;
  }, [currentUser, db]);

  // Fetch subjects
  useEffect(() => {
    if (!currentUser) return;

    const subjectsQuery = query(
      collection(db, 'subjects'),
      where('parent_id', '==', currentUser.uid),
      orderBy('student_name'),
      orderBy('title')
    );

    const unsubscribeSubjects = onSnapshot(subjectsQuery, (snapshot) => {
      const subjectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSubjects(subjectsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching subjects:', error);
      setLoading(false);
    });

    return unsubscribeSubjects;
  }, [currentUser, db]);

  const handleAddResource = () => {
    setResources([...resources, { name: '', url: '' }]);
  };

  const handleRemoveResource = (index) => {
    const newResources = resources.filter((_, i) => i !== index);
    setResources(newResources);
  };

  const handleResourceChange = (index, field, value) => {
    const newResources = [...resources];
    newResources[index][field] = value;
    setResources(newResources);
  };

  const resetForm = () => {
    setSelectedStudent('');
    setSubjectName('');
    setTotalBlocks(10);
    setBlockLength(30);
    setSubjectColor('#3B82F6');
    setRequireSummary(true);
    setResources([{ name: '', url: '' }]);
    setShowAddForm(false);
    setEditingSubject(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedStudent || !subjectName.trim()) {
      alert('Please select a student and enter a subject name');
      return;
    }

    const selectedStudentData = students.find(s => s.id === selectedStudent);
    
    try {
      const subjectData = {
        student_id: selectedStudent,
        student_name: selectedStudentData.name,
        parent_id: currentUser.uid,
        title: subjectName.trim(),
        block_count: totalBlocks,
        block_length: blockLength,
        completed_blocks: 0,
        color: subjectColor,
        resources: resources.filter(r => r.name.trim() && r.url.trim()),
        require_input: requireSummary,
        is_active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };

      if (editingSubject) {
        // Update existing subject
        const subjectRef = doc(db, 'subjects', editingSubject.id);
        await updateDoc(subjectRef, {
          ...subjectData,
          updated_at: serverTimestamp()
        });
      } else {
        // Create new subject
        await addDoc(collection(db, 'subjects'), subjectData);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving subject:', error);
      alert('Failed to save subject. Please try again.');
    }
  };

  const handleEdit = (subject) => {
    setSelectedStudent(subject.student_id);
    setSubjectName(subject.title);
    setTotalBlocks(subject.block_count || 10);
    setBlockLength(subject.block_length || 30);
    setSubjectColor(subject.color || '#3B82F6');
    setRequireSummary(subject.require_input !== false);
    setResources(subject.resources || [{ name: '', url: '' }]);
    setEditingSubject(subject);
    setShowAddForm(true);
  };

  const handleDelete = async (subjectId) => {
    if (window.confirm('Are you sure you want to delete this subject?')) {
      try {
        await deleteDoc(doc(db, 'subjects', subjectId));
      } catch (error) {
        console.error('Error deleting subject:', error);
        alert('Failed to delete subject. Please try again.');
      }
    }
  };

  const handleArchive = async (subjectId) => {
    try {
      const subjectRef = doc(db, 'subjects', subjectId);
      await updateDoc(subjectRef, {
        is_active: false,
        updated_at: serverTimestamp()
      });
    } catch (error) {
      console.error('Error archiving subject:', error);
      alert('Failed to archive subject. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Curriculum Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage subjects and learning resources for your students</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Subject
        </button>
      </div>

      {/* Add/Edit Subject Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">
                {editingSubject ? 'Edit Subject' : 'Add New Subject'}
              </h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Student Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Student *
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select a student</option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject Name *
                </label>
                <input
                  type="text"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 6th Grade Math"
                  required
                />
              </div>

              {/* Total Blocks per Week */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Blocks per Week
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={totalBlocks}
                  onChange={(e) => setTotalBlocks(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Block Length */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Block Length (minutes)
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  step="5"
                  value={blockLength}
                  onChange={(e) => setBlockLength(parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Subject Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={subjectColor}
                    onChange={(e) => setSubjectColor(e.target.value)}
                    className="w-16 h-10 border border-slate-300 rounded cursor-pointer"
                  />
                  <span className="text-sm text-slate-600">{subjectColor}</span>
                </div>
              </div>

              {/* Require Summary Toggle */}
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Require Summary</span>
                  <button
                    type="button"
                    onClick={() => setRequireSummary(!requireSummary)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      requireSummary ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        requireSummary ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  {requireSummary 
                    ? 'Students must write a summary for each block' 
                    : 'Students can complete blocks without a summary'
                  }
                </p>
              </div>

              {/* Resources */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Resource Links
                </label>
                <div className="space-y-3">
                  {resources.map((resource, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={resource.name}
                        onChange={(e) => handleResourceChange(index, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Resource name (e.g., Math Login)"
                      />
                      <input
                        type="url"
                        value={resource.url}
                        onChange={(e) => handleResourceChange(index, 'url', e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="https://example.com"
                      />
                      {resources.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveResource(index)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddResource}
                    className="flex items-center gap-2 px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Add Resource
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
                >
                  {editingSubject ? (
                    <>
                      <Save className="w-4 h-4 inline mr-2" />
                      Update Subject
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 inline mr-2" />
                      Add Subject
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Subjects List */}
      {subjects.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No subjects yet</h3>
          <p className="text-slate-500 mb-6">Add your first subject to get started with curriculum management</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Your First Subject
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects.filter(subject => subject.is_active).map((subject) => (
            <div key={subject.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: subject.color || '#3B82F6' }}
                    />
                    <h3 className="text-lg font-semibold text-slate-900">
                      {subject.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-500">{subject.student_name}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(subject)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleArchive(subject.id)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(subject.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Weekly Blocks</span>
                  <span className="font-medium">{subject.block_count || 10}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Block Length</span>
                  <span className="font-medium">{subject.block_length || 30} min</span>
                </div>

                {subject.resources && subject.resources.length > 0 && (
                  <div className="pt-3 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-700 mb-2">Resources</p>
                    <div className="space-y-2">
                      {subject.resources.map((resource, index) => (
                        <a
                          key={index}
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {resource.name}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Curriculum;
