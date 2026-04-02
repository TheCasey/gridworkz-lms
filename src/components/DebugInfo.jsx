import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const DebugInfo = ({ students, submissions, loading }) => {
  const { currentUser } = useAuth();

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h4 className="font-bold mb-2">Debug Info</h4>
      <div className="space-y-1">
        <div>Current User: {currentUser?.uid || 'null'}</div>
        <div>Email: {currentUser?.email || 'null'}</div>
        <div>Loading: {loading.toString()}</div>
        <div>Students Count: {students?.length || 0}</div>
        <div>Submissions Count: {submissions?.length || 0}</div>
        {students?.length > 0 && (
          <div className="mt-2">
            <div className="font-semibold">Students:</div>
            {students.map(student => (
              <div key={student.id} className="ml-2">
                {student.name} - {student.slug}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DebugInfo;
