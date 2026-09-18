import { apiRequest } from '../config/api';

const ADMIN_BROKERS_BASE = '/api/admin/brokers';

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
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const titleCaseStatus = (value, fallback = 'Pending') => {
  const status = String(value || fallback).replace(/_/g, ' ').trim();
  if (!status) return fallback;
  return status
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getBrokerName = (broker = {}) => {
  const fullName = [broker.first_name, broker.last_name].filter(Boolean).join(' ').trim();
  return broker.name || broker.full_name || fullName || broker.email || 'Broker';
};

export const normalizeBrokerTransaction = (transaction = {}) => ({
  id: transaction.id,
  property_name: transaction.property_name || transaction.propertyName || transaction.transfer_to_details || 'Wallet transaction',
  type: String(transaction.type || '').toLowerCase(),
  amount: asNumber(transaction.amount),
  bank_name: transaction.bank_name || transaction.bank_title || transaction.transfer_to_details || 'Wallet balance',
  account_number: transaction.account_number || transaction.accountNumber || transaction.account_number_masked || '',
  account_number_masked: transaction.account_number_masked || '',
  ifsc_code: transaction.ifsc_code || transaction.ifscCode || transaction.ifsc || '',
  created_at: formatDate(transaction.created_at || transaction.createdAt),
  status: titleCaseStatus(transaction.status),
  utr: transaction.utr || '',
  is_withdrawal_request: Boolean(transaction.is_withdrawal_request),
});

export const normalizeBrokerCommission = (commission = {}) => ({
  id: commission.id,
  propertyName: commission.property_name || commission.propertyName || 'Commission credit',
  location: commission.property_address || commission.location || '',
  saleValue: asNumber(commission.sale_value || commission.saleValue),
  rate: asNumber(commission.rate),
  amount: asNumber(commission.amount),
  status: titleCaseStatus(commission.status, 'Completed'),
  createdAt: formatDate(commission.created_at || commission.createdAt),
  transactionId: commission.transaction_id || commission.transfer_to_details || commission.id,
});

export const normalizeBrokerProperty = (property = {}) => ({
  id: property.id,
  name: property.name || property.title || 'Property',
  category: property.category || 'Property',
  type: property.type || property.property_type || 'Unit',
  location: property.location || property.address || '-',
  price: asNumber(property.price),
  status: titleCaseStatus(property.status),
  photos: asNumber(property.photos || property.photo_count),
  documents: asNumber(property.documents || property.document_count),
  uploadedOn: formatDate(property.uploaded_on || property.uploadedOn || property.created_at),
});

export const normalizeBrokerAccount = (account = {}) => ({
  id: account.id,
  bankName: account.bankName || account.bank_name || 'Bank account',
  accountNumberMasked: account.accountNumberMasked || account.account_number_masked || 'xxxx',
  accountNumber: account.accountNumber || account.account_number || account.accountNumberMasked || account.account_number_masked || 'xxxx',
  ifsc: account.ifsc || account.ifsc_code || '-',
  primary: Boolean(account.primary ?? account.is_default),
  status: titleCaseStatus(account.status, 'Verified'),
});

export const normalizeBroker = (broker = {}) => {
  const wallet = broker.wallet || {};
  const stats = broker.stats || {};

  return {
    id: broker.id,
    name: getBrokerName(broker),
    agency: broker.agency || broker.organisation_name || broker.company_name || 'Independent broker',
    mobile: broker.mobile || broker.phone || '-',
    email: broker.email || '-',
    city: broker.city || '-',
    area: broker.area || '',
    kycStatus: titleCaseStatus(broker.kycStatus || broker.kyc_status, 'Pending'),
    brokerStatus: titleCaseStatus(broker.brokerStatus || broker.status, 'Active'),
    joinedOn: formatDate(broker.joinedOn || broker.joined_on || broker.created_at),
    stats: {
      total_properties: asNumber(stats.total_properties ?? broker.total_properties),
      sales: asNumber(stats.sales ?? broker.sales),
      pending: asNumber(stats.pending ?? broker.pending),
      rejected: asNumber(stats.rejected ?? broker.rejected),
    },
    wallet: {
      balance: asNumber(wallet.balance ?? broker.wallet_balance),
      totalEarned: asNumber(wallet.totalEarned),
      totalWithdrawn: asNumber(wallet.totalWithdrawn),
      lockedAmount: asNumber(wallet.lockedAmount),
      withdrawalPending: asNumber(wallet.withdrawalPending),
    },
    bankAccounts: Array.isArray(broker.bankAccounts) ? broker.bankAccounts.map(normalizeBrokerAccount) : [],
    uploadedProperties: Array.isArray(broker.uploadedProperties) ? broker.uploadedProperties.map(normalizeBrokerProperty) : [],
    clients: Array.isArray(broker.clients) ? broker.clients : [],
    commissions: Array.isArray(broker.commissions) ? broker.commissions.map(normalizeBrokerCommission) : [],
    transactions: Array.isArray(broker.transactions) ? broker.transactions.map(normalizeBrokerTransaction) : [],
    withdrawals: Array.isArray(broker.withdrawals) ? broker.withdrawals : [],
  };
};

export const fetchBrokerSummary = async () =>
  unwrapData(await apiRequest(`${ADMIN_BROKERS_BASE}/summary`, { method: 'GET' }));

export const fetchBrokerList = async (params = {}) => {
  const response = await apiRequest(`${ADMIN_BROKERS_BASE}${buildQueryString({ page: 1, limit: 100, ...params })}`, {
    method: 'GET',
  });

  return {
    items: (unwrapData(response) || []).map(normalizeBroker),
    pagination: response?.pagination,
  };
};

export const fetchBrokerProperties = async (brokerId, params = {}) => {
  const response = await apiRequest(
    `${ADMIN_BROKERS_BASE}/${brokerId}/properties${buildQueryString({ limit: 100, ...params })}`,
    { method: 'GET' },
  );

  return (unwrapData(response) || []).map(normalizeBrokerProperty);
};

export const fetchBrokerDetail = async (brokerId) => {
  const [profile, wallet, transactions, commissions] = await Promise.all([
    apiRequest(`${ADMIN_BROKERS_BASE}/${brokerId}`, { method: 'GET' }).then(unwrapData),
    apiRequest(`${ADMIN_BROKERS_BASE}/${brokerId}/wallet`, { method: 'GET' }).then(unwrapData),
    apiRequest(`${ADMIN_BROKERS_BASE}/${brokerId}/transactions?limit=100`, { method: 'GET' }).then(unwrapData),
    apiRequest(`${ADMIN_BROKERS_BASE}/${brokerId}/commissions?limit=100`, { method: 'GET' }).then(unwrapData),
  ]);

  return normalizeBroker({
    ...profile,
    wallet: {
      ...(profile?.wallet || {}),
      ...(wallet || {}),
    },
    transactions: transactions || profile?.transactions || [],
    commissions: commissions || profile?.commissions || [],
  });
};

export const approveBrokerTransaction = async (brokerId, transactionId, paymentReference = '') => {
  const body = paymentReference ? JSON.stringify({ utr: paymentReference }) : undefined;
  const transaction = unwrapData(await apiRequest(
    `${ADMIN_BROKERS_BASE}/${brokerId}/transactions/${transactionId}/approve`,
    { method: 'PATCH', ...(body ? { body } : {}) },
  ));

  return {
    id: transaction?.id,
    status: titleCaseStatus(transaction?.status),
    utr: transaction?.utr || paymentReference || '',
  };
};

export const confirmBrokerTransaction = async (brokerId, transactionId) => {
  const transaction = unwrapData(await apiRequest(
    `${ADMIN_BROKERS_BASE}/${brokerId}/transactions/${transactionId}/confirm`,
    { method: 'PATCH' },
  ));

  return {
    id: transaction?.id,
    status: titleCaseStatus(transaction?.status, 'Confirmed'),
    utr: transaction?.utr || undefined,
  };
};
