import { apiRequest } from '../config/api';

const VISITS_BASE = '/api/v1/visits';

const unwrapData = (response) => response?.data ?? response;

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

const formatSinglePrice = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return String(value).trim();
  if (num >= 10000000) return `${(num / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1).replace(/\.0$/, '')} L`;
  return num.toLocaleString('en-IN');
};

const formatPrice = (price) => {
  if (!price) return 'Price on request';
  const str = String(price).trim();
  if (str.includes('-')) {
    const parts = str.split('-').map(formatSinglePrice);
    return `Rs. ${parts.join(' - ')}`;
  }
  const num = Number(str);
  if (Number.isNaN(num)) return str;
  const formatted = formatSinglePrice(str);
  return `Rs. ${formatted}`;
};

const toDisplayDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getFullYear()).slice(-2)}`;
};

const parseFormDate = (value) => {
  if (!value) return '';
  const [day, month, year] = String(value).split(/[/-]/).map((part) => part.trim());
  if (day && month && year && day.length <= 2) {
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return value;
};

const toDisplayTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 5);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const addMinutes = (dateValue, minutes = 60) => {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return dateValue;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
};

const uiStatusByApiStatus = {
  pending: 'Scheduled',
  confirmed: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rescheduled: 'Scheduled',
};

const apiStatusByUiStatus = {
  Scheduled: 'pending',
  'In Progress': 'confirmed',
  Completed: 'completed',
  Cancelled: 'cancelled',
  Rescheduled: 'rescheduled',
};

export const toVisitApiStatus = (status) => apiStatusByUiStatus[status] || String(status || '').toLowerCase();

export const normalizeVisit = (visit = {}) => {
  const slotStart = visit.slot_start || visit.slotStart;
  const slotEnd = visit.slot_end || visit.slotEnd;
  const propertyName = visit.property_name || visit.propertyName || visit.property?.name || 'Property visit';

  return {
    id: visit.id,
    officerId: visit.officer_id || visit.officerId,
    officerName: visit.officer_name || visit.officerName || 'Unassigned',
    officerPhone: visit.officer_phone || visit.officerPhone || '',
    customerId: visit.user_id || visit.customerId,
    customerName: visit.customer_name || visit.customerName || 'Customer',
    customerPhone: visit.customer_phone || visit.customerPhone || '',
    projectName: visit.project_name || visit.projectName || '',
    branchName: visit.branch_name || visit.branchName || '',
    visitorsCount: Number(visit.visitors_count || visit.visitorsCount || 1),
    propertyId: visit.property_id || visit.propertyId,
    propertyCount: Number(visit.property_count || visit.propertyCount || 1),
    property: {
      id: visit.property_id || visit.propertyId,
      name: propertyName,
      type: visit.property_type || visit.property?.type || 'Property',
      config: visit.property_config || visit.property?.config || '',
      address: visit.property_address || visit.property?.address || '',
      price: formatPrice(visit.property_price || visit.property?.price),
    },
    date: toDisplayDate(slotStart || visit.date),
    time: slotStart && slotEnd
      ? `${toDisplayTime(slotStart)} - ${toDisplayTime(slotEnd)}`
      : toDisplayTime(slotStart || visit.time),
    slotStart,
    slotEnd,
    status: uiStatusByApiStatus[String(visit.status || '').toLowerCase()] || visit.status || 'Scheduled',
    apiStatus: visit.status,
    otpStatus: visit.otp_status || visit.otpStatus ? 'Verified' : 'Pending',
    notes: visit.notes || visit.user_note || '',
    purpose: visit.purpose || 'BUY',
    userReview: visit.userReview || '',
    userRating: visit.userRating,
    officerNote: visit.officer_note || '',
    leadTemperature: visit.lead_temperature || '',
    uploadedPhotos: visit.uploadedPhotos || [],
    dealId: visit.deal_id || visit.dealId || null,
    isConvertedToDeal: Boolean(visit.is_converted_to_deal || visit.isConvertedToDeal),
  };
};

const buildSlotRange = (payload = {}) => {
  if (payload.slotStart && payload.slotEnd) {
    return {
      slotStart: payload.slotStart,
      slotEnd: payload.slotEnd,
    };
  }

  const date = parseFormDate(payload.date);
  const startTime = String(payload.time || '').split('-')[0]?.trim();
  if (!date || !startTime) {
    return { slotStart: undefined, slotEnd: undefined };
  }

  const parsed = new Date(`${date} ${startTime}`);
  if (Number.isNaN(parsed.getTime())) {
    return { slotStart: undefined, slotEnd: undefined };
  }

  const slotStart = parsed.toISOString();
  return {
    slotStart,
    slotEnd: addMinutes(slotStart, 60),
  };
};

export const canPersistVisitPayload = (payload = {}) => (
  Boolean(payload.officerId && (payload.customerId || (payload.customerName && payload.customerPhone)) && payload.propertyId)
);

export const fetchVisitMetrics = async () =>
  unwrapData(await apiRequest(`${VISITS_BASE}/metrics`, { method: 'GET' }));

export const fetchVisits = async (params = {}) => {
  const data = unwrapData(await apiRequest(`${VISITS_BASE}${buildQueryString(params)}`, { method: 'GET' }));
  return {
    items: (data?.items || []).map(normalizeVisit),
    pagination: data?.pagination,
  };
};

export const fetchVisitById = async (visitId) =>
  normalizeVisit(unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}`, { method: 'GET' })));

export const createVisit = async (payload = {}) => {
  const { slotStart, slotEnd } = buildSlotRange(payload);

  return normalizeVisit(unwrapData(await apiRequest(VISITS_BASE, {
    method: 'POST',
    body: JSON.stringify({
      officerId: payload.officerId,
      customerId: payload.customerId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      propertyId: payload.propertyId,
      slotStart,
      slotEnd,
      notes: payload.notes,
    }),
  })));
};

export const saveVisit = async (visitId, payload = {}) => {
  const { slotStart, slotEnd } = buildSlotRange(payload);

  return normalizeVisit(unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}`, {
    method: 'PUT',
    body: JSON.stringify({
      officerId: payload.officerId,
      userId: payload.customerId,
      propertyId: payload.propertyId,
      slotStart,
      slotEnd,
      notes: payload.notes,
      status: toVisitApiStatus(payload.status),
    }),
  })));
};

export const saveVisitStatus = async (visitId, status, reason = '') =>
  unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: toVisitApiStatus(status),
      reason,
    }),
  }));

export const createVisitNote = async (visitId, text) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  }));

export const sendVisitOtp = async (visitId) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}/otp/send`, { method: 'POST' }));

export const verifyVisitOtp = async (visitId, otp) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}/otp/verify`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  }));

export const fetchOfficerAvailability = async (params = {}) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/availability/slots${buildQueryString(params)}`, { method: 'GET' }));

export const searchVisitProjects = async (q) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/projects/search${buildQueryString({ q })}`, { method: 'GET' }));

export const convertVisitToDeal = async (visitId, payload = {}) =>
  unwrapData(await apiRequest(`${VISITS_BASE}/${visitId}/convert-to-deal`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
