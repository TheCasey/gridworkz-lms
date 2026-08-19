import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Check,
  Clipboard,
  Eye,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { buildPublicUrl } from '../../utils/appHosts';

const buildPortalUrl = (student) => {
  const publicStudentPath = buildPublicUrl(`/student/${student.slug}`);
  return publicStudentPath.startsWith('/')
    ? `${window.location.origin}${publicStudentPath}`
    : publicStudentPath;
};

const getCredentialMeta = (student) => {
  if (student?.portal_credential_type === 'password' || student?.access_password_set) {
    return {
      detail: 'Password protected',
      label: 'Password',
      tone: 'ready',
    };
  }

  if (student?.access_pin) {
    return {
      detail: `${String(student.access_pin).length}-digit PIN`,
      label: 'PIN',
      tone: 'ready',
    };
  }

  return {
    detail: 'Credential not set',
    label: 'Not set',
    tone: 'warning',
  };
};

const StudentsRoute = () => {
  const {
    canAddStudent,
    handleDeleteStudent,
    handleViewChoresProgress,
    handleViewSchoolProgress,
    loading,
    openAddStudentModal,
    studentLimitReached,
    students,
    subjects,
  } = useOutletContext();

  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [copiedStudentId, setCopiedStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  useEffect(() => {
    if (students.length === 0) {
      setSelectedStudentId('');
      return;
    }

    if (!students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [selectedStudentId, students]);

  const selectedStudent = useMemo(() => (
    students.find((student) => student.id === selectedStudentId) || students[0] || null
  ), [selectedStudentId, students]);

  const selectedStudentSubjects = useMemo(() => {
    if (!selectedStudent) return [];

    return subjects.filter((subject) => {
      if (Array.isArray(subject.student_ids)) {
        return subject.student_ids.includes(selectedStudent.id);
      }

      return subject.student_id === selectedStudent.id;
    });
  }, [selectedStudent, subjects]);

  const protectedStudents = students.filter((student) => student.access_pin || student.access_password_set).length;
  const unprotectedStudents = Math.max(0, students.length - protectedStudents);
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;
    return students.filter((student) => (
      student.name?.toLowerCase().includes(query)
      || student.slug?.toLowerCase().includes(query)
    ));
  }, [studentSearch, students]);

  const handleCopyPortal = async (student) => {
    try {
      await navigator.clipboard.writeText(buildPortalUrl(student));
      setCopiedStudentId(student.id);
      window.setTimeout(() => setCopiedStudentId(''), 1800);
    } catch (error) {
      console.error('Failed to copy student portal link:', error);
    }
  };

  return (
    <div className="op-page">
      <div className="op-proto-shell">
        <div className="op-proto-topbar">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-label text-white">
              Students <span className="ml-2 text-[10px] font-normal text-[rgba(238,234,248,0.42)]">parent-managed portal access</span>
            </p>
          </div>
          <div className="hidden min-w-[170px] md:block">
            <div className="mb-1 flex items-center justify-between text-[9px] text-[rgba(238,234,248,0.48)]">
              <strong className="font-label text-[rgba(238,234,248,0.78)]">{students.length} active</strong>
              <span>{protectedStudents} secured</span>
            </div>
            <div className="h-1 bg-[rgba(255,255,255,0.1)]">
              <div
                className="h-1 bg-[#7c6fd4]"
                style={{ width: `${students.length ? Math.min(100, (protectedStudents / students.length) * 100) : 0}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={openAddStudentModal}
            disabled={!canAddStudent}
            className="op-proto-btn op-proto-btn-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            {studentLimitReached ? 'Limit reached' : 'Add student'}
          </button>
        </div>
        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : students.length === 0 ? (
          <section className="op-proto-empty">
            <Users className="h-9 w-9 text-[#cbb7fb]" />
            <h2 className="mt-5 text-[18px] font-label text-white">No students yet</h2>
            <p className="mt-3 max-w-md text-[12px] leading-5 text-[rgba(238,234,248,0.54)]">
              Add the first student to create their portal and begin assigning subjects.
            </p>
            <button
              type="button"
              onClick={openAddStudentModal}
              disabled={!canAddStudent}
              className="op-proto-btn op-proto-btn-primary mt-6"
            >
              <Plus className="h-3.5 w-3.5" />
              {studentLimitReached ? 'Student limit reached' : 'Add first student'}
            </button>
          </section>
        ) : (
          <div className="op-student-frame">
            <aside className="op-student-list-pane">
              <div className="op-pane-head">
                <p className="op-pane-title">Roster</p>
                <p className="op-pane-meta">{filteredStudents.length}/{students.length} students</p>
              </div>
              <div className="px-3 pt-3">
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  className="op-compact-search"
                  placeholder="Search students..."
                />
              </div>
              <div className="op-student-list">
                {filteredStudents.map((student) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const credential = getCredentialMeta(student);
                    const subjectCount = subjects.filter((subject) => {
                      if (Array.isArray(subject.student_ids)) return subject.student_ids.includes(student.id);
                      return subject.student_id === student.id;
                    }).length;

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`op-student-row ${isSelected ? 'is-active' : ''}`}
                      >
                        <div className="op-student-avatar">
                          {student.name?.charAt(0)?.toUpperCase() || <UserRound className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-label text-white">{student.name}</p>
                          <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">/student/{student.slug}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <span className="op-weekly-block-type">
                              {credential.tone === 'ready' ? <ShieldCheck className="inline h-2.5 w-2.5" /> : <KeyRound className="inline h-2.5 w-2.5" />}
                              {' '}
                            {credential.label}
                          </span>
                            <span className="op-weekly-field-count">{subjectCount} subj</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </aside>

            {selectedStudent ? (
              <section className="op-student-detail-pane">
                <div className="op-student-detail-head">
                  <div className="op-student-avatar h-11 w-11 text-[16px]">
                    {selectedStudent.name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[20px] font-label text-white">{selectedStudent.name}</h2>
                    <p className="mt-1 truncate text-[11px] text-[rgba(238,234,248,0.48)]">
                      /student/{selectedStudent.slug} · {getCredentialMeta(selectedStudent).detail}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <span className="op-weekly-block-type">Counts toward plan</span>
                    <span className="op-weekly-block-type is-guided">Active</span>
                  </div>
                </div>

                <div className="op-student-detail-body">
                  <div className="space-y-1">
                    <section className="op-proto-section">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-label text-white">Student summary</p>
                          <p className="mt-1 text-[10px] text-[rgba(238,234,248,0.42)]">compact setup preview</p>
                        </div>
                      </div>
                      <div className="op-mini-stat-grid">
                        <div className="op-mini-stat"><div className="num">{selectedStudentSubjects.length}</div><div className="lab">subjects</div></div>
                        <div className="op-mini-stat"><div className="num">{selectedStudentSubjects.reduce((sum, subject) => sum + Number(subject.block_count || subject.total_blocks || 0), 0)}</div><div className="lab">weekly blocks</div></div>
                        <div className="op-mini-stat"><div className="num">{getCredentialMeta(selectedStudent).label}</div><div className="lab">credential</div></div>
                      </div>
                    </section>

                    <section className="op-proto-section blue">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[12px] font-label text-white">Portal link</p>
                          <p className="mt-1 text-[10px] text-[rgba(238,234,248,0.42)]">preview and copy</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyPortal(selectedStudent)}
                          className="op-proto-btn"
                        >
                          {copiedStudentId === selectedStudent.id ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                          {copiedStudentId === selectedStudent.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <div className="mt-3 border border-[rgba(255,255,255,0.12)] bg-[#1f1f32] px-3 py-2 text-[11px] text-[rgba(238,234,248,0.66)]">
                        {buildPortalUrl(selectedStudent)}
                      </div>
                    </section>

                    <section className="op-proto-section green">
                      <p className="text-[12px] font-label text-white">Portal access</p>
                      <p className="mt-1 text-[10px] text-[rgba(238,234,248,0.42)]">each child uses one credential mode</p>
                      <div className="mt-3 grid grid-cols-2 gap-1">
                        <div className="border border-[#7c6fd4] bg-[rgba(124,111,212,0.14)] px-3 py-2">
                          <p className="text-[10px] font-label text-[#b8adff]">PIN</p>
                          <p className="mt-1 text-[11px] text-[rgba(238,234,248,0.68)]">{selectedStudent.access_pin ? 'Active' : 'Available'}</p>
                        </div>
                        <div className="border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.03)] px-3 py-2">
                          <p className="text-[10px] font-label text-[rgba(238,234,248,0.5)]">Password</p>
                          <p className="mt-1 text-[11px] text-[rgba(238,234,248,0.38)]">Pending migration</p>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="space-y-1">
                    <section className="op-proto-section amber">
                      <p className="text-[12px] font-label text-white">Plan usage</p>
                      <div className="mt-3">
                        <div className="flex items-baseline justify-between text-[11px] text-[rgba(238,234,248,0.54)]">
                          <span><strong className="text-white">{students.length}</strong> active seats</span>
                          <span>{protectedStudents} secured · {unprotectedStudents} open</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-[rgba(255,255,255,0.1)]">
                          <div className="h-1.5 bg-[#7c6fd4]" style={{ width: `${students.length ? Math.min(100, (students.length / Math.max(students.length, 1)) * 100) : 0}%` }} />
                        </div>
                      </div>
                    </section>

                    <section className="op-proto-section blue">
                      <p className="text-[12px] font-label text-white">Actions</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => handleViewSchoolProgress?.(selectedStudent)} className="op-proto-btn">
                          <Eye className="h-3.5 w-3.5" /> School
                        </button>
                        <button type="button" onClick={() => handleViewChoresProgress?.(selectedStudent)} className="op-proto-btn">
                          <Eye className="h-3.5 w-3.5" /> Chores
                        </button>
                        {handleDeleteStudent ? (
                          <button type="button" onClick={() => handleDeleteStudent(selectedStudent.id)} className="op-proto-btn">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        ) : null}
                      </div>
                    </section>

                    <section className="op-proto-section">
                      <p className="text-[12px] font-label text-white">Assigned subjects</p>
                      <div className="mt-3 space-y-1">
                        {selectedStudentSubjects.length === 0 ? (
                          <p className="text-[11px] text-[rgba(238,234,248,0.5)]">No subjects assigned to this student.</p>
                        ) : selectedStudentSubjects.slice(0, 8).map((subject) => (
                          <div key={subject.id} className="flex items-center justify-between gap-3 bg-[#1f1f32] px-3 py-2">
                            <span className="min-w-0 truncate text-[11px] font-label text-white">{subject.title || subject.name}</span>
                            <span className="text-[10px] text-[rgba(238,234,248,0.42)]">{subject.block_count || subject.total_blocks || 0} blocks</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>

                <div className="op-bottom-actions">
                  <button type="button" onClick={openAddStudentModal} className="op-proto-btn">
                    <Plus className="h-3.5 w-3.5" /> Add another
                  </button>
                  <button type="button" onClick={() => handleCopyPortal(selectedStudent)} className="op-proto-btn">
                    <Clipboard className="h-3.5 w-3.5" /> Copy link
                  </button>
                  {handleDeleteStudent ? (
                    <button type="button" onClick={() => handleDeleteStudent(selectedStudent.id)} className="op-proto-btn">
                      <Trash2 className="h-3.5 w-3.5" /> Remove student
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentsRoute;
