import { apiRequest } from '../config/api';

const CLIENT_HUB_BASE = '/api/admin/client-hub';
const ADMIN_LEADS_BASE = '/api/admin/leads';

const unwrapData = (response) => response?.data ?? response;

let propertyProjectMapPromise = null;

const fetchPropertyProjectMap = async () => {
  if (!propertyProjectMapPromise) {
    propertyProjectMapPromise = apiRequest('/api/v1/properties/list?limit=5000', { method: 'GET' })
      .then((response) => {
        const properties = unwrapData(response) || [];

        return properties.reduce((map, property) => {
          const projectId = property.project_id || property.projectId;
          if (projectId && property.id && !map.has(projectId)) {
            map.set(projectId, property.id);
          }
          return map;
        }, new Map());
      })
      .catch(() => new Map());
  }

  return propertyProjectMapPromise;
};

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

const toTitleCase = (value) => String(value || '')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (char) => char.toUpperCase());

const normalizeDateInput = (value) => {
  if (!value || value === 'Not scheduled' || value === 'Not Scheduled') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
};

const formatStamp = (value) => {
  if (!value) return { date: '', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: String(value), time: '' };

  return {
    date: date.toLocaleDateString('en-IN'),
    time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
};

const normalizeSource = (value) => {
  const source = String(value || '').toUpperCase();
  const sourceMap = {
    BROKER: 'Broker',
    USER: 'User',
    SALES_OFFICER: 'Sales Officer',
    META_ADS: 'Meta Ads',
    WEBSITE: 'Website',
    BRANCH_MANUAL: 'User',
  };
  return sourceMap[source] || '';
};

const normalizeTemperature = (value) => {
  const temperature = toTitleCase(value || 'Warm');
  return ['Hot', 'Warm', 'Cold'].includes(temperature) ? temperature : 'Warm';
};

const normalizeClientStatus = (value) => {
  const status = toTitleCase(value || 'Active');
  if (status === 'In Progress') return 'Active';
  return status || 'Active';
};

const inferCategory = (propertyType = '') => {
  const value = String(propertyType).toLowerCase();
  if (['shop', 'showroom', 'office', 'commercial'].some((item) => value.includes(item))) {
    return 'Commercial';
  }
  return 'Residential';
};

const normalizePropertyType = (value) => {
  if (!value) return 'N/A';
  return String(value).replace(/\s+/g, ' ').trim();
};

const formatCurrency = (amount) => {
  if (amount === null || amount === undefined || amount === '') return 'N/A';
  const num = Number(amount);
  if (!Number.isFinite(num)) return 'N/A';
  if (num >= 10000000) return `${(num / 10000000).toFixed(1).replace(/\.0$/, '')} Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1).replace(/\.0$/, '')} L`;
  return num.toLocaleString('en-IN');
};

const parseAmount = (value) => {
  const raw = String(value || '').replace(/rs\.?/gi, '').replace(/,/g, '').trim();
  const number = Number(raw.match(/[\d.]+/)?.[0] || 0);
  if (!number) return null;
  if (/cr/i.test(raw)) return Math.round(number * 10000000);
  if (/\bl\b|lakh|lac/i.test(raw)) return Math.round(number * 100000);
  return Math.round(number);
};

export const parseBudgetRange = (budget = '') => {
  const [minValue, maxValue] = String(budget).split(/\s*-\s*/);
  const min = parseAmount(minValue);
  const max = parseAmount(maxValue || minValue);

  return {
    budget_min: min,
    budget_max: max,
  };
};

export const normalizeClientSummary = (client = {}) => {
  const requirement = client.requirement || {};
  const propertyType = normalizePropertyType(requirement.type || client.property_type || client.propertyType);
  const source = normalizeSource(client.source_type || client.sourceType || client.source);
  const budget = requirement.budget
    || (client.budgetMin || client.budgetMax
      ? `${formatCurrency(client.budgetMin)} - ${formatCurrency(client.budgetMax)}`
      : 'Not Specified');
  const officerName = client.officer_name || client.assignedOfficer?.name || 'Unassigned';

  return {
    id: client.id,
    displayCode: client.lead_code || client.leadCode || client.client_code || client.id,
    name: client.name || 'Client',
    phone: client.phone || '',
    budget,
    source,
    listingType: 'Buy',
    listingKind: inferCategory(propertyType),
    propType: propertyType,
    date: '',
    time: '',
    req: {
      type: inferCategory(propertyType),
      bhk: propertyType && propertyType !== 'N/A' ? [propertyType] : [],
      loc: [],
      timeline: 'Not Specified',
    },
    status: normalizeClientStatus(client.status || client.pipeline_status || client.pipelineStatus),
    officer: officerName,
    score: normalizeTemperature(client.temperature),
    visitToday: false,
    nextFollowUp: normalizeDateInput(client.next_follow_up),
    latestNote: client.latest_note || client.manualSummary || client.requirementSummary || 'No recent updates.',
    actionRequired: false,
    propertyPipeline: [],
    timeline: [],
    notes: [],
    meetings: [],
    customerRequirements: [],
  };
};

const buildLeadFallbackParams = (params = {}) => {
  const sourceMap = {
    Broker: 'BROKER',
    User: 'USER',
    'Sales Officer': 'SALES_OFFICER',
    'Meta Ads': 'META_ADS',
    Website: 'WEBSITE',
  };
  const tabMap = {
    'Hot Clients': 'HOT',
    'Cold Clients': 'COLD',
    'Suspended Clients': 'SUSPENDED',
  };

  return {
    search: params.search,
    source: sourceMap[params.via],
    temperature: tabMap[params.tab],
    page: params.page || 1,
    limit: params.limit || 50,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  };
};

const fetchClientsFromLeads = async (params = {}) => {
  const response = await apiRequest(`${ADMIN_LEADS_BASE}${buildQueryString(buildLeadFallbackParams(params))}`, {
    method: 'GET',
  });
  const data = unwrapData(response);
  const items = (data?.leads || []).map(normalizeClientSummary);
  const filteredItems = params.follow_up_date
    ? items.filter((client) => client.nextFollowUp === params.follow_up_date)
    : items;

  return {
    items: filteredItems,
    pagination: data?.pagination,
    source: 'leads-fallback',
  };
};

const normalizePipelineItem = (item = {}) => {
  const projId = item.project_id || item.projectId || item.project?.id;
  const propId = item.property_id || item.propertyId || item.property?.id || null;
  const projName = item.project_name || item.projectName || item.project?.name || 'Project';
  const unitCodes = item.target_units
    ? String(item.target_units).split(',').map(u => u.trim()).filter(Boolean)
    : (item.unit?.unit_code ? [item.unit.unit_code] : []);

  return {
    id: item.assigned_property_id
      || item.assignedPropertyId
      || item.assigned_property?.id
      || item.assignment?.id
      || item.pipeline_id
      || item.assignment_id
      || item.id,
    projectId: projId,
    propertyId: propId,
    projectName: projName,
    status: toTitleCase(item.status || item.assignment_status || 'Shortlisted'),
    units: unitCodes,
    visitedOn: null,
    notes: item.notes || item.latest_update || 'Assigned to client.',
    unit: item.unit ? {
      id: item.unit.id,
      unitCode: item.unit.unit_code || item.unit.unitCode,
      configuration: item.unit.configuration,
      areaSqft: item.unit.area_sqft || item.unit.areaSqft,
      price: item.unit.price,
      status: item.unit.status
    } : null,
    siteVisit: item.site_visit || null,
    deal: item.deal || null
  };
};

export const mergeClientProfile = (summary = {}, overview = {}) => {
  const header = overview.header || {};
  const requirement = overview.requirement_profile || {};
  const propertyType = normalizePropertyType(requirement.property_type || summary.propType);
  const locations = String(requirement.preferred_locations || '')
    .split(/\s*\/\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    ...summary,
    name: header.name || summary.name,
    phone: header.phone || summary.phone,
    budget: header.approved_budget || summary.budget,
    status: normalizeClientStatus(header.status || summary.status),
    officer: header.officer_name || summary.officer,
    officerPhone: header.officer_phone || summary.officerPhone || '',
    listingKind: inferCategory(propertyType),
    propType: propertyType,
    req: {
      type: inferCategory(propertyType),
      bhk: (header.tags || []).filter(Boolean),
      loc: locations,
      timeline: requirement.timeline || 'Not Specified',
    },
    propertyPipeline: (overview.pipeline || []).map(normalizePipelineItem),
  };
};

export const normalizeRequirement = (requirement = {}, client = {}) => {
  const propertyType = normalizePropertyType(requirement.property_type);
  const location = requirement.preferred_locations || requirement.location;
  const preferredLocations = Array.isArray(location)
    ? location
    : String(location || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  return {
    id: requirement.id,
    customer_name: requirement.customer_name || client.name || '',
    contact_number: requirement.contact_number || client.phone || '',
    requirement_type: toTitleCase(requirement.type || requirement.requirement_type || 'Buy'),
    property_category: toTitleCase(requirement.property_category) || inferCategory(propertyType),
    property_type: propertyType,
    configuration: 'N/A',
    min_area: requirement.min_area || '',
    max_area: requirement.max_area || '',
    area_unit: requirement.area_unit || 'Square Feet (Sq. ft)',
    budget_min: requirement.budget_min || '',
    budget_max: requirement.budget_max || '',
    budget_range: requirement.budget_range || '',
    preferred_locations: preferredLocations,
    notes: requirement.notes || '',
    contact_verified: Boolean(requirement.contact_verified),
    created_at: requirement.created_at,
  };
};

export const normalizeTimelineAndNotes = (payload = {}) => ({
  timeline: (payload.timeline || []).map((item) => {
    const stamp = formatStamp(item.timestamp || item.created_at);
    return {
      id: item.id,
      title: item.title || toTitleCase(item.event_type || 'Update'),
      details: item.description || 'System update',
      date: stamp.date,
      time: stamp.time,
    };
  }),
  notes: (payload.notes || []).map((item) => {
    const stamp = formatStamp(item.timestamp || item.created_at);
    return {
      id: item.id,
      type: item.type || 'General Note',
      text: item.content || item.note || item.summary || '',
      date: stamp.date,
      time: stamp.time,
    };
  }),
  nextFollowUp: normalizeDateInput(payload.summary?.next_follow_up),
  status: normalizeClientStatus(payload.summary?.current_status),
});

export const normalizeClientVisit = (visit = {}, client = {}) => {
  const slotStart = visit.slot_start ? new Date(visit.slot_start) : null;
  const slotEnd = visit.slot_end ? new Date(visit.slot_end) : null;
  const validStart = slotStart && !Number.isNaN(slotStart.getTime()) ? slotStart : null;
  const validEnd = slotEnd && !Number.isNaN(slotEnd.getTime()) ? slotEnd : null;

  const formatTime = (date) => date?.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) || '';

  return {
    id: visit.id || visit.visit_id,
    assignedPropertyId: visit.assigned_property_id || visit.assignedPropertyId || null,
    propertyId: visit.property_id || visit.propertyId || null,
    customerName: visit.customer_name || client.name || 'Client',
    customerPhone: visit.customer_phone || client.phone || '',
    officerName: visit.officer || visit.officer_name || 'Unassigned',
    property: {
      name: visit.property || visit.property_name || 'Property visit',
      type: visit.property_type || 'Property',
      config: visit.property_config || '',
      address: visit.property_address || '',
      price: visit.property_price || '',
    },
    date: validStart ? validStart.toLocaleDateString('en-IN') : (visit.date_and_time || ''),
    time: validStart && validEnd ? `${formatTime(validStart)} - ${formatTime(validEnd)}` : (visit.date_and_time || ''),
    slotStart: visit.slot_start || null,
    slotEnd: visit.slot_end || null,
    status: toTitleCase(visit.status || 'Scheduled'),
    notes: visit.notes || '',
  };
};

const normalizeUnitStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'available') return 'Available';
  if (value === 'sold' || value === 'booked') return 'Sold';
  return toTitleCase(status || 'Unavailable');
};

