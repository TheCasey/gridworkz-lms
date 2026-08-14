import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Check,
  Clipboard,
  Eye,
  KeyRound,
  LockKeyhole,
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
      <div className="op-shell space-y-6">
        <section className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="op-eyebrow">Students</p>
            <h1 className="op-title mt-3">Roster and portal access</h1>
            <p className="op-subtle mt-4 max-w-2xl text-[14px] leading-6">
              Manage each child as an individual learner with a dedicated portal, per-student subjects, and simple access controls.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddStudentModal}
            disabled={!canAddStudent}
            className="op-button w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {studentLimitReached ? 'Student Limit Reached' : 'Add Student'}
          </button>
        </section>

        {loading ? (
          <div className="op-panel flex min-h-[360px] items-center justify-center">
            <div className="h-8 w-8 animate-spin border-2 border-transparent border-b-[#cbb7fb]" />
          </div>
        ) : students.length === 0 ? (
          <section className="op-panel flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
            <Users className="h-9 w-9 text-[#cbb7fb]" />
            <h2 className="mt-5 text-[24px] font-display leading-none text-white">No students yet</h2>
            <p className="op-subtle mt-3 max-w-md text-[14px] leading-6">
              Add the first student to create their portal and begin assigning subjects.
            </p>
            <button
              type="button"
              onClick={openAddStudentModal}
              disabled={!canAddStudent}
              className="op-button mt-6"
            >
              <Plus className="h-4 w-4" />
              {studentLimitReached ? 'Student Limit Reached' : 'Add First Student'}
            </button>
          </section>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
            <aside className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="op-stat p-4">
                  <p className="op-eyebrow">Total</p>
                  <p className="mt-3 text-[28px] font-display leading-none text-white">{students.length}</p>
                </div>
                <div className="op-stat p-4">
                  <p className="op-eyebrow">Secured</p>
                  <p className="mt-3 text-[28px] font-display leading-none text-white">{protectedStudents}</p>
                </div>
                <div className="op-stat p-4">
                  <p className="op-eyebrow">Open</p>
                  <p className="mt-3 text-[28px] font-display leading-none text-white">{unprotectedStudents}</p>
                </div>
              </div>

              <div className="op-panel p-3">
                <div className="space-y-2">
                  {students.map((student) => {
                    const isSelected = selectedStudent?.id === student.id;
                    const credential = getCredentialMeta(student);

                    return (
                      <button
                        key={student.id}
                        type="button"
                        onClick={() => setSelectedStudentId(student.id)}
                        className={`w-full border p-4 text-left transition-colors ${
                          isSelected
                            ? 'border-[#cbb7fb] bg-[#30304b]'
                            : 'border-[rgba(238,234,248,0.1)] bg-transparent hover:bg-[rgba(238,234,248,0.05)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[rgba(203,183,251,0.28)] bg-[#202034] text-[16px] font-display text-[#cbb7fb]">
                            {student.name?.charAt(0)?.toUpperCase() || <UserRound className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-[15px] font-display leading-tight text-white">{student.name}</h3>
                            <p className="mt-1 truncate text-[12px] text-[rgba(238,234,248,0.48)]">
                              /student/{student.slug}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <span className="op-pill">
                            {credential.tone === 'ready' ? <ShieldCheck className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
                            {credential.label}
                          </span>
                          <span className="text-[12px] text-[rgba(238,234,248,0.42)]">
                            {selectedStudentSubjects.length && isSelected ? `${selectedStudentSubjects.length} subjects` : ''}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {selectedStudent ? (
              <section className="op-panel min-h-[520px] p-5 md:p-6">
                <div className="flex flex-col gap-5 border-b border-[rgba(238,234,248,0.12)] pb-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="op-eyebrow">Student Detail</p>
                    <h2 className="mt-3 text-[34px] font-display leading-none text-white">{selectedStudent.name}</h2>
                    <p className="op-subtle mt-3 text-[14px]">Dedicated portal: /student/{selectedStudent.slug}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyPortal(selectedStudent)}
                      className="op-button"
                    >
                      {copiedStudentId === selectedStudent.id ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                      {copiedStudentId === selectedStudent.id ? 'Copied' : 'Copy Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewSchoolProgress?.(selectedStudent)}
                      className="op-button op-button-secondary"
                    >
                      <Eye className="h-4 w-4" />
                      School
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewChoresProgress?.(selectedStudent)}
                      className="op-button op-button-secondary"
                    >
                      <Eye className="h-4 w-4" />
                      Chores
                    </button>
                    {handleDeleteStudent ? (
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(selectedStudent.id)}
                        className="op-icon-button"
                        title="Delete student"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <section className="op-surface p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="op-eyebrow">Portal Access</p>
                        <h3 className="mt-3 text-[20px] font-display leading-none text-white">
                          {getCredentialMeta(selectedStudent).label}
                        </h3>
                        <p className="op-subtle mt-2 text-[13px]">{getCredentialMeta(selectedStudent).detail}</p>
                      </div>
                      <LockKeyhole className="h-5 w-5 text-[#cbb7fb]" />
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="border border-[#cbb7fb] bg-[rgba(203,183,251,0.1)] p-4">
                        <p className="text-[12px] font-label uppercase tracking-[0.14em] text-[#cbb7fb]">PIN</p>
                        <p className="mt-2 text-[13px] text-[rgba(238,234,248,0.62)]">
                          {selectedStudent.access_pin ? 'Active' : 'Available'}
                        </p>
                      </div>
                      <div className="border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] p-4">
                        <p className="text-[12px] font-label uppercase tracking-[0.14em] text-[rgba(238,234,248,0.56)]">Password</p>
                        <p className="mt-2 text-[13px] text-[rgba(238,234,248,0.42)]">Pending migration</p>
                      </div>
                    </div>
                  </section>

                  <section className="op-surface p-5">
                    <p className="op-eyebrow">Assigned Subjects</p>
                    <div className="mt-4 space-y-3">
                      {selectedStudentSubjects.length === 0 ? (
                        <div className="border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] p-5">
                          <p className="text-[14px] text-[rgba(238,234,248,0.62)]">
                            No subjects assigned to this student.
                          </p>
                        </div>
                      ) : selectedStudentSubjects.slice(0, 6).map((subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center justify-between gap-4 border border-[rgba(238,234,248,0.1)] bg-[rgba(238,234,248,0.04)] px-4 py-3"
                        >
                          <div className="min-w-0">
                            <h4 className="truncate text-[14px] font-label text-white">{subject.name}</h4>
                            <p className="mt-1 text-[12px] text-[rgba(238,234,248,0.42)]">
                              {subject.blocks?.length || subject.total_blocks || 0} blocks
                            </p>
                          </div>
                          <span className="op-pill">{subject.status || 'Active'}</span>
                        </div>
                      ))}
                    </div>
                  </section>
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
