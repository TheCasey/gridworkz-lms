import { useOutletContext } from 'react-router-dom';
import Reports from '../Reports';

const ReportsRoute = () => {
  const { parentSettings } = useOutletContext();

  return <Reports parentSettings={parentSettings} />;
};

export default ReportsRoute;