const normalizeWorkspaceInventory = (workspace = {}) => (
  (workspace.tabs || []).map((tab, index) => {
    const units = tab.units || [];
    const availableUnits = units.filter((unit) => normalizeUnitStatus(unit.status) === 'Available').length;

    return {
      type: tab.configuration || `Configuration ${index + 1}`,
      size: tab.area_sqft ? `${tab.area_sqft} Sq.Ft` : 'Area pending',
      basePrice: tab.base_price ? `Rs. ${Number(tab.base_price).toLocaleString('en-IN')}` : 'Price on Request',
      totalUnits: units.length,
      availableUnits,
      unitsList: units.map((unit, unitIndex) => ({
        id: unit.id || `${tab.configuration}-${unit.unit_code || unitIndex}`,
        number: unit.unit_code || String(unitIndex + 1).padStart(3, '0'),
        floor: Math.ceil((unitIndex + 1) / 4),
        status: normalizeUnitStatus(unit.status),
        facing: unit.facing || '',
        price: tab.base_price ? `Rs. ${Number(tab.base_price).toLocaleString('en-IN')}` : 'Price on Request',
        configType: tab.configuration,
        size: tab.area_sqft ? `${tab.area_sqft} Sq.Ft` : '',
      })),
    };
  })
);

const formatUpdatedAt = (value) => {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const normalizeProject = (project = {}, workspace = {}, details = {}) => {
  const detail = details || {};
  const header = detail.header || {};
  const snapshot = detail.snapshot || {};
  const operations = detail.operations || {};
  const approvals = detail.approvals || {};
  const inventory = normalizeWorkspaceInventory(workspace);
  const totalUnits = Number(snapshot.total_units || inventory.reduce((sum, item) => sum + item.totalUnits, 0));
  const availableUnits = Number(snapshot.available_units || inventory.reduce((sum, item) => sum + item.availableUnits, 0));

  return {
    id: project.id,
    projectId: project.id,
    propertyId: project.property_id || project.propertyId || header.property_id || header.propertyId || null,
    name: header.name || project.name || workspace.project_name || 'Project',
    builder: header.builder || operations.builder || 'SquarFT Partner',
    location: header.location || project.location || workspace.location || 'Location pending',
    priceRange: header.price_range || project.price_range || 'Price on Request',
    configs: inventory.map((item) => item.type),
    status: normalizeClientStatus(header.status || project.status || 'Active'),
    units: totalUnits,
    available: availableUnits,
    progress: parseInt(String(header.progress || '0').replace(/\D/g, ''), 10) || 0,
    officer: operations.inventory_officer || 'Unassigned',
    specs: header.specifications || project.property_type || 'Property',
    docs: operations.documents_count || (detail.documents || []).length || 0,
    documents: (detail.documents || []).map((doc) => ({
      title: doc.title || 'Project Document',
      status: doc.status || 'AVAILABLE',
      updatedAt: formatUpdatedAt(doc.created_at),
    })),
    possession: approvals.possession ? formatUpdatedAt(approvals.possession) : 'Not available',
    rera: approvals.rera || 'Not available',
    updated: formatUpdatedAt(header.updated_at),
    matchPercentage: project.match_percentage,
    source: project.source,
    inventory,
  };
};

export const normalizeTodayVisit = (visit = {}) => ({
  id: visit.id,
  displayCode: visit.lead_code || visit.id,
  name: visit.customer_name || 'Client',
  phone: visit.customer_phone || '',
  latestNote: visit.note || 'Scheduled for site visit today.',
  time: visit.time,
});

export const fetchClientHubClients = async (params = {}) => {
  try {
    const response = await apiRequest(`${CLIENT_HUB_BASE}/clients/active${buildQueryString(params)}`, {
      method: 'GET',
    });
    const data = response?.data ?? [];

    return {
      items: (Array.isArray(data) ? data : []).map(normalizeClientSummary),
      pagination: response?.pagination,
      source: 'client-hub',
    };
  } catch {
    return fetchClientsFromLeads(params);
  }
};

export const fetchTodayVisits = async () => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/visits/today`, { method: 'GET' }));
  return (data || []).map(normalizeTodayVisit);
};

export const fetchAvailableOfficers = async (params = {}) => {
  const query = buildQueryString(params);
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/officers/available${query}`, { method: 'GET' }));
  return (data || []).map((officer) => ({
    id: officer.id,
    name: officer.name || 'Officer',
    phone: officer.phone || '',
  }));
};

