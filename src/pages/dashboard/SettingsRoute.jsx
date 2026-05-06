import { useOutletContext } from 'react-router-dom';
import Settings from '../Settings';

const SettingsRoute = () => {
  const { entitlementSummary, handleSaveSettings, parentSettings, settingsSaving } =
    useOutletContext();

  return (
    <Settings
      settings={parentSettings}
      onSave={handleSaveSettings}
      saving={settingsSaving}
      entitlementSummary={entitlementSummary}
    />
  );
};

export default SettingsRoute;
