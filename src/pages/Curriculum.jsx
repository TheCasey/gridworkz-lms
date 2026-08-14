import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ListChecks, MessageSquareText, Plus, Settings, Trash2, Archive, Edit, Timer, Upload, X } from 'lucide-react';
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

const emptyBlockObjective = {
  instruction: '',
  custom_fields: [],
  student_overrides: {},
};

const createEmptyBlockObjective = () => ({
  instruction: '',
  custom_fields: [],
  student_overrides: {},
});

const getNormalizedBlockObjectiveDraft = (objective = {}) => ({
  ...emptyBlockObjective,
  ...(objective || {}),
  instruction: typeof objective?.instruction === 'string' ? objective.instruction : '',
  custom_fields: Array.isArray(objective?.custom_fields) ? objective.custom_fields : [],
  student_overrides: objective?.student_overrides && typeof objective.student_overrides === 'object'
    ? objective.student_overrides
    : {},
});

const normalizeBlockObjectivesForSave = (objectives = {}) => Object.fromEntries(
  Object.entries(objectives || {})
    .filter(([, objective]) => {
      const normalizedObjective = getNormalizedBlockObjectiveDraft(objective);
      if (hasText(normalizedObjective.instruction)) return true;
      if (getConfiguredFields(normalizedObjective.custom_fields).length > 0) return true;
      return Object.values(normalizedObjective.student_overrides).some(hasConfiguredOverride);
    })
    .map(([blockIndex, objective]) => {
      const normalizedObjective = getNormalizedBlockObjectiveDraft(objective);
      const cleanedOverrides = Object.fromEntries(
        Object.entries(normalizedObjective.student_overrides)
          .filter(([, override]) => hasConfiguredOverride(override))
          .map(([studentId, override]) => [studentId, {
            instruction: typeof override?.instruction === 'string' ? override.instruction.trim() : '',
            custom_fields: getConfiguredFields(override?.custom_fields),
          }])
      );

      return [blockIndex, {
        instruction: normalizedObjective.instruction.trim(),
        custom_fields: getConfiguredFields(normalizedObjective.custom_fields),
        student_overrides: cleanedOverrides,
      }];
    })
);

const countConfiguredBlockObjectives = (objectives = {}) => (
  Object.keys(normalizeBlockObjectivesForSave(objectives)).length
);

const CURRICULUM_BLOCK_TYPES = {
  standard: {
    label: 'STD',
    name: 'Standard',
  },
  project: {
    label: 'PROJ',
    name: 'Project',
  },
  parent_led: {
    label: 'P.LED',
    name: 'Parent-led',
  },
  test: {
    label: 'TEST',
    name: 'Test',
  },
  custom: {
    label: 'CUSTOM',
    name: 'Custom',
  },
};

