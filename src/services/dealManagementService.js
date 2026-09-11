import { apiRequest } from '../config/api';

const DEALS_BASE = '/api/v1/admin/deals';

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

const asNumber = (value) => Number(value || 0);

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

export const normalizeDealPayment = (payment = {}) => ({
  id: payment.id,
  milestone: payment.milestone || payment.title || '',
  amount: asNumber(payment.amount),
  dueDate: formatDate(payment.due_date || payment.dueDate),
  mode: payment.mode || 'Cash',
  status: payment.status || 'PENDING',
  updated: formatDate(payment.updated_at || payment.updated),
  collectedOn: formatDate(payment.paid_on || payment.collectedOn),
  reference: payment.reference || '',
});

export const normalizeDealDocument = (document = {}, dealCode = '') => ({
  id: document.id || `${dealCode}-${document.name || 'document'}`,
  name: document.name || document.title || 'Document',
  category: document.category || document.type || 'DOCUMENTS',
  type: document.type || document.category || 'DOCUMENT',
  source: document.source || 'admin',
  uploadedBy: document.source || document.uploadedBy || 'admin',
  status: document.status || 'pending',
  meta: document.fileType || document.type || 'PDF',
  visibleToUser: document.visibleToUser !== false,
  reviewedAt: formatDate(document.reviewed_at || document.reviewedAt),
  reviewedBy: document.reviewed_by || document.reviewedBy,
  uploadedAt: formatDate(document.uploaded_at || document.uploadedAt),
  fileUrl: document.fileUrl || document.file_url || document.url || '',
});

export const normalizeTokenPayment = (payment) => {
  if (!payment) return null;
  return {
    id: payment.id,
    amount: asNumber(payment.amount),
    dueDate: formatDate(payment.due_date || payment.dueDate),
    mode: payment.mode || 'Cash',
    status: payment.status || 'PENDING',
    collectedOn: formatDate(payment.paid_on || payment.collectedOn),
  };
};

export const normalizeDealNegotiation = (negotiation = {}) => ({
  id: negotiation.id,
  expectedAmount: asNumber(negotiation.expected_amount ?? negotiation.expectedAmount),
  customerOffer: asNumber(negotiation.customer_offer ?? negotiation.customerOffer),
  finalOffer: asNumber(negotiation.final_offer ?? negotiation.finalOffer),
  finalDeal: asNumber(negotiation.final_deal ?? negotiation.finalDeal),
  createdOn: formatDate(negotiation.created_at || negotiation.createdOn),
});

export const normalizeDealTimelineItem = (item = {}) => ({
  id: item.id || `${item.title || 'timeline'}-${item.created_at || Date.now()}`,
  title: item.title || item.stage_name || 'Timeline update',
  text: item.details || item.description || '',
  details: item.details || item.description || '',
  createdOn: formatDate(item.created_at || item.createdOn),
  status: item.status,
});

export const normalizeDealMeeting = (meeting = {}) => ({
  id: meeting.id,
  date: formatDate(meeting.date),
  time: meeting.time || '',
  mode: meeting.mode || '',
  agenda: meeting.agenda || '',
  remarks: meeting.remarks || '',
  status: meeting.status || 'SCHEDULED',
});

export const normalizeDealNote = (note = {}) => ({
  id: note.id,
  text: note.text || '',
  createdOn: formatDate(note.created_at || note.createdOn),
  createdBy: note.created_by || note.createdBy,
});

export const normalizeDeal = (deal = {}) => {
  const dealCode = deal.deal_code || deal.dealCode || deal.id || '';
  const negotiationPrice = asNumber(deal.negotiation_price ?? deal.negotiationPrice);
  const paidAmount = asNumber(deal.paid_amount ?? deal.paidAmount);

  return {
    id: deal.id || deal.deal_id || null,
    dealCode,
    customerId: deal.customer_id || deal.customerId,
    customer: deal.customer_name || deal.customer || '-',
    customerPhone: deal.customer_phone || deal.customerPhone || '-',
    property: deal.property_name || deal.property || deal.property_title || '-',
    city: deal.city || '-',
    salesOfficerId: deal.sales_officer_id || deal.salesOfficerId,
    salesOfficer: deal.sales_officer_name || deal.salesOfficer || '-',
    salesOfficerMobile: deal.sales_officer_mobile || deal.salesOfficerMobile || '-',
    brokerId: deal.broker_id || deal.brokerId,
    broker: deal.broker_name || deal.broker || (deal.broker_id ? 'Linked Broker' : '-'),
    brokerMobile: deal.broker_mobile || deal.brokerMobile || '-',
    status: deal.status || 'DEAL IN PROCESS',
    createdOn: formatDate(deal.created_on || deal.createdOn || deal.created_at),
    prefLocation: deal.pref_location || deal.prefLocation || '-',
    propType: deal.prop_type || deal.propType || 'Property',
    address: deal.address || '-',
    khasra: deal.khasra || '',
    expectPrice: asNumber(deal.expect_price ?? deal.expectPrice),
    negotiationPrice,
    paidAmount,
    remainingBalance: asNumber(deal.remaining_balance ?? deal.remainingBalance ?? (negotiationPrice - paidAmount)),
    projectId: deal.project_id || deal.projectId,
    propertyId: deal.property_id || deal.propertyId,
    propertyMedia: Array.isArray(deal.property_media || deal.propertyMedia)
      ? (deal.property_media || deal.propertyMedia).map((media) => ({
        id: media.id,
        url: media.url || media.file_url || media.fileUrl || '',
        label: media.label || 'Property image',
      })).filter((media) => media.url)
      : [],
    unitId: deal.unit_id || deal.unitId,
    visitId: deal.visit_id || deal.visitId || null,
    payments: Array.isArray(deal.payments) ? deal.payments.map(normalizeDealPayment) : deal.payments,
    tokenPayment: normalizeTokenPayment(deal.tokenPayment || deal.token_payment),
    negotiations: Array.isArray(deal.negotiations) ? deal.negotiations.map(normalizeDealNegotiation) : deal.negotiations,
    documents: Array.isArray(deal.documents) ? deal.documents.map((document) => normalizeDealDocument(document, dealCode)) : deal.documents,
    timeline: Array.isArray(deal.timeline) ? deal.timeline.map(normalizeDealTimelineItem) : deal.timeline,
    notes: Array.isArray(deal.notes) ? deal.notes.map(normalizeDealNote) : deal.notes,
    meetings: Array.isArray(deal.meetings) ? deal.meetings.map(normalizeDealMeeting) : deal.meetings,
  };
};

