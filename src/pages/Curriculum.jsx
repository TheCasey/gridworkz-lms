import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ListChecks, MessageSquareText, Plus, Settings, Trash2, Archive, Edit, Timer, Upload, X } from 'lucide-react';
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
const getConfiguredResources = (resourceList) => (
  Array.isArray(resourceList)
    ? resourceList
      .map((resource) => ({
        name: typeof resource?.name === 'string' ? resource.name.trim() : '',
        url: typeof resource?.url === 'string' ? resource.url.trim() : '',
        lockdown_origin: typeof resource?.lockdown_origin === 'string' ? resource.lockdown_origin.trim() : '',
        youtube_channel_id: typeof resource?.youtube_channel_id === 'string' ? resource.youtube_channel_id.trim() : '',
        youtube_channel_title: typeof resource?.youtube_channel_title === 'string' ? resource.youtube_channel_title.trim() : '',
        youtube_channel_handle: typeof resource?.youtube_channel_handle === 'string' ? resource.youtube_channel_handle.trim() : '',
      }))
      .filter((resource) => resource.name)
    : []
);
const hasConfiguredOverride = (override) => (
  hasText(override?.instruction) || getConfiguredFields(override?.custom_fields).length > 0
);

const emptyBlockObjective = {
  instruction: '',
  custom_fields: [],
  student_overrides: {},
};

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
  resources: [],
  require_timer: null,
  require_input: null,
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
    resources: getConfiguredResources(block?.resources),
    require_timer: typeof block?.require_timer === 'boolean' ? block.require_timer : null,
    require_input: typeof block?.require_input === 'boolean' ? block.require_input : null,
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
  if (Array.isArray(subject?.curriculum_blocks)) {
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
      resources: getConfiguredResources(subject?.resources),
      require_timer: Boolean(subject?.require_timer),
      require_input: subject?.require_input !== false,
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

const buildDefaultBlockQuantities = (blocks = []) => Object.fromEntries(
  normalizeCurriculumBlocksForSave(blocks).map((block) => [
    block.id,
    Number.parseInt(block.default_quantity, 10) || 0,
  ])
);

const getSubjectStudentIds = (subject) => (
  Array.isArray(subject?.student_ids) && subject.student_ids.length
    ? subject.student_ids
    : [subject?.student_id].filter(Boolean)
);

const isSubjectAssignedToStudent = (subject, studentId) => (
  Boolean(studentId) && getSubjectStudentIds(subject).includes(studentId)
);

const getSubjectWeeklyMinutes = (subject) => (
  countDefaultBlockQuantity(subject) * (subject?.block_length || 30)
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
  const [blockLength, setBlockLength] = useState(30);
  const [requireSummary, setRequireSummary] = useState(true);
  const [resources, setResources] = useState([{ name: '', url: '' }]);
  const [showMultiStudentPicker, setShowMultiStudentPicker] = useState(false);
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

  const resetForm = () => {
    setSelectedStudents([]);
    setSubjectName('');
    setBlockLength(30);
    setRequireSummary(true);
    setResources([{ name: '', url: '' }]);
    setShowMultiStudentPicker(false);
    setShowAddForm(false);
    setEditingSubject(null);
  };

  const openCreateSubjectForm = () => {
    if (!canAddCurriculumItem) return;
    resetForm();
    setSelectedStudents(selectedLibraryStudentId ? [selectedLibraryStudentId] : []);
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudents.length || !subjectName.trim()) {
      alert('Please select at least one student and enter a subject name.');
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
      const safeBlockLength = parsePositiveInt(blockLength, 30, { min: 5, max: 120 });
      const sharedSettings = {
        title: subjectName.trim(),
        block_length: safeBlockLength,
        resources: getConfiguredResources(resources),
        require_input: requireSummary,
        updated_at: serverTimestamp()
      };
      const data = editingSubject
        ? sharedSettings
        : {
          ...sharedSettings,
          student_ids: selectedStudents,
          parent_id: currentUser.uid,
          block_count: 1,
          color: '#3B82F6',
          custom_fields: [],
          require_timer: false,
          block_objectives: {},
          curriculum_blocks: [],
          default_block_quantities: {},
          is_active: true,
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

  const handleEdit = (subject) => {
    setSelectedStudents(getSubjectStudentIds(subject));
    setSubjectName(subject.title);
    setBlockLength(subject.block_length || 30);
    setRequireSummary(subject.require_input !== false);
    setResources(subject.resources?.length ? subject.resources : [{ name: '', url: '' }]);
    setShowMultiStudentPicker(false);
    setEditingSubject(subject);
    setShowAddForm(true);
  };

  const openNewDetailBlockDraft = () => {
    const nextIndex = selectedSubjectRows.length;
    setDetailBlockDraft({
      ...createEmptyCurriculumBlock({ index: nextIndex }),
      title: '',
      resources: getConfiguredResources(selectedSubject?.resources),
      require_timer: Boolean(selectedSubject?.require_timer),
      require_input: selectedSubject?.require_input !== false,
      default_quantity: 1,
    });
  };

  const openEditDetailBlockDraft = (block) => {
    const normalizedBlock = normalizeCurriculumBlock(block);
    setDetailBlockDraft({
      ...normalizedBlock,
      resources: normalizedBlock.resources.length
        ? normalizedBlock.resources
        : getConfiguredResources(selectedSubject?.resources),
      require_timer: typeof normalizedBlock.require_timer === 'boolean'
        ? normalizedBlock.require_timer
        : Boolean(selectedSubject?.require_timer),
      require_input: typeof normalizedBlock.require_input === 'boolean'
        ? normalizedBlock.require_input
        : selectedSubject?.require_input !== false,
    });
  };

  const updateDetailBlockDraft = (patch) => {
    setDetailBlockDraft((draft) => (draft ? { ...draft, ...patch } : draft));
  };

  const handleDraftResourceChange = (index, field, value) => {
    setDetailBlockDraft((draft) => {
      if (!draft) return draft;
      const nextResources = [...(Array.isArray(draft.resources) ? draft.resources : [])];
      nextResources[index] = {
        ...(nextResources[index] || { name: '', url: '' }),
        [field]: value,
      };
      return { ...draft, resources: nextResources };
    });
  };

  const handleAddDraftResource = () => {
    setDetailBlockDraft((draft) => (draft
      ? { ...draft, resources: [...(Array.isArray(draft.resources) ? draft.resources : []), { name: '', url: '' }] }
      : draft));
  };

  const handleRemoveDraftResource = (index) => {
    setDetailBlockDraft((draft) => (draft
      ? { ...draft, resources: (Array.isArray(draft.resources) ? draft.resources : []).filter((_, itemIndex) => itemIndex !== index) }
      : draft));
  };

  const handleAddDraftCustomField = () => {
    setDetailBlockDraft((draft) => (draft
      ? {
        ...draft,
        custom_fields: [
          ...(Array.isArray(draft.custom_fields) ? draft.custom_fields : []),
          { id: Date.now().toString(), type: 'text', label: '', placeholder: '', required: true },
        ],
      }
      : draft));
  };

  const handleRemoveDraftCustomField = (fieldId) => {
    setDetailBlockDraft((draft) => (draft
      ? { ...draft, custom_fields: (Array.isArray(draft.custom_fields) ? draft.custom_fields : []).filter((field) => field.id !== fieldId) }
      : draft));
  };

  const handleDraftCustomFieldChange = (fieldId, key, value) => {
    setDetailBlockDraft((draft) => (draft
      ? {
        ...draft,
        custom_fields: (Array.isArray(draft.custom_fields) ? draft.custom_fields : []).map((field) => (
          field.id === fieldId ? { ...field, [key]: value } : field
        )),
      }
      : draft));
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
          default_block_quantities: buildDefaultBlockQuantities(normalizedBlocks),
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: normalizedBlocks.reduce((total, block) => total + (Number(block.default_quantity) || 0), 0),
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
          default_block_quantities: buildDefaultBlockQuantities(normalizedBlocks),
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: normalizedBlocks.reduce((total, block) => total + (Number(block.default_quantity) || 0), 0),
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
          default_block_quantities: buildDefaultBlockQuantities(normalizedBlocks),
          block_objectives: buildBlockObjectivesFromCurriculumBlocks(normalizedBlocks),
          block_count: normalizedBlocks.reduce((total, currentBlock) => total + (Number(currentBlock.default_quantity) || 0), 0),
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={editingSubject ? 'Edit subject settings' : 'Add subject'}>
          <div className="op-panel flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden sm:max-h-[90vh]">
            <div className="flex flex-shrink-0 items-start justify-between border-b border-[rgba(238,234,248,0.12)] bg-[#27273e] px-5 py-5 sm:px-6">
              <div>
                <p className="op-eyebrow">Subject Settings</p>
                <h2 className="mt-2 text-[24px] font-display leading-none text-white">
                  {editingSubject ? 'Edit Subject' : 'Add Subject'}
                </h2>
                <p className="op-subtle mt-2 text-[12px] leading-5">
                  {editingSubject
                    ? 'Update the defaults shared by this subject’s reusable blocks.'
                    : `Create an empty subject for ${selectedLibraryStudent?.name || 'the selected student'}, then add reusable blocks inside it.`}
                </p>
              </div>
              <button type="button" onClick={resetForm} className="op-icon-button" title="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {!editingSubject && curriculumLimitCheck ? (
                  <div className="op-panel-muted px-4 py-3">
                    <p className="op-eyebrow">Active Subject Limit</p>
                    <p className="op-subtle mt-1.5 text-[12px] leading-5">{curriculumLimitMessage}</p>
                  </div>
                ) : null}

                <div>
                  <label className={labelCls}>Subject Name *</label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(event) => setSubjectName(event.target.value)}
                    className={inputCls}
                    style={inputStyle}
                    onFocus={(event) => Object.assign(event.currentTarget.style, inputFocusStyle)}
                    onBlur={(event) => Object.assign(event.currentTarget.style, inputStyle)}
                    placeholder="e.g., Algebra, Reading, Piano"
                    autoFocus
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <div>
                    <label className={labelCls}>Block Length (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      step="5"
                      value={blockLength}
                      onChange={(event) => setBlockLength(event.target.value === '' ? '' : parsePositiveInt(event.target.value, 30, { min: 5, max: 120 }))}
                      onBlur={(event) => setBlockLength(parsePositiveInt(event.target.value, 30, { min: 5, max: 120 }))}
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex min-h-10 items-center justify-between gap-6 border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)] px-3 py-2">
                    <div>
                      <p className="text-[12px] font-label text-white">Written summary</p>
                      <p className="mt-0.5 text-[10px] text-[rgba(238,234,248,0.44)]">Default for new blocks</p>
                    </div>
                    <Toggle value={requireSummary} onChange={setRequireSummary} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Resource Links (optional)</label>
                  <div className="space-y-2">
                    {resources.map((resource, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                        <input
                          type="text"
                          value={resource.name}
                          onChange={(event) => handleResourceChange(index, 'name', event.target.value)}
                          className={inputCls}
                          style={inputStyle}
                          placeholder="Resource name"
                        />
                        <input
                          type="url"
                          value={resource.url}
                          onChange={(event) => handleResourceChange(index, 'url', event.target.value)}
                          className={inputCls}
                          style={inputStyle}
                          placeholder="https://..."
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveResource(index)}
                          className="op-icon-button"
                          title="Remove resource"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddResource} className="op-proto-link">
                      <Plus className="h-3.5 w-3.5" /> Add resource
                    </button>
                  </div>
                </div>

                {!editingSubject && students.length > 1 ? (
                  <div className="border-t border-[rgba(238,234,248,0.1)] pt-4">
                    <button
                      type="button"
                      onClick={() => setShowMultiStudentPicker((value) => !value)}
                      className="op-proto-link"
                    >
                      <Plus className={`h-3.5 w-3.5 transition-transform ${showMultiStudentPicker ? 'rotate-45' : ''}`} />
                      Create for multiple students
                    </button>
                    <p className="op-subtle mt-1.5 text-[10px] leading-4">
                      Each selected student gets an independent subject record and block library.
                    </p>
                    {showMultiStudentPicker ? (
                      <div className="mt-3 max-h-44 overflow-y-auto border border-[rgba(238,234,248,0.12)] bg-[rgba(238,234,248,0.04)]">
                        {students.map((student) => (
                          <label key={student.id} className="flex cursor-pointer items-center gap-3 border-b border-[rgba(238,234,248,0.08)] px-3 py-2.5 last:border-b-0">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={(event) => setSelectedStudents(event.target.checked
                                ? [...new Set([...selectedStudents, student.id])]
                                : selectedStudents.filter((studentId) => studentId !== student.id))}
                              className="h-4 w-4 accent-amethyst-link"
                            />
                            <span className="text-[12px] text-[rgba(238,234,248,0.78)]">{student.name}</span>
                            {student.id === selectedLibraryStudentId ? (
                              <span className="ml-auto text-[9px] uppercase tracking-[0.1em] text-[#b8adff]">Current tab</span>
                            ) : null}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="sticky bottom-0 flex flex-shrink-0 gap-3 bg-[#27273e] p-4 sm:p-6" style={{ borderTop: '1px solid rgba(238,234,248,0.12)' }}>
                <button type="button" onClick={resetForm} className="op-button op-button-secondary flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreateSubjectBlocked}
                  className="op-button flex-1 disabled:cursor-not-allowed">
                  {isCreateSubjectBlocked
                    ? 'Upgrade Required'
                    : editingSubject ? 'Save Settings' : `Create Subject${selectedStudents.length > 1 ? 's' : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailBlockDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Edit curriculum block">
          <div className="op-curriculum-block-modal">
            <div className="op-curriculum-block-modal-header">
              <div className="min-w-0">
                <p className="op-eyebrow">Block Editor</p>
                <h2 className="mt-2 truncate text-[22px] font-display leading-none text-white">
                  {detailBlockDraft.title || 'New block'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailBlockDraft(null)}
                className="op-icon-button"
                title="Close block editor"
                disabled={savingDetailBlock}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="op-curriculum-block-modal-body">
              <section className="op-curriculum-block-modal-section">
                <div>
                  <p className="text-[13px] font-label text-white">Instructions & resources</p>
                  <p className="mt-1 text-[11px] leading-5 text-[rgba(238,234,248,0.5)]">
                    What the student sees before starting this block.
                  </p>
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_140px_100px]">
                  <input
                    type="text"
                    value={detailBlockDraft.title}
                    onChange={(event) => updateDetailBlockDraft({ title: event.target.value })}
                    className="op-weekly-inline-input"
                    placeholder="Block name, e.g. Article summary"
                  />
                  <select
                    value={detailBlockDraft.type}
                    onChange={(event) => updateDetailBlockDraft({ type: event.target.value })}
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
                    onChange={(event) => updateDetailBlockDraft({ default_quantity: event.target.value })}
                    className="op-weekly-inline-input"
                    aria-label="Default weekly quantity"
                  />
                </div>

                <textarea
                  value={detailBlockDraft.instruction}
                  onChange={(event) => updateDetailBlockDraft({ instruction: event.target.value })}
                  className="op-curriculum-block-textarea"
                  placeholder="Student-facing instructions, objective, reading range, project direction, or completion notes"
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <div className="op-curriculum-block-toggle-row">
                    <div>
                      <p className="text-[12px] font-label text-white">Timer mandatory</p>
                      <p className="mt-1 text-[10px] text-[rgba(238,234,248,0.46)]">Require a timer for this block only.</p>
                    </div>
                    <Toggle
                      value={Boolean(detailBlockDraft.require_timer)}
                      onChange={(value) => updateDetailBlockDraft({ require_timer: value })}
                    />
                  </div>
                  <div className="op-curriculum-block-toggle-row">
                    <div>
                      <p className="text-[12px] font-label text-white">Written response</p>
                      <p className="mt-1 text-[10px] text-[rgba(238,234,248,0.46)]">Ask for the standard summary response.</p>
                    </div>
                    <Toggle
                      value={detailBlockDraft.require_input !== false}
                      onChange={(value) => updateDetailBlockDraft({ require_input: value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className={labelCls}>Resources</label>
                    <button type="button" onClick={handleAddDraftResource} className="op-proto-btn">
                      <Plus className="h-3.5 w-3.5" />
                      Add resource
                    </button>
                  </div>
                  {(Array.isArray(detailBlockDraft.resources) && detailBlockDraft.resources.length > 0
                    ? detailBlockDraft.resources
                    : [{ name: '', url: '' }]
                  ).map((resource, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_28px]">
                      <input
                        type="text"
                        value={resource.name}
                        onChange={(event) => handleDraftResourceChange(index, 'name', event.target.value)}
                        className="op-weekly-inline-input"
                        placeholder="Resource name"
                      />
                      <input
                        type="url"
                        value={resource.url}
                        onChange={(event) => handleDraftResourceChange(index, 'url', event.target.value)}
                        className="op-weekly-inline-input"
                        placeholder="https://..."
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveDraftResource(index)}
                        className="op-proto-icon-btn"
                        title="Remove resource"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section className="op-curriculum-block-modal-section">
                <div>
                  <p className="text-[13px] font-label text-white">Student response</p>
                  <p className="mt-1 text-[11px] leading-5 text-[rgba(238,234,248,0.5)]">
                    Define exactly what proves this block is complete.
                  </p>
                </div>

                <div className="space-y-2">
                  {(Array.isArray(detailBlockDraft.custom_fields) ? detailBlockDraft.custom_fields : []).map((field) => (
                    <div key={field.id} className="op-curriculum-response-field">
                      <div className="grid gap-2 md:grid-cols-[116px_minmax(0,1fr)]">
                        <select
                          value={field.type || 'text'}
                          onChange={(event) => handleDraftCustomFieldChange(field.id, 'type', event.target.value)}
                          className="op-weekly-inline-input"
                        >
                          <option value="text">Text</option>
                          <option value="number">Number</option>
                          <option value="file">Upload</option>
                        </select>
                        <input
                          type="text"
                          value={field.label || ''}
                          onChange={(event) => handleDraftCustomFieldChange(field.id, 'label', event.target.value)}
                          className="op-weekly-inline-input"
                          placeholder="Required response, e.g. Upload project photo"
                        />
                      </div>
                      <input
                        type="text"
                        value={field.placeholder || ''}
                        onChange={(event) => handleDraftCustomFieldChange(field.id, 'placeholder', event.target.value)}
                        className="op-weekly-inline-input"
                        placeholder="Student helper text, e.g. Pages 42-51 or brief paragraph"
                      />
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-[11px] text-[rgba(238,234,248,0.62)]">
                          <input
                            type="checkbox"
                            checked={Boolean(field.required)}
                            onChange={(event) => handleDraftCustomFieldChange(field.id, 'required', event.target.checked)}
                            className="h-3.5 w-3.5 accent-amethyst-link"
                          />
                          Required
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftCustomField(field.id)}
                          className="text-[11px] text-[rgba(238,234,248,0.42)] hover:text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={handleAddDraftCustomField} className="op-proto-btn op-proto-btn-primary">
                  <Plus className="h-3.5 w-3.5" />
                  Add response field
                </button>

                <div className="border-l-2 border-[#7c6fd4] bg-[rgba(124,111,212,0.1)] px-3 py-2 text-[10px] leading-4 text-[#cbb7fb]">
                  Use response fields for page numbers, project photos, worksheet uploads, or block-specific summary prompts.
                </div>
              </section>
            </div>

            <div className="op-curriculum-block-modal-footer">
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
        </div>
      ) : null}

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
                onClick={openNewDetailBlockDraft}
                className="op-proto-btn op-proto-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" />
                Add block
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
                {selectedSubjectRows.length === 0 ? (
                  <div className="op-proto-empty min-h-[220px]">
                    <ListChecks className="mx-auto h-8 w-8 text-[#b8adff]" />
                    <h3 className="mt-3 text-[15px] font-label text-white">No reusable blocks yet</h3>
                    <p className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[rgba(238,234,248,0.54)]">
                      This subject is ready. Add one reusable block, then choose its weekly quantity in Weekly Blocking.
                    </p>
                    <button type="button" onClick={openNewDetailBlockDraft} className="op-proto-btn op-proto-btn-primary mt-4">
                      <Plus className="h-3.5 w-3.5" /> Add first block
                    </button>
                  </div>
                ) : null}
                {selectedSubjectRows.map((row) => {
                  const rowRequiresTimer = typeof row.require_timer === 'boolean'
                    ? row.require_timer
                    : Boolean(selectedSubject.require_timer);
                  const rowRequiresInput = typeof row.require_input === 'boolean'
                    ? row.require_input
                    : selectedSubject.require_input !== false;
                  const rowResources = getConfiguredResources(row.resources?.length ? row.resources : selectedSubject.resources);

                  return (
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
                        {rowRequiresTimer ? (
                          <span className="op-proto-req"><Timer className="h-3 w-3" /> Timer</span>
                        ) : null}
                        {rowRequiresInput ? (
                          <span className="op-proto-req"><MessageSquareText className="h-3 w-3" /> Written response</span>
                        ) : null}
                        {rowResources.length ? (
                          <span className="op-proto-req"><BookOpen className="h-3 w-3" /> {rowResources.length} resource{rowResources.length === 1 ? '' : 's'}</span>
                        ) : null}
                        {row.customFields.length ? (
                          <span className="op-proto-req"><Upload className="h-3 w-3" /> {row.customFields.length} response field{row.customFields.length === 1 ? '' : 's'}</span>
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
                  );
                })}
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
              const totalBlocks = countDefaultBlockQuantity(subject);

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
