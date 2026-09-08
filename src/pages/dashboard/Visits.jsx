import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    BellRing, Building2, Calendar, CalendarCheck, ChevronRight, Clock,
    Eye, KeyRound, LoaderCircle, PhoneCall, Plus, Save,
    Search, ShieldCheck, TrendingUp
} from 'lucide-react';
import { addDeal, setSelectedDeal } from '../../store/dealsSlice';
import { addVisit, addVisitNote, setVisits, setVisitsLoading, updateVisit, updateVisitStatus } from '../../store/visitsSlice';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import { useDialog } from '../../components/ui/Dialog';
import Header from '../../components/layout/Header';
import { fetchMasterOptions, fetchProperties, fetchSalesOfficers } from '../../services/commonService';
import { fetchDealById } from '../../services/dealManagementService';
import {
    canPersistVisitPayload,
    createVisit,
    createVisitNote,
    fetchVisits,
    saveVisit,
    saveVisitStatus,
    convertVisitToDeal,
} from '../../services/visitManagementService';

const fallbackPurposeOptions = ['BUY', 'RENT', 'SELL'];
const fallbackPropertyTypeOptions = ['APARTMENT/FLATS', 'VILLA PLOTS', 'COMMERCIAL', 'PLOT'];
const fallbackVisitStatusOptions = ['Scheduled', 'In Progress', 'Completed', 'Cancelled'];

const uniqueOptions = (...groups) => (
    [...new Set(groups.flat().filter(Boolean).map((option) => String(option).trim()).filter(Boolean))]
);

const optionLabels = (options = []) => options.map((option) => option.label || option.value);

const buildPropertyLookupLabel = (property) => (
    [property.title, property.projectName, property.city].filter(Boolean).join(' - ')
);

const visitFormInitialState = {
    officerId: '',
    officerName: '',
    officerPhone: '',
    customerId: '',
    customerName: '',
    customerPhone: '',
    propertyId: '',
    purpose: 'BUY',
    date: '',
    time: '',
    status: 'Scheduled',
    propertyName: '',
    propertyType: 'APARTMENT/FLATS',
    propertyConfig: '',
    propertyAddress: '',
    propertyPrice: '',
    notes: '',
};

const getStatusBadge = (status) => {
    if (status === 'Scheduled') return <Badge variant="purple">{status}</Badge>;
    if (status === 'Completed') return <Badge variant="green">{status}</Badge>;
    if (status === 'Cancelled') return <Badge variant="red">{status}</Badge>;
    if (status === 'In Progress') return <Badge variant="yellow">{status}</Badge>;
    return <Badge variant="gray">{status}</Badge>;
};

const isTodayVisit = (date = '') => {
    const normalized = String(date).trim().toLowerCase();
    if (normalized === 'today') return true;

    const today = new Date();
    const [day, month, year] = String(date).split(/[/-]/).map((part) => part.trim());
    if (!day || !month || !year) return false;

    const fullYear = year.length === 2 ? Number(`20${year}`) : Number(year);
    return Number(day) === today.getDate() && Number(month) === today.getMonth() + 1 && fullYear === today.getFullYear();
};

const parseVisitDateStr = (dateStr) => {
    if (!dateStr) return null;
    const normalized = String(dateStr).trim().toLowerCase();
    
    if (normalized === 'today') {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    
    if (normalized === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    }

    const parts = dateStr.split(/[/-]/).map(p => p.trim());
    if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) {
            year = `20${year}`;
        }
        return `${year}-${month}-${day}`;
    }

    try {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
        }
    } catch {
        // Ignore
    }

    return null;
};

// eslint-disable-next-line no-unused-vars
const getVisitSources = (visit) => visit.sources || visit.source || ['Mobile', 'App'];

// eslint-disable-next-line no-unused-vars
const getVisitPropertyCount = (visit) => visit.propertyCount || visit.properties?.length || (visit.property ? 1 : 0);

const normalizeText = (value = '') => String(value).trim().toLowerCase();

const getVisitProperties = (visit) => (
    Array.isArray(visit.properties) && visit.properties.length
        ? visit.properties
        : visit.property
            ? [visit.property]
            : []
);

const getVisitPhotos = (visit) => (
    visit?.propertyPhotos
    || (Array.isArray(visit?.uploadedPhotos) && visit.uploadedPhotos.length > 0 ? visit.uploadedPhotos : null)
    || (visit?.status === 'Completed'
        ? [
            { url: '/inventory-images/project-main.png', label: 'Uploaded site photo' },
            { url: '/inventory-images/project-main.png', label: 'Property view' },
        ]
        : [])
);

const parsePropertyPrice = (price) => {
    const rawPrice = String(price || '').replace(/,/g, '').trim();
    const numericValue = Number(rawPrice.match(/\d+(\.\d+)?/)?.[0] || 0);
    const lowerPrice = rawPrice.toLowerCase();

    if (!numericValue) return 0;
    if (lowerPrice.includes('cr')) return Math.round(numericValue * 10000000);
    if (lowerPrice.includes('lakh') || lowerPrice.includes('lac') || /\bl\b/.test(lowerPrice)) return Math.round(numericValue * 100000);
    return Math.round(numericValue);
};