export const fetchDealMetrics = async () =>
  unwrapData(await apiRequest(`${DEALS_BASE}/metrics`, { method: 'GET' }));

export const searchDealCustomers = async (q) => {
  const data = unwrapData(await apiRequest(`${DEALS_BASE}/customers/search?q=${encodeURIComponent(q)}`, { method: 'GET' }));
  return data?.customers || [];
};

export const createDeal = async (payload = {}) =>
  normalizeDeal(unwrapData(await apiRequest(DEALS_BASE, {
    method: 'POST',
    body: JSON.stringify({
      customerId: payload.customerId,
      projectId: payload.projectId,
      unitId: payload.unitId || undefined,
      salesOfficerId: payload.salesOfficerId,
      brokerId: payload.brokerId || undefined,
      expectPrice: payload.expectPrice,
      negotiationPrice: payload.negotiationPrice,
      propType: payload.propType || undefined,
      address: payload.address || undefined,
      prefLocation: payload.prefLocation || undefined,
      khasra: payload.khasra || undefined,
      branchId: payload.branchId || undefined,
    }),
  })));

export const fetchDeals = async (params = {}) => {
  const data = unwrapData(await apiRequest(`${DEALS_BASE}${buildQueryString(params)}`, { method: 'GET' }));
  return {
    items: (data?.items || []).map(normalizeDeal),
    pagination: data?.pagination,
  };
};

export const fetchDealById = async (dealId) =>
  normalizeDeal(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}`, { method: 'GET' })));

export const removeDeal = async (dealId) =>
  apiRequest(`${DEALS_BASE}/${dealId}`, { method: 'DELETE' });

export const updateDealStatus = async (dealId, { status, note } = {}) =>
  unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note }),
  }));

export const addDealMeeting = async (dealId, meeting) =>
  normalizeDealMeeting(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/meetings`, {
    method: 'POST',
    body: JSON.stringify({
      date: meeting.date,
      time: meeting.time,
      mode: meeting.mode || 'Site Visit',
      agenda: meeting.agenda || 'Deal discussion',
      remarks: meeting.remarks,
    }),
  })));

export const addDealNote = async (dealId, text) =>
  normalizeDealNote(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  })));

export const addPaymentMilestone = async (dealId, payment) =>
  normalizeDealPayment(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/payments`, {
    method: 'POST',
    body: JSON.stringify({
      milestone: payment.milestone,
      amount: payment.amount,
      dueDate: payment.dueDate,
      mode: payment.mode,
    }),
  })));

export const updatePaymentMilestone = async (dealId, paymentId, payment) =>
  normalizeDealPayment(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/payments/${paymentId}`, {
    method: 'PUT',
    body: JSON.stringify({
      milestone: payment.milestone,
      amount: payment.amount,
      dueDate: payment.dueDate,
      mode: payment.mode,
      status: payment.status,
    }),
  })));

export const deletePaymentMilestone = async (dealId, paymentId) =>
  apiRequest(`${DEALS_BASE}/${dealId}/payments/${paymentId}`, { method: 'DELETE' });

export const saveTokenPayment = async (dealId, payment) =>
  normalizeTokenPayment(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/token-payment`, {
    method: 'POST',
    body: JSON.stringify({
      amount: payment.amount,
      dueDate: payment.dueDate,
      mode: payment.mode,
    }),
  })));

export const collectTokenPayment = async (dealId) =>
  normalizeTokenPayment(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/token-payment/status`, {
    method: 'PATCH',
  })));

export const addNegotiation = async (dealId, negotiation) =>
  normalizeDealNegotiation(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/negotiations`, {
    method: 'POST',
    body: JSON.stringify({
      expectedAmount: negotiation.expectedAmount,
      customerOffer: negotiation.customerOffer,
      finalOffer: negotiation.finalOffer,
      finalDeal: negotiation.finalDeal,
    }),
  })));

export const updateDocumentStatus = async (dealId, documentId, status) =>
  normalizeDealDocument(unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/documents/${documentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })), dealId);

export const markPaymentReceived = async (dealId, paymentId, payload = {}) =>
  unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/payments/${paymentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: payload.status || 'COMPLETED',
      paidOn: payload.paidOn || formatDate(new Date()),
      reference: payload.reference || '',
    }),
  }));

export const uploadDealDocument = async (dealId, { file, type, name }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);
  if (name) formData.append('name', name);
  return unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/documents`, {
    method: 'POST',
    body: formData,
  }));
};

export const deleteDealDocument = async (dealId, documentId) =>
  unwrapData(await apiRequest(`${DEALS_BASE}/${dealId}/documents/${documentId}`, {
    method: 'DELETE',
  }));
