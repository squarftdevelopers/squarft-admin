import { apiRequest } from '../config/api';

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : '';
};

export const fetchProjectLeads = async (params = {}) => {
  const response = await apiRequest(`/api/admin/builder-leads${buildQuery(params)}`, { method: 'GET' });
  const data = response?.data ?? response;
  return { leads: data?.leads || [], count: data?.count || 0 };
};

export const updateProjectLeadStage = async (leadId, payload) => {
  const response = await apiRequest(`/api/admin/builder-leads/${leadId}/stage`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return response?.data ?? response;
};