export const registerClient = async (payload = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/register`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));

export const fetchClientOverview = async (clientId) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/overview`, { method: 'GET' }));

export const fetchClientAssignedProperties = async (clientId) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/assigned-properties`, { method: 'GET' }));
  // 'Dropped' (unassignProperty) is terminal — treat it as removed rather
  // than showing it as a still-pipelined property, so the project correctly
  // reappears in "Available Properties" for reassignment.
  const assignments = (data || [])
    .filter((item) => toTitleCase(item.status || item.assignment_status) !== 'Dropped')
    .map(normalizePipelineItem);
  const propertyMap = await fetchPropertyProjectMap();

  return assignments.map((assignment) => {
    if (assignment.propertyId || !assignment.projectId) return assignment;

    return {
      ...assignment,
      propertyId: propertyMap.get(assignment.projectId) || null,
    };
  });
};

export const fetchClientRequirements = async (clientId, client) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/requirements`, { method: 'GET' }));
  return (data || []).map((requirement) => normalizeRequirement(requirement, client));
};

export const fetchClientTimelineAndNotes = async (clientId) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/timeline-notes`, { method: 'GET' }));
  return normalizeTimelineAndNotes(data);
};

export const fetchClientSiteVisits = async (clientId, client) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/visits`, { method: 'GET' }));
  return (data || []).map((visit) => normalizeClientVisit(visit, client));
};

