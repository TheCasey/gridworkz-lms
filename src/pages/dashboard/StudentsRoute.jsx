import { useOutletContext } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import StudentCard from '../../components/StudentCard';

const StudentsRoute = () => {
  const {
    canAddStudent,
    colors,
    handleDeleteStudent,
    handleViewStudentProgress,
    loading,
    openAddStudentModal,
    studentLimitReached,
    students,
  } = useOutletContext();

  return (
    <div className="p-8">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div
            className="animate-spin rounded-full h-8 w-8"
            style={{
              borderBottom: `2px solid ${colors.lavender}`,
              border: '2px solid transparent',
              borderBottomColor: colors.lavender,
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {students.length === 0 ? (
            <div className="text-center py-16">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: '#f0eaff' }}
              >
                <Users className="w-7 h-7" style={{ color: colors.amethyst }} />
              </div>
              <h3 className="text-[17px] mb-2" style={{ fontWeight: 540, color: colors.charcoal }}>
                No students yet
              </h3>
              <p className="text-[14px] mb-6" style={{ color: 'rgba(41,40,39,0.4)', fontWeight: 460 }}>
                Add your first student to get started with GridWorkz
              </p>
              <button
                onClick={openAddStudentModal}
                disabled={!canAddStudent}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors disabled:cursor-not-allowed"
                style={{
                  backgroundColor: canAddStudent ? colors.charcoal : 'rgba(41,40,39,0.2)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  opacity: canAddStudent ? 1 : 0.75,
                }}
                onMouseEnter={(event) => {
                  if (canAddStudent) event.currentTarget.style.backgroundColor = '#3a3937';
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.backgroundColor = canAddStudent ? colors.charcoal : 'rgba(41,40,39,0.2)';
                }}
              >
                <Plus className="w-4 h-4" />
                {studentLimitReached ? 'Student Limit Reached' : 'Add Your First Student'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onDelete={handleDeleteStudent}
                  onViewProgress={handleViewStudentProgress}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentsRoute;