const mapVisitToForm = (visit) => ({
    officerId: visit.officerId || '',
    officerName: visit.officerName || '',
    officerPhone: visit.officerPhone || '',
    customerId: visit.customerId || '',
    customerName: visit.customerName || '',
    customerPhone: visit.customerPhone || '',
    propertyId: visit.propertyId || visit.property?.id || '',
    purpose: visit.purpose || 'BUY',
    date: visit.date || '',
    time: visit.time || '',
    status: visit.status || 'Scheduled',
    propertyName: visit.property?.name || '',
    propertyType: visit.property?.type || 'APARTMENT/FLATS',
    propertyConfig: visit.property?.config || '',
    propertyAddress: visit.property?.address || '',
    propertyPrice: visit.property?.price || '',
    notes: visit.notes || '',
});

const buildVisitPayload = (formState) => ({
    officerId: formState.officerId,
    officerName: formState.officerName.trim(),
    officerPhone: formState.officerPhone.trim(),
    customerId: formState.customerId,
    customerName: formState.customerName.trim(),
    customerPhone: formState.customerPhone.trim(),
    propertyId: formState.propertyId,
    purpose: formState.purpose,
    date: formState.date,
    time: formState.time,
    status: formState.status,
    property: {
        name: formState.propertyName.trim(),
        type: formState.propertyType,
        config: formState.propertyConfig.trim(),
        address: formState.propertyAddress.trim(),
        price: formState.propertyPrice.trim(),
    },
    notes: formState.notes.trim(),
});