const createCurriculumBlockId = () => `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createEmptyCurriculumBlock = ({ index = 0 } = {}) => ({
  id: createCurriculumBlockId(),
  title: `Block ${index + 1}`,
  type: 'standard',
  instruction: '',
  custom_fields: [],
  default_quantity: index === 0 ? 1 : 0,
  pinned: index < 2,
});

const normalizeCurriculumBlock = (block = {}, index = 0) => {
  const rawType = typeof block?.type === 'string' ? block.type : block?.category;
  const type = Object.keys(CURRICULUM_BLOCK_TYPES).includes(rawType) ? rawType : 'standard';
  const title = typeof block?.title === 'string' && block.title.trim().length > 0
    ? block.title.trim()
    : `Block ${index + 1}`;
  const defaultQuantity = Number.parseInt(block?.default_quantity, 10);

  return {
    id: typeof block?.id === 'string' && block.id.trim().length > 0
      ? block.id.trim()
      : `block_${index + 1}`,
    title,
    type,
    instruction: typeof block?.instruction === 'string' ? block.instruction.trim() : '',
    custom_fields: getConfiguredFields(block?.custom_fields),
    default_quantity: Number.isFinite(defaultQuantity) && defaultQuantity >= 0
      ? Math.min(defaultQuantity, 20)
      : 0,
    pinned: block?.pinned !== false,
  };
};

const normalizeCurriculumBlocksForSave = (blocks = []) => (
  (Array.isArray(blocks) ? blocks : [])
    .map(normalizeCurriculumBlock)
    .filter((block) => block.title)
);

const buildCurriculumBlocksFromSubject = (subject = {}) => {
  if (Array.isArray(subject?.curriculum_blocks) && subject.curriculum_blocks.length > 0) {
    return normalizeCurriculumBlocksForSave(subject.curriculum_blocks);
  }

  const totalBlocks = subject?.block_count || 10;
  return Array.from({ length: totalBlocks }, (_, index) => {
    const objective = getNormalizedBlockObjectiveDraft(subject?.block_objectives?.[index]);
    const hasObjective = hasText(objective.instruction) || getConfiguredFields(objective.custom_fields).length > 0;

    return normalizeCurriculumBlock({
      id: `legacy_${index + 1}`,
      title: hasObjective ? `Block ${index + 1}` : `${subject?.title || 'Subject'} block`,
      type: hasObjective ? 'standard' : 'standard',
      instruction: objective.instruction,
      custom_fields: objective.custom_fields,
      default_quantity: index < (subject?.block_count || 10) ? 1 : 0,
      pinned: index < 2 || hasObjective,
    }, index);
  });
};

const buildBlockObjectivesFromCurriculumBlocks = (blocks = []) => (
  normalizeCurriculumBlocksForSave(blocks).reduce((objectives, block, index) => {
    if (hasText(block.instruction) || getConfiguredFields(block.custom_fields).length > 0) {
      objectives[index] = {
        instruction: block.instruction,
        custom_fields: getConfiguredFields(block.custom_fields),
        student_overrides: {},
      };
    }

    return objectives;
  }, {})
);

const countDefaultBlockQuantity = (subject = {}) => (
  buildCurriculumBlocksFromSubject(subject).reduce((total, block) => (
    total + (Number.parseInt(block.default_quantity, 10) || 0)
  ), 0)
);

const getFirstConfiguredBlockIndex = (objectives = {}) => {
  const configuredIndexes = Object.keys(normalizeBlockObjectivesForSave(objectives))
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isInteger)
    .sort((left, right) => left - right);

  return configuredIndexes[0] ?? 0;
};

const getSubjectStudentIds = (subject) => (
  Array.isArray(subject?.student_ids) && subject.student_ids.length
    ? subject.student_ids
    : [subject?.student_id].filter(Boolean)
);

const isSubjectAssignedToStudent = (subject, studentId) => (
  Boolean(studentId) && getSubjectStudentIds(subject).includes(studentId)
);

const getSubjectWeeklyMinutes = (subject) => (
  (subject?.block_count || 10) * (subject?.block_length || 30)
);

const buildSubjectBlockRows = (subject, studentId) => {
  const curriculumBlocks = buildCurriculumBlocksFromSubject(subject);

  return curriculumBlocks.map((block, index) => {
    const objective = getNormalizedBlockObjectiveDraft({
      instruction: block.instruction,
      custom_fields: block.custom_fields,
      student_overrides: subject?.block_objectives?.[index]?.student_overrides || {},
    });
    const override = objective.student_overrides?.[studentId] || null;
    const instruction = override?.instruction || objective.instruction;
    const customFields = getConfiguredFields(override?.custom_fields?.length ? override.custom_fields : objective.custom_fields);
    const hasObjective = hasText(instruction);
    const blockType = CURRICULUM_BLOCK_TYPES[block.type] || CURRICULUM_BLOCK_TYPES.standard;
    const rowType = blockType.name;

    return {
      ...block,
      blockIndex: index,
      customFields,
      hasObjective,
      instruction,
      rowType,
    };
  });
};

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
  const [selectedLibraryStudentId, setSelectedLibraryStudentId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [detailBlockDraft, setDetailBlockDraft] = useState(null);
  const [savingDetailBlock, setSavingDetailBlock] = useState(false);

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
      setBlockObjectives(prev => ({ ...prev, [blockIndex]: createEmptyBlockObjective() }));
      setExpandedObjectiveBlock(blockIndex);
    }
  };
  const handleObjectiveChange = (blockIndex, value) => {
    setBlockObjectives(prev => ({
      ...prev,
      [blockIndex]: {
        ...getNormalizedBlockObjectiveDraft(prev[blockIndex]),
        instruction: value,
      },
    }));
  };
  const handleAddObjectiveCustomField = (blockIndex) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...getNormalizedBlockObjectiveDraft(prev[blockIndex]),
        custom_fields: [
          ...getNormalizedBlockObjectiveDraft(prev[blockIndex]).custom_fields,
          { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: false },
        ],
      }
    }));
  };
  const handleRemoveObjectiveCustomField = (blockIndex, fieldId) => {
    setBlockObjectives(prev => ({
      ...prev,
      [blockIndex]: {
        ...getNormalizedBlockObjectiveDraft(prev[blockIndex]),
        custom_fields: getNormalizedBlockObjectiveDraft(prev[blockIndex]).custom_fields.filter(f => f.id !== fieldId),
      },
    }));
  };
  const handleObjectiveCustomFieldChange = (blockIndex, fieldId, key, value) => {
    setBlockObjectives(prev => ({
      ...prev, [blockIndex]: {
        ...getNormalizedBlockObjectiveDraft(prev[blockIndex]),
        custom_fields: getNormalizedBlockObjectiveDraft(prev[blockIndex]).custom_fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f),
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
        block_objectives: normalizeBlockObjectivesForSave(blockObjectives),
        curriculum_blocks: normalizeCurriculumBlocksForSave(
          Object.keys(blockObjectives || {}).length > 0
            ? Array.from({ length: safeTotalBlocks }, (_, index) => {
              const objective = getNormalizedBlockObjectiveDraft(blockObjectives[index]);
              return {
                id: `block_${index + 1}`,
                title: hasText(objective.instruction) ? `Block ${index + 1}` : `${subjectName.trim()} block`,
                type: 'standard',
                instruction: objective.instruction,
                custom_fields: objective.custom_fields,
                default_quantity: 1,
                pinned: index < 2 || hasText(objective.instruction),
              };
            })
            : Array.from({ length: safeTotalBlocks }, (_, index) => ({
              id: `block_${index + 1}`,
              title: `${subjectName.trim()} block`,
              type: 'standard',
              instruction: '',
              custom_fields: [],
              default_quantity: 1,
              pinned: index < 2,
            }))
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
  const selectedLibraryStudent = useMemo(
    () => students.find((student) => student.id === selectedLibraryStudentId) || null,
    [selectedLibraryStudentId, students]
  );
  const selectedStudentSubjects = useMemo(
    () => activeSubjects.filter((subject) => isSubjectAssignedToStudent(subject, selectedLibraryStudentId)),
    [activeSubjects, selectedLibraryStudentId]
  );
  const selectedSubject = useMemo(
    () => selectedStudentSubjects.find((subject) => subject.id === selectedSubjectId) || null,
    [selectedStudentSubjects, selectedSubjectId]
  );
  const selectedSubjectRows = useMemo(
    () => buildSubjectBlockRows(selectedSubject, selectedLibraryStudentId),
    [selectedLibraryStudentId, selectedSubject]
  );
  const selectedStudentWeeklyHours = useMemo(
    () => selectedStudentSubjects.reduce((totalMinutes, subject) => totalMinutes + getSubjectWeeklyMinutes(subject), 0) / 60,
    [selectedStudentSubjects]
  );

  useEffect(() => {
    if (!students.length) {
      setSelectedLibraryStudentId('');
      setSelectedSubjectId('');
      return;
    }

    setSelectedLibraryStudentId((currentValue) => (
      currentValue && students.some((student) => student.id === currentValue)
        ? currentValue
        : students[0].id
    ));
  }, [students]);

  useEffect(() => {
    setSelectedSubjectId((currentValue) => (
      currentValue && selectedStudentSubjects.some((subject) => subject.id === currentValue)
        ? currentValue
        : ''
    ));
  }, [selectedStudentSubjects]);

  useEffect(() => {
    setDetailBlockDraft(null);
  }, [selectedSubjectId]);

  const handleEdit = (subject, { startStep = 1 } = {}) => {
    const studentIds = subject.student_ids || [subject.student_id].filter(Boolean);
    const nextBlockObjectives = subject.block_objectives || {};
    setSelectedStudents(studentIds);
    setSubjectName(subject.title);
    setTotalBlocks(subject.block_count || 10);
    setBlockLength(subject.block_length || 30);
    setSubjectColor(subject.color || '#3B82F6');
    setRequireSummary(subject.require_input !== false);
    setResources(subject.resources?.length ? subject.resources : [{ name: '', url: '' }]);
    setCustomFields(subject.custom_fields || []);
    setRequireTimer(subject.require_timer || false);
    setBlockObjectives(nextBlockObjectives);
    setExpandedObjectiveBlock(startStep === 4 ? getFirstConfiguredBlockIndex(nextBlockObjectives) : null);
    setExpandedStudentOverrides({});
    setCurrentStep(startStep);
    setEditingSubject(subject);
    setShowAddForm(true);
  };

  const openNewDetailBlockDraft = () => {
    const nextIndex = selectedSubjectRows.length;
    setDetailBlockDraft({
      ...createEmptyCurriculumBlock({ index: nextIndex }),
      title: '',
      default_quantity: 1,
    });
  };

  const openEditDetailBlockDraft = (block) => {
    setDetailBlockDraft(normalizeCurriculumBlock(block));
  };

  const handleSaveDetailBlock = async () => {
    if (!selectedSubject || !detailBlockDraft) return;

    setSavingDetailBlock(true);
    try {
      const normalizedDraft = normalizeCurriculumBlock({
        ...detailBlockDraft,
        id: detailBlockDraft.id || createCurriculumBlockId(),
        title: detailBlockDraft.title || 'Untitled block',
      });
      const currentBlocks = buildCurriculumBlocksFromSubject(selectedSubject);
      const existingIndex = currentBlocks.findIndex((block) => block.id === normalizedDraft.id);
      const nextBlocks = existingIndex >= 0
        ? currentBlocks.map((block, index) => (index === existingIndex ? normalizedDraft : block))
        : [...currentBlocks, normalizedDraft];
      const normalizedBlocks = normalizeCurriculumBlocksForSave(nextBlocks);
      const saved = await saveSubject({
        editingSubject: selectedSubject,
        subjectData: {
          curriculum_blocks: normalizedBlocks,
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: Math.max(Number(selectedSubject.block_count || 0), normalizedBlocks.reduce((total, block) => total + (Number(block.default_quantity) || 0), 0), 1),
          updated_at: serverTimestamp(),
        },
      });

      if (saved) {
        setDetailBlockDraft(null);
      }
    } finally {
      setSavingDetailBlock(false);
    }
  };

  const handleRemoveDetailBlock = async (blockId) => {
    if (!selectedSubject || !blockId || !window.confirm('Remove this block from the subject library? Existing saved weekly plans will not be changed.')) {
      return;
    }

    setSavingDetailBlock(true);
    try {
      const nextBlocks = buildCurriculumBlocksFromSubject(selectedSubject).filter((block) => block.id !== blockId);
      const normalizedBlocks = normalizeCurriculumBlocksForSave(nextBlocks);
      const saved = await saveSubject({
        editingSubject: selectedSubject,
        subjectData: {
          curriculum_blocks: normalizedBlocks,
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: Math.max(normalizedBlocks.reduce((total, block) => total + (Number(block.default_quantity) || 0), 0), 1),
          updated_at: serverTimestamp(),
        },
      });

      if (saved) {
        setDetailBlockDraft(null);
      }
    } finally {
      setSavingDetailBlock(false);
    }
  };

  const handleToggleDetailBlockPinned = async (block) => {
    if (!selectedSubject || !block || savingDetailBlock) return;

    setSavingDetailBlock(true);
    try {
      const normalizedBlocks = normalizeCurriculumBlocksForSave(
        buildCurriculumBlocksFromSubject(selectedSubject).map((currentBlock) => (
          currentBlock.id === block.id
            ? { ...currentBlock, pinned: !currentBlock.pinned }
            : currentBlock
        ))
      );
      await saveSubject({
        editingSubject: selectedSubject,
        subjectData: {
          curriculum_blocks: normalizedBlocks,
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: Math.max(Number(selectedSubject.block_count || 0), normalizedBlocks.reduce((total, currentBlock) => total + (Number(currentBlock.default_quantity) || 0), 0), 1),
          updated_at: serverTimestamp(),
        },
      });
    } finally {
      setSavingDetailBlock(false);
    }
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
      <div className="op-proto-shell">
        <div className="op-proto-topbar">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-label text-white">Curriculum</p>
            <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.42)]">
              {selectedLibraryStudent?.name || 'Select a student'} · {selectedStudentSubjects.length} subject{selectedStudentSubjects.length === 1 ? '' : 's'} · ~{selectedStudentWeeklyHours.toFixed(1)}h/wk
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Link to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`} className="op-proto-btn">
              <CalendarDays className="h-3.5 w-3.5" />
              Plan week
            </Link>
            <button
              onClick={openCreateSubjectForm}
              disabled={!canAddCurriculumItem}
              className="op-proto-btn op-proto-btn-primary"
            >
              <Plus className="h-3.5 w-3.5" />
              {curriculumLimitReached ? 'Limit reached' : 'Add subject'}
            </button>
          </div>
        </div>

        <div className="op-proto-tabs">
          {students.map((student) => {
            const studentSubjects = activeSubjects.filter((subject) => isSubjectAssignedToStudent(subject, student.id));
            const studentHours = studentSubjects.reduce((total, subject) => total + getSubjectWeeklyMinutes(subject), 0) / 60;
            const isActive = student.id === selectedLibraryStudentId;

            return (
              <button
                type="button"
                key={student.id}
                onClick={() => {
                  setSelectedLibraryStudentId(student.id);
                  setSelectedSubjectId('');
                }}
                className={`op-proto-tab ${isActive ? 'is-active' : ''}`}
              >
                <span className="op-proto-tab-name">{student.name}</span>
                <span className="op-proto-tab-meta">~{studentHours.toFixed(1)}h/wk planned</span>
              </button>
            );
          })}
        </div>

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

      {selectedSubject ? (
        <div className="op-proto-detail">
          <div className="op-proto-breadcrumb">
            <button
              type="button"
              onClick={() => setSelectedSubjectId('')}
              className="op-proto-link"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              All subjects
            </button>
            <span className="text-[rgba(238,234,248,0.24)]">/</span>
            <span className="truncate text-[11px] font-label text-white">{selectedSubject.title}</span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleEdit(selectedSubject)}
                className="op-proto-btn"
              >
                <Settings className="h-3.5 w-3.5" />
                Settings
              </button>
              <button
                type="button"
                onClick={() => handleEdit(selectedSubject, { startStep: 4 })}
                className="op-proto-btn op-proto-btn-primary"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Edit blocks
              </button>
              <button
                type="button"
                onClick={() => archiveSubject(selectedSubject.id)}
                className="op-proto-icon-btn"
                title="Archive subject"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => deleteSubject(selectedSubject.id)}
                className="op-proto-icon-btn"
                title="Delete subject"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="op-proto-detail-grid">
            <section className="op-proto-block-panel">
              <div className="op-proto-section-header">
                <span className="h-4 w-[3px]" style={{ backgroundColor: selectedSubject.color || '#7c6fd4' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-label text-white">{selectedSubject.title}</p>
                  <p className="mt-0.5 text-[10px] text-[rgba(238,234,248,0.44)]">
                    {selectedSubjectRows.length} possible · {countDefaultBlockQuantity(selectedSubject)} default/wk · {selectedSubject.block_length || 30}m each
                  </p>
                </div>
              <button
                type="button"
                onClick={openNewDetailBlockDraft}
                className="op-proto-btn op-proto-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Add block
              </button>
            </div>

              <div className="op-proto-block-list">
                {detailBlockDraft ? (
                  <div className="op-curriculum-block-editor">
                    <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_120px_90px]">
                      <input
                        type="text"
                        value={detailBlockDraft.title}
                        onChange={(event) => setDetailBlockDraft((draft) => ({ ...draft, title: event.target.value }))}
                        className="op-weekly-inline-input"
                        placeholder="Block name, e.g. Beast Academy practice"
                      />
                      <select
                        value={detailBlockDraft.type}
                        onChange={(event) => setDetailBlockDraft((draft) => ({ ...draft, type: event.target.value }))}
                        className="op-weekly-inline-input"
                      >
                        {Object.entries(CURRICULUM_BLOCK_TYPES).map(([value, meta]) => (
                          <option key={value} value={value}>{meta.name}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={detailBlockDraft.default_quantity}
                        onChange={(event) => setDetailBlockDraft((draft) => ({ ...draft, default_quantity: event.target.value }))}
                        className="op-weekly-inline-input"
                        aria-label="Default weekly quantity"
                      />
                    </div>
                    <textarea
                      value={detailBlockDraft.instruction}
                      onChange={(event) => setDetailBlockDraft((draft) => ({ ...draft, instruction: event.target.value }))}
                      className="op-curriculum-block-textarea"
                      placeholder="Student-facing instruction or objective for this reusable block"
                    />
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailBlockDraft(null)}
                        className="op-proto-btn"
                        disabled={savingDetailBlock}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDetailBlock}
                        className="op-proto-btn op-proto-btn-primary"
                        disabled={savingDetailBlock}
                      >
                        {savingDetailBlock ? 'Saving...' : 'Save block'}
                      </button>
                    </div>
                  </div>
                ) : null}
                {selectedSubjectRows.map((row) => (
                  <div
                    key={row.id}
                    className={`op-proto-block-row ${row.type === 'project' ? 'is-custom' : row.hasObjective ? 'is-guided' : row.customFields.length ? 'is-custom' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleDetailBlockPinned(row)}
                      className={`op-proto-pin ${row.pinned ? 'pinned' : ''}`}
                      title={row.pinned ? 'Unpin from quick planning' : 'Pin to quick planning'}
                      disabled={savingDetailBlock}
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                    </button>
                    <span className={`op-proto-block-tag ${row.hasObjective ? 'is-guided' : row.customFields.length ? 'is-custom' : ''}`}>
                      {(CURRICULUM_BLOCK_TYPES[row.type] || CURRICULUM_BLOCK_TYPES.standard).label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-label text-white">{row.title}</p>
                      <p className="mt-1 truncate text-[10px] text-[rgba(238,234,248,0.5)]">
                        {row.instruction || 'Independent learning block'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="op-proto-req">{row.default_quantity || 0} default/wk</span>
                        {selectedSubject.require_timer ? (
                          <span className="op-proto-req"><Timer className="h-3 w-3" /> Timer</span>
                        ) : null}
                        {selectedSubject.require_input !== false ? (
                          <span className="op-proto-req"><MessageSquareText className="h-3 w-3" /> Written response</span>
                        ) : null}
                        {row.customFields.length ? (
                          <span className="op-proto-req"><Upload className="h-3 w-3" /> {row.customFields.length} custom field{row.customFields.length === 1 ? '' : 's'}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditDetailBlockDraft(row)}
                        className="op-proto-icon-btn"
                        title="Edit block"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDetailBlock(row.id)}
                        className="op-proto-icon-btn"
                        title="Remove block"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <aside className="op-proto-side-tray">
              <div className="op-proto-section-header">
                <CalendarDays className="h-4 w-4 text-[#b8adff]" />
                <p className="text-[12px] font-label text-white">Plan week</p>
              </div>
              <div className="space-y-3 p-3">
                <div className="op-proto-tray-stat">
                  <span>{selectedSubjectRows.length}</span>
                  <p>possible blocks</p>
                </div>
                <div className="op-proto-tray-stat">
                  <span>{countDefaultBlockQuantity(selectedSubject)}</span>
                  <p>default weekly blocks</p>
                </div>
                <div className="op-proto-tray-stat">
                  <span>~{(getSubjectWeeklyMinutes(selectedSubject) / 60).toFixed(1)}h</span>
                  <p>weekly target</p>
                </div>
                <div className="border-l-2 border-[#f59e0b] bg-[rgba(245,158,11,0.08)] px-3 py-2 text-[10px] leading-4 text-[#f59e0b]">
                  Weekly Blocking controls which reusable blocks are enabled and how many of each are assigned for a default or specific week.
                </div>
                <Link
                  to={`/dashboard/${dashboardFeaturesById['weekly-blocking'].path}`}
                  className="op-proto-btn op-proto-btn-primary w-full"
                >
                  Full control
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      ) : activeSubjects.length === 0 ? (
        <div className="op-proto-empty">
          <BookOpen className="mx-auto h-9 w-9 text-[#b8adff]" />
          <h3 className="mt-4 text-[18px] font-label text-white">No subjects yet</h3>
          <p className="mt-2 text-[12px] text-[rgba(238,234,248,0.54)]">Add your first subject to start building a weekly library.</p>
          <button onClick={openCreateSubjectForm}
            disabled={!canAddCurriculumItem}
            className="op-proto-btn op-proto-btn-primary mt-5">
            <Plus className="h-3.5 w-3.5" /> {curriculumLimitReached ? 'Subject limit reached' : 'Add subject'}
          </button>
        </div>
      ) : (
        <div className="op-proto-library">
          <div className="px-4 py-3">
            <p className="text-[9px] font-label uppercase tracking-[0.12em] text-[rgba(238,234,248,0.32)]">
              Subjects — click to view & edit blocks
            </p>
          </div>
          <div className="op-proto-subject-grid">
            {selectedStudentSubjects.map((subject) => {
              const subjectBlocks = buildCurriculumBlocksFromSubject(subject);
              const configuredBlockCount = countConfiguredBlockObjectives(subject.block_objectives);
              const totalBlocks = subject.block_count || countDefaultBlockQuantity(subject) || subjectBlocks.length || 1;

              return (
                <button
                  type="button"
                  key={subject.id}
                  onClick={() => setSelectedSubjectId(subject.id)}
                  className="op-proto-subject-card"
                  style={{ borderLeftColor: subject.color || '#7c6fd4' }}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-label text-white">{subject.title}</span>
                      <span className="mt-2 flex flex-wrap gap-3 text-[10px] text-[rgba(238,234,248,0.52)]">
                        <span><b className="font-label text-[rgba(238,234,248,0.82)]">{subjectBlocks.length}</b> possible</span>
                        <span><b className="font-label text-[rgba(238,234,248,0.82)]">{totalBlocks}</b> default/wk</span>
                        <span><b className="font-label text-[rgba(238,234,248,0.82)]">{subject.block_length || 30}m</b></span>
                        <span><b className="font-label text-[rgba(238,234,248,0.82)]">{(getSubjectWeeklyMinutes(subject) / 60).toFixed(1)}h</b></span>
                      </span>
                    </span>
                    <Settings className="h-3.5 w-3.5 flex-shrink-0 text-[rgba(238,234,248,0.24)]" />
                  </span>
                  <span className="mt-3 flex flex-wrap gap-[3px]">
                    {subjectBlocks.map((block, index) => (
                      <span
                        key={index}
                        className={`op-proto-pip ${block.instruction ? 'is-guided' : ''}`}
                        title={block.title}
                      />
                    ))}
                  </span>
                  <span className="mt-3 flex items-center justify-between text-[10px] text-[rgba(238,234,248,0.42)]">
                    <span>{configuredBlockCount} configured objective{configuredBlockCount === 1 ? '' : 's'}</span>
                    <span className="text-[#b8adff]">Open</span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={openCreateSubjectForm}
              disabled={!canAddCurriculumItem}
              className="op-proto-add-card"
            >
              <Plus className="h-5 w-5" />
              <span>{curriculumLimitReached ? 'Subject limit reached' : 'Add subject'}</span>
            </button>
          </div>

          {curriculumLimitCheck ? (
            <div className="border-t border-[rgba(238,234,248,0.08)] px-4 py-3 text-[11px] leading-5 text-[rgba(238,234,248,0.46)]">
              {curriculumLimitMessage}
            </div>
          ) : null}
        </div>
      )}
      </div>
    </div>
  );
};

export default Curriculum;