export const fetchProjectWorkspace = async (projectId) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/projects/${projectId}/workspace`, { method: 'GET' }));

export const fetchProjectDetails = async (projectId) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/projects/${projectId}/details`, { method: 'GET' }));

export const fetchRecommendedProjects = async (clientId) => {
  const recommendations = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/recommended-properties`, { method: 'GET' }));
  const propertyMap = await fetchPropertyProjectMap();

  const projects = await Promise.all((recommendations || []).map(async (project) => {
    const [workspaceResult, detailsResult] = await Promise.allSettled([
      fetchProjectWorkspace(project.id),
      fetchProjectDetails(project.id),
    ]);
    const propertyId = project.property_id
      || project.propertyId
      || propertyMap.get(project.id)
      || null;

    return normalizeProject(
      { ...project, property_id: propertyId },
      workspaceResult.status === 'fulfilled' ? workspaceResult.value : {},
      detailsResult.status === 'fulfilled' ? detailsResult.value : {}
    );
  }));

  return projects;
};

export const fetchClientProfileBundle = async (clientId, summary = {}) => {
  const [
    overviewResult,
    assignedResult,
    requirementsResult,
    timelineResult,
    visitsResult,
    projectsResult,
    meetingsResult,
  ] = await Promise.allSettled([
    fetchClientOverview(clientId),
    fetchClientAssignedProperties(clientId),
    fetchClientRequirements(clientId, summary),
    fetchClientTimelineAndNotes(clientId),
    fetchClientSiteVisits(clientId, summary),
    fetchRecommendedProjects(clientId),
    fetchClientMeetings(clientId),
  ]);

  const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : {};
  const timelineData = timelineResult.status === 'fulfilled' ? timelineResult.value : {};

  const assigned = assignedResult.status === 'fulfilled' ? assignedResult.value : [];
  let recommended = projectsResult.status === 'fulfilled' ? projectsResult.value : [];

  // Fetch missing assigned projects workspace & details
  const recommendedIds = new Set(recommended.map((p) => p.id));
  const missingProjectIds = Array.from(new Set(
    assigned
      .map((a) => a.projectId)
      .filter((id) => id && !recommendedIds.has(id))
  ));

  if (missingProjectIds.length > 0) {
    const propertyMap = await fetchPropertyProjectMap();
    const missingProjects = await Promise.all(
      missingProjectIds.map(async (projectId) => {
        try {
          const [workspaceResult, detailsResult] = await Promise.allSettled([
            fetchProjectWorkspace(projectId),
            fetchProjectDetails(projectId),
          ]);
          const propertyId = propertyMap.get(projectId) || null;
          return normalizeProject(
            { id: projectId, property_id: propertyId },
            workspaceResult.status === 'fulfilled' ? workspaceResult.value : {},
            detailsResult.status === 'fulfilled' ? detailsResult.value : {}
          );
        } catch (err) {
          console.error(`Failed to load missing assigned project ${projectId}:`, err);
          return null;
        }
      })
    );

    recommended = [...recommended, ...missingProjects.filter(Boolean)];
  }

  const client = {
    ...mergeClientProfile(summary, overview),
    propertyPipeline: assigned,
    customerRequirements: requirementsResult.status === 'fulfilled' ? requirementsResult.value : [],
    timeline: timelineData.timeline || [],
    notes: timelineData.notes || [],
    meetings: meetingsResult.status === 'fulfilled' ? meetingsResult.value : [],
    nextFollowUp: timelineData.nextFollowUp || summary.nextFollowUp || '',
    status: timelineData.status || summary.status || 'Active',
  };

  return {
    client,
    visits: visitsResult.status === 'fulfilled' ? visitsResult.value : [],
    projects: recommended,
    errors: {
      overview: overviewResult.status === 'rejected' ? overviewResult.reason : null,
      assignedProperties: assignedResult.status === 'rejected' ? assignedResult.reason : null,
      requirements: requirementsResult.status === 'rejected' ? requirementsResult.reason : null,
      timeline: timelineResult.status === 'rejected' ? timelineResult.reason : null,
      visits: visitsResult.status === 'rejected' ? visitsResult.reason : null,
      projects: projectsResult.status === 'rejected' ? projectsResult.reason : null,
      meetings: meetingsResult.status === 'rejected' ? meetingsResult.reason : null,
    },
  };
};

export const assignUnitsToClient = async (clientId, projectId, unitCodes = []) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/projects/${projectId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ unitCodes }),
  }));

export const assignPropertyToClient = async (clientId, payload = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/assign-property`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));