const Visits = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { alert } = useDialog();
    const { visits, loading: visitsLoading } = useSelector((state) => state.visits);
    const { deals } = useSelector((state) => state.deals);
    const [selectedClientKey, setSelectedClientKey] = useState(null);
    const [selectedVisitRowId, setSelectedVisitRowId] = useState(null);
    const [filter, setFilter] = useState('All');
    const [dateFilterType, setDateFilterType] = useState('all');
    const [customDate, setCustomDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [newNote, setNewNote] = useState('');
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [editingVisitId, setEditingVisitId] = useState(null);
    const [visitForm, setVisitForm] = useState(visitFormInitialState);
    const [purposeOptions, setPurposeOptions] = useState(fallbackPurposeOptions);
    const [propertyTypeOptions, setPropertyTypeOptions] = useState(fallbackPropertyTypeOptions);
    const [visitStatusOptions, setVisitStatusOptions] = useState(fallbackVisitStatusOptions);
    const [salesOfficerOptions, setSalesOfficerOptions] = useState([]);
    const [propertyLookupOptions, setPropertyLookupOptions] = useState([]);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
    const [convertExpectPrice, setConvertExpectPrice] = useState('');
    const [convertNegotiationPrice, setConvertNegotiationPrice] = useState('');
    const [convertSalesOfficerId, setConvertSalesOfficerId] = useState('');
    const [convertBookingDate, setConvertBookingDate] = useState('');

    useEffect(() => {
        let isMounted = true;

        const loadVisits = async () => {
            dispatch(setVisitsLoading(true));
            try {
                const result = await fetchVisits({ page: 1, pageSize: 100 });
                if (isMounted) {
                    dispatch(setVisits(result.items));
                }
            } catch (error) {
                console.error('Failed to load visit management data:', error);
                if (isMounted) dispatch(setVisitsLoading(false));
            }
        };

        loadVisits();

        return () => {
            isMounted = false;
        };
    }, [dispatch]);

    useEffect(() => {
        let isMounted = true;

        const loadCommonOptions = async () => {
            const [masterResult, officerResult, propertyResult] = await Promise.allSettled([
                fetchMasterOptions([
                    'requirement_types',
                    'property_categories',
                    'residential_property_types',
                    'commercial_property_types',
                    'visit_statuses',
                ]),
                fetchSalesOfficers({ status: 'ACTIVE', availableOnly: true, limit: 50 }),
                fetchProperties({ source: 'all', includeUnits: true, limit: 50 }),
            ]);

            if (!isMounted) return;

            if (masterResult.status === 'fulfilled') {
                setPurposeOptions(uniqueOptions(optionLabels(masterResult.value?.requirementTypes), fallbackPurposeOptions));
                setPropertyTypeOptions(uniqueOptions(
                    optionLabels(masterResult.value?.propertyCategories),
                    optionLabels(masterResult.value?.residentialPropertyTypes),
                    optionLabels(masterResult.value?.commercialPropertyTypes),
                    fallbackPropertyTypeOptions,
                ));
                setVisitStatusOptions(uniqueOptions(optionLabels(masterResult.value?.visitStatuses), fallbackVisitStatusOptions));
            }

            if (officerResult.status === 'fulfilled') {
                setSalesOfficerOptions(officerResult.value?.salesOfficers || []);
            }

            if (propertyResult.status === 'fulfilled') {
                setPropertyLookupOptions([
                    ...(propertyResult.value?.properties || []),
                    ...(propertyResult.value?.units || []),
                ]);
            }
        };

        loadCommonOptions();

        return () => {
            isMounted = false;
        };
    }, []);

    const filteredVisits = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return visits.filter((visit) => {
            const visitProperties = getVisitProperties(visit);
            const matchesStatus = filter === 'All' || visit.status === filter;
            
            let matchesDate = true;
            if (dateFilterType !== 'all') {
                const visitIsoDate = parseVisitDateStr(visit.date);
                if (!visitIsoDate) {
                    matchesDate = false;
                } else {
                    const today = new Date();
                    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                    
                    if (dateFilterType === 'today') {
                        matchesDate = visitIsoDate === todayIso;
                    } else if (dateFilterType === 'thisWeek') {
                        const visitTime = new Date(visitIsoDate).getTime();
                        const startOfToday = new Date(todayIso).getTime();
                        const sevenDaysLater = startOfToday + 7 * 24 * 60 * 60 * 1000;
                        matchesDate = visitTime >= startOfToday && visitTime <= sevenDaysLater;
                    } else if (dateFilterType === 'custom') {
                        matchesDate = customDate ? visitIsoDate === customDate : true;
                    }
                }
            }

            const matchesQuery = !query || [
                visit.customerName,
                visit.customerPhone,
                visit.officerName,
                visit.property?.name,
                visit.property?.address,
                ...visitProperties.flatMap((property) => [property.name, property.config, property.address, property.type]),
                visit.purpose,
            ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
            return matchesStatus && matchesDate && matchesQuery;
        });
    }, [filter, dateFilterType, customDate, searchQuery, visits]);

    const clientCards = useMemo(() => {
        const grouped = filteredVisits.reduce((acc, visit) => {
            const key = `${normalizeText(visit.customerName)}-${normalizeText(visit.customerPhone)}`;
            if (!acc[key]) {
                acc[key] = {
                    key,
                    name: visit.customerName,
                    phone: visit.customerPhone,
                    visits: [],
                    propertyRows: [],
                };
            }

            const properties = getVisitProperties(visit);
            acc[key].visits.push(visit);
            properties.forEach((property, index) => {
                acc[key].propertyRows.push({
                    id: `${visit.id}-${index}`,
                    visit,
                    property,
                });
            });

            return acc;
        }, {});

        return Object.values(grouped).map((client) => ({
            ...client,
            activeVisits: client.visits.filter((visit) => !['Completed', 'Cancelled'].includes(visit.status)),
            visited: client.visits.filter((visit) => visit.status === 'Completed'),
        }));
    }, [filteredVisits]);

    const selectedClient = clientCards.find((client) => client.key === selectedClientKey) || clientCards[0] || null;
    const selectedPropertyRows = selectedClient?.propertyRows || [];
    const selectedPropertyRow = selectedPropertyRows.find((row) => row.id === selectedVisitRowId) || selectedPropertyRows[0] || null;
    const selectedVisit = selectedPropertyRow?.visit || null;
    const selectedProperty = selectedPropertyRow?.property || selectedVisit?.property || null;
    const convertedDeal = selectedVisit
        ? (deals.find((deal) => deal.visitId === selectedVisit.id || (selectedVisit.dealId && deal.id === selectedVisit.dealId))
           || (selectedVisit.isConvertedToDeal ? { id: selectedVisit.dealId, dealCode: selectedVisit.dealId ? `D-${selectedVisit.dealId.substring(0, 8).toUpperCase()}` : 'Deal' } : null))
        : null;

    const handleClientSelect = (clientKey) => {
        const nextClient = clientCards.find((client) => client.key === clientKey);
        setSelectedClientKey(clientKey);
        setSelectedVisitRowId(nextClient?.propertyRows?.[0]?.id || null);
    };

    const openVisitReminderCall = (visit, property = null) => {
        if (!visit?.customerPhone) return;

        navigate('/dashboard/support/voice-agent', {
            state: {
                returnTo: '/dashboard/visits',
                voiceContext: {
                    source: 'visit_reminder',
                    visitId: visit.id,
                    customerName: visit.customerName,
                    customerPhone: visit.customerPhone,
                    visitDate: visit.date,
                    visitTime: visit.time,
                    purpose: visit.purpose || 'site visit',
                    propertyName: property?.name || visit.property?.name || 'Property visit',
                    propertyAddress: property?.address || visit.property?.address || '',
                    propertyConfig: property?.config || visit.property?.config || property?.type || visit.property?.type || '',
                    officerName: visit.officerName,
                    officerPhone: visit.officerPhone,
                },
            },
        });
    };

    const visitMetrics = useMemo(() => ([
        {
            title: 'Total Visits',
            value: visits.length,
            icon: Calendar,
            accent: 'text-gray-900',
            iconClass: 'text-[#6F4BFF]',
            pill: '+12%',
            pillClass: 'bg-[#6F4BFF]/10 text-[#6F4BFF]',
        },
        {
            title: "Today's Visits",
            value: visits.filter((visit) => isTodayVisit(visit.date)).length,
            icon: CalendarCheck,
            accent: 'text-[#3024E8]',
            iconClass: 'text-[#3024E8]',
            active: true,
        },
        {
            title: 'OTP Pending',
            value: visits.filter((visit) => visit.otpStatus === 'Pending' || visit.status === 'OTP Pending').length,
            icon: KeyRound,
            accent: 'text-red-600',
            iconClass: 'text-red-500',
            pill: 'Priority',
            pillClass: 'bg-rose-50 text-red-600',
        },
        {
            title: 'OTP Verified',
            value: visits.filter((visit) => visit.otpStatus === 'Verified' || visit.status === 'OTP Verified' || visit.status === 'Completed').length,
            icon: ShieldCheck,
            accent: 'text-emerald-600',
            iconClass: 'text-emerald-600',
        },
        {
            title: 'In Progress',
            value: visits.filter((visit) => visit.status === 'In Progress').length,
            icon: LoaderCircle,
            accent: 'text-slate-700',
            iconClass: 'text-indigo-500',
        },
    ]), [visits]);

    const openCreateModal = () => {
        setEditingVisitId(null);
        setVisitForm(visitFormInitialState);
        setIsVisitModalOpen(true);
    };

    // eslint-disable-next-line no-unused-vars
    const openEditModal = (visit) => {
        setEditingVisitId(visit.id);
        setVisitForm(mapVisitToForm(visit));
        setIsVisitModalOpen(true);
    };

    const closeVisitModal = () => {
        setIsVisitModalOpen(false);
        setEditingVisitId(null);
        setVisitForm(visitFormInitialState);
    };

    const updateVisitForm = (field, value) => {
        setVisitForm((current) => {
            if (field === 'officerName') {
                const officer = salesOfficerOptions.find((item) => item.name === value);
                return {
                    ...current,
                    officerId: officer?.id || current.officerId,
                    officerName: value,
                    officerPhone: officer?.phone || current.officerPhone,
                };
            }

            if (field === 'propertyName') {
                const property = propertyLookupOptions.find((item) => (
                    item.title === value
                    || item.name === value
                    || buildPropertyLookupLabel(item) === value
                ));

                if (!property) return { ...current, propertyName: value };

                return {
                    ...current,
                    propertyId: property.propertyId || property.id || current.propertyId,
                    propertyName: property.title || property.name || value,
                    propertyType: property.type || property.subType || current.propertyType,
                    propertyConfig: property.unitCode || property.title || property.subType || current.propertyConfig,
                    propertyAddress: [property.area, property.city, property.pincode].filter(Boolean).join(', ') || current.propertyAddress,
                    propertyPrice: property.price ? String(property.price) : current.propertyPrice,
                };
            }

            return { ...current, [field]: value };
        });
    };

    const handleSubmitVisit = async (event) => {
        event.preventDefault();
        // TODO(QA-P0): see the OTP-gate note near the "Status" SelectField in the Edit Visit modal below —
        // this handler persists any status (including "Completed") via saveVisit()/saveVisitStatus() with
        // no OTP check. sendVisitOtp/verifyVisitOtp exist in visitManagementService.js but are unused.
        let payload = buildVisitPayload(visitForm);

        if (editingVisitId) {
            if (canPersistVisitPayload(payload)) {
                try {
                    payload = await saveVisit(editingVisitId, payload);
                } catch (error) {
                    console.error('Failed to update visit:', error);
                    return;
                }
            }
            dispatch(updateVisit({ id: editingVisitId, changes: payload }));
            setSelectedVisitRowId((current) => current || `${editingVisitId}-0`);
        } else {
            if (canPersistVisitPayload(payload)) {
                try {
                    payload = await createVisit(payload);
                } catch (error) {
                    console.error('Failed to create visit:', error);
                    return;
                }
            }
            dispatch(addVisit(payload));
        }
        closeVisitModal();
    };

    // eslint-disable-next-line no-unused-vars
    const handleUpdateStatus = async (id, status) => {
        if (id && !String(id).startsWith('V')) {
            try {
                await saveVisitStatus(id, status);
            } catch (error) {
                console.error('Failed to update visit status:', error);
                return;
            }
        }

        dispatch(updateVisitStatus({ id, status }));
        setSelectedVisitRowId((current) => current || `${id}-0`);
    };

    // eslint-disable-next-line no-unused-vars
    const handleAddNote = async () => {
        if (!selectedVisit || !newNote.trim()) return;

        if (selectedVisit.id && !String(selectedVisit.id).startsWith('V')) {
            try {
                await createVisitNote(selectedVisit.id, newNote.trim());
            } catch (error) {
                console.error('Failed to add visit note:', error);
                return;
            }
        }

        dispatch(addVisitNote({ id: selectedVisit.id, note: newNote.trim() }));
        setNewNote('');
    };

    const handleOpenConvertModal = () => {
        if (!selectedVisit || !selectedProperty || convertedDeal) return;

        // Parse property price for expected/negotiation price defaults
        const expectedPrice = parsePropertyPrice(selectedProperty?.price);
        const negotiatedPrice = expectedPrice ? Math.round(expectedPrice * 0.97) : 0;

        setConvertExpectPrice(expectedPrice || '');
        setConvertNegotiationPrice(negotiatedPrice || '');
        setConvertSalesOfficerId(selectedVisit.officerId || '');
        setConvertBookingDate(new Date().toISOString().slice(0, 10));
        setIsConvertModalOpen(true);
    };

    const handleConvertSubmit = async (event) => {
        event.preventDefault();
        if (!selectedVisit) return;

        try {
            const payload = {
                expectPrice: Number(convertExpectPrice || 0),
                negotiationPrice: Number(convertNegotiationPrice || 0),
                salesOfficerId: convertSalesOfficerId || undefined,
                bookingDate: convertBookingDate || undefined,
            };

            const dealResult = await convertVisitToDeal(selectedVisit.id, payload);
            if (dealResult) {
                // Fetch the fully hydrated deal details so Deal Management lists it correctly
                const fullDeal = await fetchDealById(dealResult.id);

                // Update the visit in local state and Redux
                dispatch(updateVisit({
                    id: selectedVisit.id,
                    changes: {
                        isConvertedToDeal: true,
                        dealId: dealResult.id,
                    }
                }));

                // Add to deals slice and set as selected for direct view
                dispatch(addDeal(fullDeal));
                dispatch(setSelectedDeal(fullDeal));

                setIsConvertModalOpen(false);
                navigate('/dashboard/deals');
            }
        } catch (error) {
            console.error('Failed to convert visit to deal:', error);
            alert(error.message || 'Failed to convert visit to deal', { title: 'Conversion Failed', variant: 'danger' });
        }
    };

    const handleViewExistingDeal = async () => {
        if (!convertedDeal?.id) return;

        try {
            const fullDeal = await fetchDealById(convertedDeal.id);
            dispatch(addDeal(fullDeal));
            dispatch(setSelectedDeal(fullDeal));
            navigate('/dashboard/deals');
        } catch (error) {
            console.error('Failed to open existing deal:', error);
            dispatch(setSelectedDeal(convertedDeal));
            navigate('/dashboard/deals');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="Upcoming Visits" />

            <main className="flex-1 overflow-y-auto p-3 md:p-5 scroll-smooth">
                <div className="max-w-[1600px] mx-auto space-y-4 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                        {visitMetrics.map((metric) => (
                            <div key={metric.title} className={`relative overflow-hidden rounded-lg border bg-white p-3 min-h-[94px] shadow-sm transition-all ${metric.active ? 'border-[#3024E8] shadow-[#3024E8]/10' : 'border-violet-100'}`}>
                                {metric.active && <div className="absolute left-0 top-0 h-full w-1.5 bg-[#3024E8]" />}
                                <div className="flex h-full flex-col justify-between">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-[11px] font-semibold uppercase text-slate-800">
                                            {metric.title}
                                        </p>
                                        <metric.icon className={`mt-0.5 h-4 w-4 shrink-0 ${metric.iconClass}`} />
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <p className={`text-xl font-black tracking-tight ${metric.accent}`}>
                                            {String(metric.value).padStart(metric.title === 'In Progress' && metric.value < 10 ? 2 : 1, '0')}
                                        </p>
                                        {metric.pill && (
                                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${metric.pillClass}`}>
                                                {metric.pill}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <Card noPadding className="overflow-hidden border-gray-200 shadow-sm">
                        <div className="space-y-3 border-b border-gray-100 bg-white p-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <h2 className="flex items-center gap-2 text-lg font-black text-gray-950">
                                        <Building2 className="h-4 w-4 text-[#3024E8]" /> Property visits
                                    </h2>
                                    <p className="mt-0.5 text-xs font-semibold text-gray-500">Select a client, review their properties to visit, then inspect visit result.</p>
                                </div>
                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                                    <button
                                        type="button"
                                        disabled={!selectedVisit?.customerPhone}
                                        onClick={() => openVisitReminderCall(selectedVisit, selectedProperty)}
                                        className="flex min-h-8 items-center justify-center gap-2 rounded-lg bg-[#0C6B39] px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-[#094d29] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <BellRing className="h-3.5 w-3.5" />
                                        Reminder Call
                                    </button>
                                    <Button icon={Plus} className="w-full justify-center px-2.5 py-1.5 text-xs sm:w-auto" onClick={openCreateModal}>New Visit</Button>
                                </div>
                            </div>
                            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] items-center">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        value={searchQuery}
                                        onChange={(event) => setSearchQuery(event.target.value)}
                                        className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30"
                                        placeholder="Search client, property, officer, location..."
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:inline">Date:</span>
                                    <select
                                        value={dateFilterType}
                                        onChange={(e) => setDateFilterType(e.target.value)}
                                        className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 text-gray-700"
                                    >
                                        <option value="all">All Dates</option>
                                        <option value="today">Today</option>
                                        <option value="thisWeek">Next 7 Days</option>
                                        <option value="custom">Custom Date...</option>
                                    </select>
                                    {dateFilterType === 'custom' && (
                                        <input
                                            type="date"
                                            value={customDate}
                                            onChange={(e) => setCustomDate(e.target.value)}
                                            className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 text-gray-700"
                                        />
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'].map((item) => (
                                        <button key={item} onClick={() => setFilter(item)} className={`min-h-8 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition-all ${filter === item ? 'bg-[#3024E8] text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {visitsLoading ? (
                            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 p-6 text-center">
                                <LoaderCircle className="h-8 w-8 animate-spin text-[#3024E8]" />
                                <div>
                                    <p className="text-sm font-black text-gray-900">Loading visits</p>
                                    <p className="mt-1 text-xs font-semibold text-gray-500">Fetching the latest booking data.</p>
                                </div>
                            </div>
                        ) : (
                        <div className="grid gap-3 p-3 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-black uppercase text-gray-500">Clients</h3>
                                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">{clientCards.length}</span>
                                </div>
                                {clientCards.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs font-semibold text-gray-500">No matching clients found.</div>
                                ) : clientCards.map((client) => {
                                    const isSelected = selectedClient?.key === client.key;
                                    return (
                                        <button
                                            key={client.key}
                                            type="button"
                                            onClick={() => handleClientSelect(client.key)}
                                            className={`w-full rounded-lg border p-3 text-left transition-all ${isSelected ? 'border-[#3024E8] bg-[#F7F5FF] shadow-sm ring-1 ring-[#3024E8]/15' : 'border-gray-200 bg-white hover:border-[#3024E8]/40 hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black leading-tight text-gray-950 break-words">{client.name}</p>
                                                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-gray-500">
                                                        <PhoneCall className="h-3 w-3 text-gray-400 shrink-0" />
                                                        <span className="break-words">{client.phone}</span>
                                                    </p>
                                                </div>
                                                <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${isSelected ? 'text-[#3024E8]' : 'text-gray-400'}`} />
                                            </div>
                                            <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                                                <MiniCount label="Visits" value={client.visits.length} isSelected={isSelected} />
                                                <MiniCount label="Active" value={client.activeVisits.length} isSelected={isSelected} />
                                                <MiniCount label="Visited" value={client.visited.length} isSelected={isSelected} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="min-w-0 space-y-3">
                                {selectedClient ? (
                                    <>
                                        <div className="rounded-lg border border-[#3024E8]/20 bg-[#F7F5FF]/40 p-4 shadow-sm">
                                            <div className="space-y-3">
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-[#3024E8]">Selected client</p>
                                                    <h3 className="mt-0.5 text-base font-black tracking-tight text-slate-900 break-words">{selectedClient.name}</h3>
                                                    <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                                        <PhoneCall className="h-3.5 w-3.5 text-[#3024E8]/70 shrink-0" />
                                                        <span className="break-words">{selectedClient.phone}</span>
                                                    </p>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <MiniCount label="Visits" value={selectedClient.visits.length} isSelected={true} />
                                                    <MiniCount label="Active" value={selectedClient.activeVisits.length} isSelected={true} />
                                                    <MiniCount label="Visited" value={selectedClient.visited.length} isSelected={true} />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="text-xs font-black uppercase text-gray-500">Properties they are about to visit</h3>
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-black text-gray-600">{selectedPropertyRows.length} items</span>
                                            </div>
                                            {selectedPropertyRows.length === 0 ? (
                                                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs font-semibold text-gray-500">No property visits for this client.</div>
                                            ) : selectedPropertyRows.map(({ visit, property, id }) => {
                                                const isSelected = selectedPropertyRow?.id === id;
                                                return (
                                                    <button
                                                        key={id}
                                                        type="button"
                                                        onClick={() => setSelectedVisitRowId(id)}
                                                        className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition-all ${isSelected ? 'border-[#3024E8] ring-1 ring-[#3024E8]/15' : 'border-gray-200 hover:border-[#3024E8]/40'}`}
                                                    >
                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-black text-gray-950 break-words">{property.name}</p>
                                                                <p className="mt-1 text-xs font-semibold text-gray-500 break-words">{property.config || property.type}</p>
                                                            </div>
                                                            {getStatusBadge(visit.status)}
                                                        </div>
                                                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                                            <DetailChip label="Slot" value={`${visit.date} - ${visit.time}`} />
                                                            <DetailChip label="Officer" value={visit.officerName || 'Unassigned'} />
                                                            <DetailChip label="Price" value={property.price || 'Price on request'} />
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs font-semibold text-gray-500">Select a client to see property visits.</div>
                                )}
                            </div>

                            <div className="min-w-0">
                                {!selectedVisit ? (
                                    <Card className="flex min-h-[260px] flex-col items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 text-center">
                                        <Calendar className="mb-2 h-9 w-9 text-gray-300" />
                                        <h3 className="text-sm font-black text-gray-700">No visit selected</h3>
                                        <p className="mt-1 max-w-sm text-xs font-semibold text-gray-500">Select a property visit to see the result.</p>
                                    </Card>
                                ) : (
                                    <Card noPadding className="overflow-hidden border-gray-200 shadow-sm">
                                        <div className="border-b border-gray-100 bg-white p-3">
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <h2 className="text-lg font-black text-gray-950 break-words">{selectedProperty?.name || 'Property visit'}</h2>
                                                        {getStatusBadge(selectedVisit.status)}
                                                    </div>
                                                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                                                        <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-gray-400" /> {selectedVisit.date}</span>
                                                        <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-gray-400" /> {selectedVisit.time}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 bg-gray-50/50 p-3">
                                            <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                                <div className="grid gap-2 text-xs font-bold text-gray-700">
                                                    <DetailBlock label="Client" value={selectedVisit.customerName} />
                                                    <DetailBlock label="Visitors" value={String(selectedVisit.visitorsCount || 1)} />
                                                    <DetailBlock label="Branch" value={selectedVisit.branchName || 'Unassigned'} />
                                                    <DetailBlock label="Configuration" value={selectedProperty?.config || selectedProperty?.type} />
                                                    <DetailBlock label="Address" value={selectedProperty?.address} wide />
                                                </div>
                                            </div>

                                            {selectedVisit.status !== 'Completed' ? (
                                                <div className="rounded-lg border border-dashed border-gray-200 bg-white p-5 text-center">
                                                    <Clock className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                                    <p className="text-sm font-black text-gray-900">Not visited yet</p>
                                                    <p className="mt-1 text-xs font-semibold text-gray-500">Review and uploaded photos will appear after the visit is completed.</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Officer Feedback */}
                                                    {(selectedVisit.officerNote || selectedVisit.leadTemperature) && (
                                                        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <h3 className="text-sm font-black text-gray-800">Officer feedback</h3>
                                                                {selectedVisit.leadTemperature && (
                                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                                                        selectedVisit.leadTemperature.toLowerCase() === 'hot' || selectedVisit.leadTemperature.toLowerCase() === 'interested'
                                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                            : selectedVisit.leadTemperature.toLowerCase() === 'warm' || selectedVisit.leadTemperature.toLowerCase() === 'maybe'
                                                                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                                                : 'bg-slate-50 text-slate-700 border border-slate-200'
                                                                    }`}>
                                                                        {selectedVisit.leadTemperature.toLowerCase() === 'hot' ? 'Interested (Hot)' :
                                                                         selectedVisit.leadTemperature.toLowerCase() === 'warm' ? 'Maybe (Warm)' :
                                                                         selectedVisit.leadTemperature.toLowerCase() === 'cold' ? 'Not Interested (Cold)' :
                                                                         selectedVisit.leadTemperature}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs font-semibold leading-5 text-gray-700">
                                                                {selectedVisit.officerNote || 'No detailed note provided by the officer.'}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {/* Client Review */}
                                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                                        <h3 className="mb-2 text-sm font-black text-gray-800">Client review</h3>
                                                        {selectedVisit.userRating && (
                                                            <div className="mb-2 flex gap-0.5">
                                                                {[0, 1, 2, 3, 4].map((index) => (
                                                                    <span key={index} className={`text-sm ${index < selectedVisit.userRating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-xs font-semibold leading-5 text-gray-700">{selectedVisit.userReview || selectedVisit.notes || 'Visit completed. Review not added yet.'}</p>
                                                    </div>

                                                    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                                        <h3 className="mb-3 text-sm font-black text-gray-800">Uploaded property photos</h3>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {getVisitPhotos(selectedVisit).map((image, index) => (
                                                                <div key={`${image.url}-${index}`} className="overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                                                                    <img src={image.url} alt={image.label} className="h-24 w-full object-cover" />
                                                                    <p className="truncate px-2 py-1 text-[10px] font-bold text-gray-500">{image.label}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="primary"
                                                        icon={convertedDeal ? Eye : TrendingUp}
                                                        onClick={convertedDeal ? handleViewExistingDeal : handleOpenConvertModal}
                                                        className="w-full justify-center px-2.5 py-2 text-xs shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
                                                    >
                                                        {convertedDeal ? `View Deal (${convertedDeal.dealCode})` : 'Convert to Deal'}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                )}
                            </div>
                        </div>
                        )}
                    </Card>
                </div>
            </main>

            <Modal isOpen={isVisitModalOpen} onClose={closeVisitModal} title={editingVisitId ? 'Edit Visit' : 'Schedule New Visit'}>
                <form onSubmit={handleSubmitVisit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Customer Name" value={visitForm.customerName} onChange={(value) => updateVisitForm('customerName', value)} required />
                        <Field label="Customer Phone" value={visitForm.customerPhone} onChange={(value) => updateVisitForm('customerPhone', value)} required />
                        <Field label="Officer Name" value={visitForm.officerName} onChange={(value) => updateVisitForm('officerName', value)} listId="visit-officer-options" required />
                        <Field label="Officer Phone" value={visitForm.officerPhone} onChange={(value) => updateVisitForm('officerPhone', value)} required />
                        <datalist id="visit-officer-options">
                            {salesOfficerOptions.map((officer) => (
                                <option key={officer.id} value={officer.name}>
                                    {officer.phone || officer.branchName || 'Sales officer'}
                                </option>
                            ))}
                        </datalist>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <SelectField label="Purpose" value={visitForm.purpose} onChange={(value) => updateVisitForm('purpose', value)} options={purposeOptions} />
                        <Field label="Date" type="text" value={visitForm.date} onChange={(value) => updateVisitForm('date', value)} placeholder="05/04/26" required />
                        <Field label="Time" value={visitForm.time} onChange={(value) => updateVisitForm('time', value)} placeholder="10:00 - 11:00 AM" required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Property Name" value={visitForm.propertyName} onChange={(value) => updateVisitForm('propertyName', value)} listId="visit-property-options" required />
                        <datalist id="visit-property-options">
                            {propertyLookupOptions.map((property) => (
                                <option key={`${property.source || 'property'}-${property.id}`} value={property.title || property.name}>
                                    {buildPropertyLookupLabel(property)}
                                </option>
                            ))}
                        </datalist>
                        <SelectField label="Property Type" value={visitForm.propertyType} onChange={(value) => updateVisitForm('propertyType', value)} options={propertyTypeOptions} />
                        <Field label="Configuration" value={visitForm.propertyConfig} onChange={(value) => updateVisitForm('propertyConfig', value)} placeholder="3BHK Premium" />
                        <Field label="Price" value={visitForm.propertyPrice} onChange={(value) => updateVisitForm('propertyPrice', value)} placeholder="1.85 Cr" />
                    </div>
                    <Field label="Property Address" value={visitForm.propertyAddress} onChange={(value) => updateVisitForm('propertyAddress', value)} />
                    {/*
                        TODO(QA-P0): No OTP verification gate before a visit can be set to "Completed" here.
                        This dropdown lets an admin freely select "Completed" and submit — saveVisit()/handleSubmitVisit
                        below persists it immediately with zero OTP check, even though the backend already exposes
                        OTP endpoints for this exact purpose:
                          - sendVisitOtp(visitId)   in ../../services/visitManagementService.js (line ~232)
                          - verifyVisitOtp(visitId, otp) in ../../services/visitManagementService.js (line ~235)
                        Both are currently unused dead code — never imported/called anywhere in this app.
                        Needs a product/UX decision before wiring: e.g. (a) when status is changed to "Completed",
                        block submit and show an OTP-entry step that calls sendVisitOtp() then verifyVisitOtp()
                        before allowing saveVisit()/saveVisitStatus() to persist "completed"; or (b) if admin
                        completion is meant to be an authorized override of the officer/customer OTP flow that
                        happens elsewhere, delete the dead exports and document that explicitly. Do not wire this
                        up without confirming which of those is intended — see QA_AUDIT_FINDINGS.md BUG-008.
                    */}
                    <SelectField label="Status" value={visitForm.status} onChange={(value) => updateVisitForm('status', value)} options={visitStatusOptions} />
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
                        <textarea rows="3" value={visitForm.notes} onChange={(event) => updateVisitForm('notes', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 text-sm font-medium" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <Button variant="secondary" onClick={closeVisitModal}>Cancel</Button>
                        <Button type="submit" icon={Save}>{editingVisitId ? 'Save Changes' : 'Schedule Visit'}</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="Convert Visit to Deal">
                <form onSubmit={handleConvertSubmit} className="space-y-4">
                    <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                        <div className="grid gap-2 text-xs font-bold text-gray-700">
                            <DetailBlock label="Client" value={selectedVisit?.customerName} />
                            <DetailBlock label="Property" value={selectedProperty?.name} />
                            <DetailBlock label="Original Officer" value={selectedVisit?.officerName} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field
                            label="Expected Price (Total Value)"
                            type="number"
                            value={convertExpectPrice}
                            onChange={(value) => {
                                setConvertExpectPrice(value);
                                if (!convertNegotiationPrice || convertNegotiationPrice === convertExpectPrice) {
                                    setConvertNegotiationPrice(value);
                                }
                            }}
                            placeholder="e.g. 5000000"
                        />
                        <Field
                            label="Negotiation Price (Deal Value)"
                            type="number"
                            value={convertNegotiationPrice}
                            onChange={(value) => setConvertNegotiationPrice(value)}
                            placeholder="e.g. 4800000"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assigned Sales Officer</label>
                            <select
                                value={convertSalesOfficerId}
                                onChange={(event) => setConvertSalesOfficerId(event.target.value)}
                                className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white"
                                required
                            >
                                <option value="">Select Officer...</option>
                                {salesOfficerOptions.map((officer) => (
                                    <option key={officer.id} value={officer.id}>
                                        {officer.name} ({officer.phone || 'Sales officer'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Field
                            label="Booking Date"
                            type="date"
                            value={convertBookingDate}
                            onChange={(value) => setConvertBookingDate(value)}
                            required
                        />
                    </div>

                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <Button variant="secondary" onClick={() => setIsConvertModalOpen(false)}>Cancel</Button>
                        <Button type="submit" icon={TrendingUp}>Convert to Deal</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

const Field = ({ label, value, onChange, type = 'text', placeholder = '', required = false, listId }) => (
    <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <input
            type={type}
            required={required}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            list={listId}
            className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options }) => (
    <div>
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
            {options.map((option) => <option key={option}>{option}</option>)}
        </select>
    </div>
);

const MiniCount = ({ label, value, isSelected }) => (
    <div className={`rounded-md border px-2 py-1.5 transition-all text-center ${
        isSelected 
            ? 'border-[#3024E8]/20 bg-white shadow-sm shadow-[#3024E8]/5' 
            : 'border-gray-100 bg-gray-50'
    }`}>
        <p className={`text-sm font-black leading-none ${isSelected ? 'text-[#3024E8]' : 'text-slate-900'}`}>{value ?? 0}</p>
        <p className={`mt-1 text-[9px] font-black uppercase tracking-wider ${isSelected ? 'text-[#3024E8]/70' : 'text-gray-400'}`}>{label}</p>
    </div>
);

const DetailChip = ({ label, value }) => (
    <div className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
        <p className="text-[9px] font-black uppercase text-gray-400">{label}</p>
        <p className="mt-0.5 text-[11px] font-black text-gray-800 break-words">{value || '-'}</p>
    </div>
);

const DetailBlock = ({ label, value, wide = false }) => (
    <div className={wide ? 'sm:col-span-2' : ''}>
        <span className="block text-[9px] font-black uppercase text-gray-400">{label}</span>
        <p className="mt-0.5 break-words text-xs font-bold text-gray-700">{value || '-'}</p>
    </div>
);

// eslint-disable-next-line no-unused-vars
const InfoCard = ({ title, name, phone, icon: Icon, color }) => {
    const colorClass = color === 'blue' ? 'bg-blue-100 border-blue-200 text-blue-600' : 'bg-purple-100 border-purple-200 text-purple-600';

    return (
        <div className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm relative overflow-hidden group">
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center border ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">{title}</p>
                        <h4 className="text-sm font-bold text-gray-900 break-words">{name}</h4>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 break-words"><PhoneCall className="w-3.5 h-3.5 text-gray-400" /> {phone}</p>
            </div>
        </div>
    );
};

export default Visits;
