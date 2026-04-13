/**
 * Deduplication Utilities
 * Functions to find and remove duplicate submissions from Firestore
 */

import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  writeBatch 
} from 'firebase/firestore';
import { app } from '../firebase/firebaseConfig';

/**
 * Find duplicate submissions within a time window
 * @param {string} parentId - Parent ID to filter submissions
 * @param {number} timeWindowSeconds - Time window in seconds to consider duplicates (default: 60)
 * @returns {Array} Array of duplicate groups
 */
export const findDuplicateSubmissions = async (parentId, timeWindowSeconds = 60) => {
  const db = getFirestore(app);
  
  try {
    // Get all submissions for the parent, ordered by timestamp
    const submissionsQuery = query(
      collection(db, 'submissions'),
      where('parent_id', '==', parentId),
      orderBy('student_id'),
      orderBy('subject_id'),
      orderBy('block_index'),
      orderBy('timestamp')
    );
    
    const snapshot = await getDocs(submissionsQuery);
    const submissions = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Group submissions by student_id, subject_id, and block_index
    const groups = {};
    
    submissions.forEach(submission => {
      const key = `${submission.student_id}_${submission.subject_id}_${submission.block_index}`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      
      groups[key].push(submission);
    });
    
    // Find groups with multiple submissions within the time window
    const duplicateGroups = [];
    
    Object.values(groups).forEach(group => {
      if (group.length > 1) {
        // Check if submissions are within the time window
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const time1 = group[i].timestamp?.toDate ? group[i].timestamp.toDate() : new Date(group[i].timestamp);
            const time2 = group[j].timestamp?.toDate ? group[j].timestamp.toDate() : new Date(group[j].timestamp);
            const timeDiff = Math.abs(time2 - time1) / 1000; // Convert to seconds
            
            if (timeDiff <= timeWindowSeconds) {
              duplicateGroups.push({
                student_id: group[i].student_id,
                subject_id: group[i].subject_id,
                block_index: group[i].block_index,
                submissions: group.sort((a, b) => {
                  const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                  const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                  return timeA - timeB; // Oldest first
                }),
                timeWindow: timeDiff
              });
              break; // Found duplicates in this group, move to next group
            }
          }
        }
      }
    });
    
    return duplicateGroups;
  } catch (error) {
    console.error('Error finding duplicate submissions:', error);
    throw error;
  }
};

/**
 * Remove duplicate submissions, keeping the earliest one
 * @param {Array} duplicateGroups - Array of duplicate groups from findDuplicateSubmissions
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Object} Results of the cleanup operation
 */
export const removeDuplicateSubmissions = async (duplicateGroups, onProgress) => {
  const db = getFirestore(app);
  const results = {
    totalGroups: duplicateGroups.length,
    processedGroups: 0,
    duplicatesRemoved: 0,
    errors: []
  };
  
  try {
    // Process in batches to avoid hitting Firestore limits
    const batchSize = 10;
    
    for (let i = 0; i < duplicateGroups.length; i += batchSize) {
      const batch = duplicateGroups.slice(i, i + batchSize);
      
      for (const group of batch) {
        try {
          // Keep the first (earliest) submission, remove the rest
          const submissionsToRemove = group.submissions.slice(1);
          
          if (submissionsToRemove.length > 0) {
            // Use batched writes for efficiency
            const deleteBatch = writeBatch(db);
            
            submissionsToRemove.forEach(submission => {
              const docRef = doc(db, 'submissions', submission.id);
              deleteBatch.delete(docRef);
            });
            
            await deleteBatch.commit();
            
            results.duplicatesRemoved += submissionsToRemove.length;
          }
          
          results.processedGroups++;
          
          // Call progress callback if provided
          if (onProgress) {
            onProgress({
              processed: results.processedGroups,
              total: results.totalGroups,
              duplicatesRemoved: results.duplicatesRemoved,
              currentGroup: group
            });
          }
          
        } catch (error) {
          console.error(`Error processing group for student ${group.student_id}, subject ${group.subject_id}, block ${group.block_index}:`, error);
          results.errors.push({
            group,
            error: error.message
          });
        }
      }
      
      // Small delay between batches to avoid overwhelming Firestore
      if (i + batchSize < duplicateGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error removing duplicate submissions:', error);
    throw error;
  }
};

/**
 * Get detailed report of duplicate submissions without removing them
 * @param {string} parentId - Parent ID to filter submissions
 * @param {number} timeWindowSeconds - Time window in seconds (default: 60)
 * @returns {Object} Detailed report of duplicates
 */
export const getDuplicateReport = async (parentId, timeWindowSeconds = 60) => {
  try {
    const duplicateGroups = await findDuplicateSubmissions(parentId, timeWindowSeconds);
    
    const report = {
      summary: {
        totalGroups: duplicateGroups.length,
        totalDuplicates: duplicateGroups.reduce((sum, group) => sum + (group.submissions.length - 1), 0),
        timeWindow: timeWindowSeconds
      },
      groups: duplicateGroups.map(group => ({
        student_id: group.student_id,
        subject_id: group.subject_id,
        block_index: group.block_index,
        duplicateCount: group.submissions.length - 1,
        timeDifference: group.timeWindow,
        submissions: group.submissions.map(sub => ({
          id: sub.id,
          timestamp: sub.timestamp?.toDate ? sub.timestamp.toDate() : new Date(sub.timestamp),
          summary_text: sub.summary_text
        }))
      }))
    };
    
    return report;
  } catch (error) {
    console.error('Error generating duplicate report:', error);
    throw error;
  }
};

/**
 * Clean up duplicates for a specific student
 * @param {string} parentId - Parent ID
 * @param {string} studentId - Student ID to clean up
 * @param {number} timeWindowSeconds - Time window in seconds (default: 60)
 * @returns {Object} Cleanup results
 */
export const cleanupStudentDuplicates = async (parentId, studentId, timeWindowSeconds = 60) => {
  try {
    const allDuplicates = await findDuplicateSubmissions(parentId, timeWindowSeconds);
    const studentDuplicates = allDuplicates.filter(group => group.student_id === studentId);
    
    const results = await removeDuplicateSubmissions(studentDuplicates);
    
    return {
      ...results,
      studentId,
      totalGroups: studentDuplicates.length
    };
  } catch (error) {
    console.error(`Error cleaning up duplicates for student ${studentId}:`, error);
    throw error;
  }
};
