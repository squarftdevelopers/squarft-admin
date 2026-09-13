import { apiRequest } from '../config/api';

const NOTIFICATION_ENDPOINTS = {
  BASE: '/api/admin/notifications',
  TARGETS: '/api/admin/notifications/targets',
  TEMPLATES: '/api/admin/notifications/templates',
  PAYLOAD_PREVIEW: '/api/admin/notifications/payload-preview',
  CAMPAIGNS: '/api/admin/notifications/campaigns',
  CAMPAIGN_DETAIL: (campaignId) => `/api/admin/notifications/campaigns/${campaignId}`,
  RECEIPTS_SYNC: (campaignId) => `/api/admin/notifications/campaigns/${campaignId}/receipts/sync`,
  MEDIA: '/api/admin/notifications/media',
};

const unwrapData = (response) => response?.data ?? response;

const clientError = (message, errors = []) => ({
  status: 400,
  message,
  errors,
});

const buildQueryString = (params = {}) => {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value);
    }
  });

  const queryString = queryParams.toString();
  return queryString ? `?${queryString}` : '';
};

const getRequest = async (endpoint, params) => {
  const response = await apiRequest(`${endpoint}${buildQueryString(params)}`, {
    method: 'GET',
  });

  return unwrapData(response);
};

const normalizeNotificationPayload = (payload = {}) => {
  if (!Array.isArray(payload.targetApps) || payload.targetApps.length === 0) {
    throw clientError('Select at least one target app', [
      { field: 'targetApps', message: 'targetApps must be a non-empty array' },
    ]);
  }

  if (!payload.title?.trim() || !payload.body?.trim()) {
    throw clientError('Title and body are required', [
      !payload.title?.trim() && { field: 'title', message: 'title is required' },
      !payload.body?.trim() && { field: 'body', message: 'body is required' },
    ].filter(Boolean));
  }

  return {
    targetApps: payload.targetApps,
    title: payload.title.trim(),
    body: payload.body.trim(),
    priority: payload.priority || 'normal',
    ttlHours: payload.ttlHours === undefined || payload.ttlHours === ''
      ? 24
      : Number(payload.ttlHours),
    sound: payload.sound || null,
    categoryId: payload.categoryId?.trim() || null,
    collapseId: payload.collapseId?.trim() || null,
    imageUrl: payload.imageUrl?.trim() || null,
    route: payload.route?.trim() || null,
    extraData: payload.extraData || {},
  };
};

export const fetchNotificationTargets = async () =>
  getRequest(NOTIFICATION_ENDPOINTS.TARGETS);

export const fetchNotificationTemplates = async () =>
  getRequest(NOTIFICATION_ENDPOINTS.TEMPLATES);

export const previewNotificationPayload = async (payload = {}) => {
  const response = await apiRequest(NOTIFICATION_ENDPOINTS.PAYLOAD_PREVIEW, {
    method: 'POST',
    body: JSON.stringify(normalizeNotificationPayload(payload)),
  });

  return unwrapData(response);
};

export const fetchNotificationCampaigns = async (params = {}) =>
  getRequest(NOTIFICATION_ENDPOINTS.CAMPAIGNS, {
    page: params.page,
    limit: params.limit,
    status: params.status,
    appKey: params.appKey,
    search: params.search,
    fromDate: params.fromDate,
    toDate: params.toDate,
    createdBy: params.createdBy,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  });

export const createNotificationCampaign = async (payload = {}) => {
  const response = await apiRequest(NOTIFICATION_ENDPOINTS.CAMPAIGNS, {
    method: 'POST',
    body: JSON.stringify({
      ...normalizeNotificationPayload(payload),
      sendMode: payload.sendMode || 'QUEUE',
    }),
  });

  return unwrapData(response);
};

export const fetchNotificationCampaignDetail = async (campaignId) => {
  if (!campaignId) {
    throw clientError('Campaign ID is required', [
      { field: 'campaignId', message: 'campaignId is required' },
    ]);
  }

  return getRequest(NOTIFICATION_ENDPOINTS.CAMPAIGN_DETAIL(campaignId));
};

export const syncNotificationCampaignReceipts = async (campaignId, options = {}) => {
  if (!campaignId) {
    throw clientError('Campaign ID is required', [
      { field: 'campaignId', message: 'campaignId is required' },
    ]);
  }

  const response = await apiRequest(NOTIFICATION_ENDPOINTS.RECEIPTS_SYNC(campaignId), {
    method: 'POST',
    body: JSON.stringify({
      force: Boolean(options.force),
    }),
  });

  return unwrapData(response);
};

export const fetchAdminNotifications = async (params = {}) =>
  getRequest(NOTIFICATION_ENDPOINTS.BASE, {
    page: params.page,
    limit: params.limit,
    unreadOnly: params.unreadOnly,
    type: params.type,
  });

export const uploadNotificationMedia = async (file, altText = '') => {
  const formData = new FormData();
  formData.append('file', file);
  if (altText) {
    formData.append('altText', altText);
  }

  const response = await apiRequest(NOTIFICATION_ENDPOINTS.MEDIA, {
    method: 'POST',
    body: formData,
  });

  return unwrapData(response);
};
