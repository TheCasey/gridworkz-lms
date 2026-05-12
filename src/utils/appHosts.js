const DEFAULT_PUBLIC_HOST = 'own-path.com';
const DEFAULT_DASHBOARD_HOST = 'dashboard.own-path.com';

const trimSlashes = (value = '') => value.replace(/^\/+|\/+$/g, '');

const getConfiguredHost = (envKey, fallback) => {
  const envValue = import.meta.env?.[envKey];
  return typeof envValue === 'string' && envValue.trim() ? envValue.trim() : fallback;
};

export const getPublicHost = () => getConfiguredHost('VITE_PUBLIC_APP_HOST', DEFAULT_PUBLIC_HOST);

export const getDashboardHost = () => (
  getConfiguredHost('VITE_DASHBOARD_APP_HOST', DEFAULT_DASHBOARD_HOST)
);

export const isLocalHost = (hostname = window.location.hostname) => (
  hostname === 'localhost'
  || hostname === '127.0.0.1'
  || hostname === '0.0.0.0'
  || hostname.endsWith('.local')
);

export const isDashboardHost = (hostname = window.location.hostname) => (
  hostname === getDashboardHost()
);

export const shouldUseSplitHosts = (hostname = window.location.hostname) => (
  !isLocalHost(hostname)
  && (hostname === getPublicHost() || hostname === getDashboardHost())
);

export const buildAppUrl = (host, path = '/') => {
  if (!shouldUseSplitHosts()) {
    return path;
  }

  const protocol = window.location.protocol || 'https:';
  const normalizedPath = trimSlashes(path);
  return `${protocol}//${host}${normalizedPath ? `/${normalizedPath}` : ''}`;
};

export const buildPublicUrl = (path = '/') => buildAppUrl(getPublicHost(), path);

export const buildDashboardUrl = (path = '/dashboard') => buildAppUrl(getDashboardHost(), path);

export const redirectToUrl = (url) => {
  if (url.startsWith('/')) {
    window.location.replace(url);
    return;
  }

  window.location.replace(url);
};