// Backend has no separate delete — an assignment is "removed" by moving it
// to the terminal 'Dropped' status via the existing generic status-update
// endpoint (updateAssignedPropertyStatus already accepted this status; the
// UI just never called it for this purpose).
export const unassignProperty = async (assignedPropertyId, notes) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/assigned-properties/${assignedPropertyId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'Dropped', notes }),
  }));

export const bookVisitForAssignedProperty = async (assignedPropertyId, payload = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/assigned-properties/${assignedPropertyId}/book-visit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));

export const initiateDealForAssignedProperty = async (assignedPropertyId, payload = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/assigned-properties/${assignedPropertyId}/initiate-deal`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));

export const addClientRequirement = async (clientId, requirement = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/requirements`, {
    method: 'POST',
    body: JSON.stringify(requirement),
  }));

export const saveClientNote = async (clientId, note = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/notes`, {
    method: 'POST',
    body: JSON.stringify(note),
  }));

export const updateClientProfile = async (clientId, profile = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profile),
  }));

export const updateClientRequirement = async (clientId, requirement = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/requirements`, {
    method: 'PUT',
    body: JSON.stringify(requirement),
  }));

export const scheduleClientVisit = async (clientId, visit = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/visits/schedule`, {
    method: 'POST',
    body: JSON.stringify(visit),
  }));

export const convertClientToDeal = async (clientId, deal = {}) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/convert-to-deal`, {
    method: 'POST',
    body: JSON.stringify(deal),
  }));

