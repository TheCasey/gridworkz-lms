import { useState } from 'react';
import { Shirt, Sparkles, UserRound } from 'lucide-react';

const BASES = [
  { id: 'avatar-01', label: 'Base 01', tone: '#c88768' },
  { id: 'avatar-02', label: 'Base 02', tone: '#8d5d48' },
  { id: 'avatar-03', label: 'Base 03', tone: '#e0aa80' },
];
const OUTFITS = [
  { id: 'outfit-01', label: 'Indigo hoodie', color: '#7c6fd4' },
  { id: 'outfit-02', label: 'Explorer', color: '#3b8a70' },
  { id: 'outfit-03', label: 'Space suit', color: '#d8dce8' },
];
const ACCESSORIES = [
  { id: 'none', label: 'None' },
  { id: 'accessory-01', label: 'Explorer cap' },
  { id: 'accessory-02', label: 'Star glasses' },
];

const StudentAvatarWorkspace = () => {
  const [base, setBase] = useState(BASES[0]);
  const [outfit, setOutfit] = useState(OUTFITS[0]);
  const [accessory, setAccessory] = useState(ACCESSORIES[0]);

  return (
    <div className="student-workspace-layout" data-testid="student-avatar-workspace">
      <section className="student-workspace-main">
        <header className="student-page-heading"><div><h1>My avatar</h1><p>Preview a look from the placeholder avatar locker.</p></div><span className="student-status-chip">Preview only</span></header>
        <div className="student-avatar-layout">
          <div className="student-avatar-stage">
            <div className="student-avatar-base" style={{ backgroundColor: base.tone }} />
            <div className="student-avatar-outfit" style={{ backgroundColor: outfit.color }} />
            {accessory.id !== 'none' ? <div className={`student-avatar-accessory ${accessory.id}`} /> : null}
            <small>{base.id}.webp + {outfit.id}.webp{accessory.id === 'none' ? '' : ` + ${accessory.id}.webp`}</small>
          </div>
          <div className="student-avatar-options">
            <AvatarOptionGroup icon={UserRound} label="Base avatar" options={BASES} selected={base.id} onSelect={setBase} />
            <AvatarOptionGroup icon={Shirt} label="Outfit" options={OUTFITS} selected={outfit.id} onSelect={setOutfit} />
            <AvatarOptionGroup icon={Sparkles} label="Accessory" options={ACCESSORIES} selected={accessory.id} onSelect={setAccessory} />
          </div>
        </div>
      </section>
      <aside className="student-workspace-rail"><div className="student-rail-section"><p className="student-eyebrow">Avatar locker</p><div className="student-rail-stat"><span>Base avatars</span><strong>{BASES.length}</strong></div><div className="student-rail-stat"><span>Outfits</span><strong>{OUTFITS.length}</strong></div><div className="student-rail-stat"><span>Accessories</span><strong>{ACCESSORIES.length - 1}</strong></div></div><div className="student-rail-section"><p className="student-eyebrow">Not saved yet</p><p className="student-rail-copy">Avatar persistence will be added after the trusted asset-ID contract is approved.</p></div></aside>
    </div>
  );
};

const AvatarOptionGroup = ({ icon: Icon, label, options, selected, onSelect }) => (
  <section>
    <h2><Icon />{label}</h2>
    <div>
      {options.map((option) => <button key={option.id} type="button" className={selected === option.id ? 'is-selected' : ''} onClick={() => onSelect(option)}><strong>{option.label}</strong><small>{option.id === 'none' ? 'No layer' : `${option.id}.webp`}</small></button>)}
    </div>
  </section>
);

export default StudentAvatarWorkspace;
