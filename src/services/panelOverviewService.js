import { apiRequest } from '../config/api';

const BASE = '/api/v1/admin/panel-overview';

const buildQS = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.append(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// Stats
export const fetchPanelStats = (params = {}) =>
  apiRequest(`${BASE}/stats${buildQS(params)}`);

// Builder KYC
export const fetchBuilderKycList = (params = {}) =>
  apiRequest(`${BASE}/builder-kyc/list${buildQS(params)}`);

export const fetchBuilderKycDetails = (id, params = {}) =>
  apiRequest(`${BASE}/builder-kyc/${id}${buildQS(params)}`);

export const updateBuilderKycStatus = (id, body) =>
  apiRequest(`${BASE}/builder-kyc/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// Project Onboarding
export const fetchOnboardingProjects = (params = {}) =>
  apiRequest(`${BASE}/onboarding/projects${buildQS(params)}`);

export const fetchProjectDevelopers = () =>
  apiRequest(`${BASE}/onboarding/project-developers`);

export const fetchProjectOnboardingDetails = (id, params = {}) =>
  apiRequest(`${BASE}/onboarding/projects/${id}${buildQS(params)}`);

export const decideProjectOnboarding = (id, body) =>
  apiRequest(`${BASE}/onboarding/projects/${id}/decision`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

// Live / Rejected projects
export const fetchLiveProjects = (params = {}) =>
  apiRequest(`${BASE}/projects/live${buildQS(params)}`);

export const fetchRejectedProjects = (params = {}) =>
  apiRequest(`${BASE}/projects/rejected${buildQS(params)}`);

// Field Officers
export const fetchFieldOfficersDropdown = (params = {}) =>
  apiRequest(`${BASE}/field-officers${buildQS(params)}`);

export const fetchOfficerDetails = (officerId, params = {}) =>
  apiRequest(`${BASE}/field-officers/${officerId}/details${buildQS(params)}`);

export const fetchOfficerProjects = (officerId, params = {}) =>
  apiRequest(`${BASE}/field-officers/${officerId}/projects${buildQS(params)}`);

export const fetchOfficerProjectOnboardingDetails = (officerId, projectId) =>
  apiRequest(`${BASE}/field-officers/${officerId}/projects/${projectId}/onboarding`);

export const fetchOfficerBuilderLeads = (officerId) =>
  apiRequest(`${BASE}/field-officers/${officerId}/leads`);

export const fetchBuilderLeadDetails = (leadId) =>
  apiRequest(`${BASE}/field-officers/leads/${leadId}`);

// Builder Lead Admin Actions (assign / send-back-for-correction / reject a document)
const BUILDER_LEADS_BASE = '/api/admin/builder-leads';

export const assignBuilderLeadToOfficer = (leadId, officerId) =>
  apiRequest(`${BUILDER_LEADS_BASE}/${leadId}/assign`, {
    method: 'PATCH',
    body: JSON.stringify({ officerId }),
  });

export const rejectBuilderLeadOnboarding = (leadId, body) =>
  apiRequest(`${BUILDER_LEADS_BASE}/${leadId}/reject-onboarding`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const rejectBuilderLeadDocument = (leadId, documentId, reason) =>
  apiRequest(`${BUILDER_LEADS_BASE}/${leadId}/documents/${documentId}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });

// Tasks
export const assignFieldTask = (body) =>
  apiRequest(`${BASE}/field-officers/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchAllBranchFieldTasks = (params = {}) =>
  apiRequest(`${BASE}/field-officers/tasks${buildQS(params)}`);

export const completeFieldTask = (taskId) =>
  apiRequest(`${BASE}/field-officers/tasks/${taskId}/complete`, { method: 'PUT' });

export const deleteFieldTask = (taskId) =>
  apiRequest(`${BASE}/field-officers/tasks/${taskId}`, { method: 'DELETE' });