export const normalizeMeeting = (meeting = {}) => ({
  id: meeting.id,
  date: meeting.date || '',
  time: meeting.time || '',
  mode: meeting.mode || 'Office Meeting',
  location: meeting.location || '',
  status: meeting.status || 'Scheduled',
  agenda: meeting.agenda || '',
  remarks: meeting.remarks || '',
});

export const fetchClientMeetings = async (clientId) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/meetings`, { method: 'GET' }));
  return (data || []).map(normalizeMeeting);
};

export const addClientMeeting = async (clientId, meeting = {}) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/clients/${clientId}/meetings`, {
    method: 'POST',
    body: JSON.stringify(meeting),
  }));
  return normalizeMeeting(data);
};

export const updateClientMeeting = async (meetingId, meeting = {}) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/meetings/${meetingId}`, {
    method: 'PUT',
    body: JSON.stringify(meeting),
  }));
  return normalizeMeeting(data);
};

export const deleteClientMeeting = async (meetingId) =>
  unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/meetings/${meetingId}`, { method: 'DELETE' }));

export const fetchOfficerBookedSlots = async (officerId, date) => {
  const data = unwrapData(await apiRequest(`${CLIENT_HUB_BASE}/officers/booked-slots?officerId=${officerId}&date=${date}`, { method: 'GET' }));
  return data || [];
};
