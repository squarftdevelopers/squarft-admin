import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Activity,
    ArrowRight,
    ArrowUpRight,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    Eye,
    FileText,
    
    Layers,
    MapPin,
    MessageSquare,
    Navigation,
    PhoneCall,
    Plus,
    Search,
    Sparkles,
    User,
    UserCheck,
    Users,
    X,
    Zap
} from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Header from '../../components/layout/Header';
import Table from '../../components/ui/Table';
import propertyHeroImage from '../../assets/login-bg.png';
import {
    addClientMeeting,
    addClientRequirement,
    assignPropertyToClient,
    bookVisitForAssignedProperty,
    unassignProperty,
    convertClientToDeal,
    deleteClientMeeting,
    fetchAvailableOfficers,
    fetchClientAssignedProperties,
    fetchClientHubClients,
    fetchClientProfileBundle,
    fetchTodayVisits,
    initiateDealForAssignedProperty,
    parseBudgetRange,
    registerClient,
    saveClientNote,
    scheduleClientVisit,
    updateClientMeeting,
    updateClientProfile,
    updateClientRequirement,
    fetchOfficerBookedSlots,
} from '../../services/clientHubService';

const clientFormInitialState = {
    name: '',
    phone: '',
    budget: '',
    source: '',
    listingType: 'Buy',
    listingKind: 'Residential',
    propType: 'APARTMENT/FLATS',
    bhk: '3BHK',
    location: '',
    officer: 'Neha K.',
    status: 'Active',
    score: 'Warm',
    nextFollowUp: '',
    latestNote: '',
};

const meetingInitialState = {
    date: '',
    time: '',
    mode: 'Office Meeting',
    location: '',
    status: 'Scheduled',
    agenda: '',
    remarks: '',
};

const requirementInitialState = {
    status: 'Buy',
    propertyCategory: 'Residential',
    propertyType: 'Plot',
    configuration: 'N/A',
    minArea: '',
    maxArea: '',
    unit: 'Square Feet (Sq. ft)',
    customerName: '',
    contactNumber: '',
    location: '',
    budgetMin: '100000',
    budgetMax: '10000000',
    notes: '',
    otp: '',
    contactVerified: false,
};

const propertyCategories = ['Residential', 'Commercial'];
const propertyTypesByCategory = {
    Residential: ['Plot', 'Villa', 'Apartment', 'Rowhouse'],
    Commercial: ['Shop', 'Showroom', 'Office'],
};
const configurationOptions = {
    Rowhouse: ['1bhk', '2bhk', '3bhk', '4bhk', '5+bhk'],
    Apartment: ['1bhk', '2bhk', '3bhk', '4bhk', '5+bhk'],
    Office: ['Ready to move', 'Co-working', 'Bare shell'],
};
const areaUnits = ['Square Feet (Sq. ft)', 'Square Meter (Sq. m)', 'Square Yard (Sq. yd)', 'Acre', 'Hectare', 'Bigha'];

const getStatusBadge = (status) => {
    if (['Active', 'Completed'].includes(status)) return <Badge variant="green">{status}</Badge>;
    if (['Negotiating', 'Pending'].includes(status)) return <Badge variant="yellow">{status}</Badge>;
    if (status === 'Suspended') return <Badge variant="gray">{status}</Badge>;
    return <Badge variant="purple">{status}</Badge>;
};

const getNowStamp = () => ({
    date: new Date().toLocaleDateString('en-IN'),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
});

const buildInventoryWithUnits = (project) => (project.inventory || []).map((config, configIndex) => {
    if (Array.isArray(config.unitsList) && config.unitsList.length > 0) {
        return config;
    }

    const displayUnits = Math.min(config.totalUnits || 0, 24);
    const availableUnits = Math.max(0, config.availableUnits || 0);
    const availableDisplayCount = Math.ceil((availableUnits / Math.max(config.totalUnits || 1, 1)) * displayUnits);

    return {
        ...config,
        unitsList: Array.from({ length: displayUnits }, (_, index) => {
            const floor = Math.ceil((index + 1) / 4);
            const unitNumber = `${floor}${(index % 4) + 1}`.padStart(3, '0');

            return {
                id: `${project.id}-${configIndex}-${unitNumber}`,
                number: unitNumber,
                floor,
                status: index < availableDisplayCount ? 'Available' : 'Sold',
                facing: index % 2 === 0 ? 'East Facing' : 'West Facing',
                price: config.basePrice,
                configType: config.type,
                size: config.size,
            };
        }),
    };
});

const ClientProfileView = ({
    client,
    projects,
    visits,
    officers,
    officerOptions = [],
    onBack,
    onUpdateClient,
    onAddNote,
    onAddMeeting,
    onUpdateMeeting,
    onDeleteMeeting,
    onContinueToDeal,
    onScheduleVisit,
    onSaveRequirement,
    onAssignUnits,
    onAssignProperty,
}) => {
    const [activeProfileTab, setActiveProfileTab] = useState('Selected Properties');
    const [newNote, setNewNote] = useState('');
    const propertyTypeEdit = {
        category: client.listingKind || 'Residential',
        bhkOptions: client.req?.bhk || ['3BHK'],
    };
    const [followUpForm, setFollowUpForm] = useState({
        type: 'Call Note',
        nextFollowUp: client.nextFollowUp || '',
        status: client.status || 'Active',
    });
    const [meetingForm, setMeetingForm] = useState(meetingInitialState);
    const [editingMeetingIndex, setEditingMeetingIndex] = useState(null);
    const [assignedOfficer, setAssignedOfficer] = useState('');
    const [isChangingOfficer, setIsChangingOfficer] = useState(false);
    const [selectedProps, setSelectedProps] = useState([]);
    const [assignmentSuccess, setAssignmentSuccess] = useState(false);
    const [pendingDealIndex, setPendingDealIndex] = useState(null);
    const [selectedSiteVisitId, setSelectedSiteVisitId] = useState(null);
    const [expandedProjectId, setExpandedProjectId] = useState(null);
    const [expandedConfigByProject, setExpandedConfigByProject] = useState({});
    const [projectDetails, setProjectDetails] = useState(null);
    const [isScheduleVisitOpen, setIsScheduleVisitOpen] = useState(false);
    const [officerBookedSlots, setOfficerBookedSlots] = useState([]);
    const [visitForm, setVisitForm] = useState({
        officerId: '',
        officerName: '',
        officerPhone: '',
        customerName: '',
        customerPhone: '',
        purpose: 'BUY',
        date: '',
        time: '',
        startTime: '',
        endTime: '',
        status: 'Scheduled',
        propertyId: '',
        propertyName: '',
        propertyType: 'APARTMENT/FLATS',
        propertyConfig: '',
        propertyAddress: '',
        propertyPrice: '',
        notes: '',
    });
    const [isEditingRequirement, setIsEditingRequirement] = useState(false);
    const [editRequirementForm, setEditRequirementForm] = useState(null);
    const [isAssignPropertyOpen, setIsAssignPropertyOpen] = useState(false);
    const [assignForm, setAssignForm] = useState({
        projectId: '',
        unitId: '',
        targetUnits: '',
        notes: '',
    });

    const [filteredOfficerOptions, setFilteredOfficerOptions] = useState([]);

    useEffect(() => {
        setFilteredOfficerOptions(officerOptions);
    }, [officerOptions]);

    useEffect(() => {
        if (!isScheduleVisitOpen) return;

        if (visitForm.date && visitForm.startTime && visitForm.endTime) {
            const startStr = `${visitForm.date}T${visitForm.startTime}:00`;
            const endStr = `${visitForm.date}T${visitForm.endTime}:00`;
            
            const startD = new Date(startStr);
            const endD = new Date(endStr);
            
            if (!Number.isNaN(startD.getTime()) && !Number.isNaN(endD.getTime())) {
                fetchAvailableOfficers({ 
                    slotStart: startD.toISOString(), 
                    slotEnd: endD.toISOString() 
                })
                .then((res) => {
                    setFilteredOfficerOptions(res);
                    setVisitForm((f) => {
                        const stillAvailable = res.some((item) => item.id === f.officerId);
                        if (!stillAvailable && res.length > 0) {
                            return {
                                ...f,
                                officerId: res[0].id,
                                officerName: res[0].name,
                                officerPhone: res[0].phone || '',
                            };
                        }
                        return f;
                    });
                })
                .catch((err) => {
                    console.error("Failed to query slot-available officers:", err);
                });
            }
        } else {
            setFilteredOfficerOptions(officerOptions);
        }
    }, [visitForm.date, visitForm.startTime, visitForm.endTime, isScheduleVisitOpen, officerOptions]);

    useEffect(() => {
        if (!isScheduleVisitOpen || !visitForm.officerId || !visitForm.date) {
            setOfficerBookedSlots([]);
            return;
        }

        fetchOfficerBookedSlots(visitForm.officerId, visitForm.date)
            .then(setOfficerBookedSlots)
            .catch((err) => console.error("Error fetching officer booked slots:", err));
    }, [visitForm.officerId, visitForm.date, isScheduleVisitOpen]);

    const handleAssignPropertySubmit = async (e) => {
        e.preventDefault();
        if (!assignForm.projectId) return;
        const selectedProject = projects.find(p => p.id === assignForm.projectId);
        const payload = {
            projectId: assignForm.projectId,
            inventoryUnitId: assignForm.unitId || null,
            propertyId: selectedProject?.propertyId || selectedProject?.property_id || null,
            targetUnits: assignForm.targetUnits ? [assignForm.targetUnits] : [],
            notes: assignForm.notes || null,
        };
        try {
            await onAssignProperty(payload);
            setIsAssignPropertyOpen(false);
            setAssignForm({ projectId: '', unitId: '', targetUnits: '', notes: '' });
        } catch (err) {
            console.error("Assign property modal error:", err);
        }
    };

    const tabs = ['Selected Properties', 'Follow-up & Notes', 'Site Visits', 'Meetings'];
    const clientVisits = visits;
    const selectedSiteVisit = clientVisits.find((visit) => visit.id === selectedSiteVisitId);
    const assignedSalesOfficer = client.officer?.trim();
    const selectedSalesOfficer = assignedSalesOfficer || assignedOfficer;
    const schedulableProjects = projects;

    const getProject = (id) => projects.find((project) => project.id === id);

    const handleAddNote = async () => {
        const text = newNote.trim();
        if (!text) return;

        const now = getNowStamp();
        const note = {
            text,
            type: followUpForm.type,
            nextFollowUp: followUpForm.nextFollowUp,
            status: followUpForm.status,
            ...now,
        };

        try {
            await onAddNote(note, followUpForm);
            setNewNote('');
        } catch (error) {
            console.error('Failed to save client note:', error);
        }
    };

    const openEditRequirement = () => {
        const latest = (client.customerRequirements || [])[0];
        setEditRequirementForm(latest ? {
            status: latest.requirement_type || latest.type?.toLowerCase() || 'buy',
            propertyCategory: latest.property_category || 'Residential',
            propertyType: latest.property_type || 'Plot',
            configuration: latest.configuration || 'N/A',
            minArea: latest.min_area || '',
            maxArea: latest.max_area || '',
            unit: latest.area_unit || 'Square Feet (Sq. ft)',
            customerName: latest.customer_name || '',
            contactNumber: latest.contact_number || '',
            location: latest.preferred_locations?.[0] || '',
            budgetMin: String(latest.budget_min || '100000'),
            budgetMax: String(latest.budget_max || '10000000'),
            notes: latest.notes || '',
            otp: '',
            contactVerified: latest.contact_verified || false,
            _id: latest.id,
        } : {
            ...requirementInitialState,
            customerName: client.name || '',
            contactNumber: client.phone || '',
            propertyCategory: client.req?.type || client.listingKind || 'Residential',
            propertyType: client.propType || 'Plot',
            location: client.req?.loc?.[0] || '',
        });
        setIsEditingRequirement(true);
    };

    const updateEditRequirementForm = (field, value) => {
        setEditRequirementForm((current) => {
            if (field === 'propertyCategory') {
                const nextPropertyType = propertyTypesByCategory[value]?.[0] || 'Plot';
                return { ...current, propertyCategory: value, propertyType: nextPropertyType, configuration: 'N/A' };
            }
            if (field === 'propertyType') return { ...current, propertyType: value, configuration: 'N/A' };
            // NOTE(QA-P1): Placeholder/non-functional OTP verification — intentional per current UI copy.
            // Any 4-digit string is accepted as "verified" here; there is no real send-OTP/verify-OTP API
            // call anywhere in this flow (contrast with visitManagementService.sendVisitOtp/verifyVisitOtp,
            // which are real but unused elsewhere — see Visits.jsx OTP TODO). `contact_verified` is
            // persisted to the backend (customer_requirements.contact_verified) but, as of this check, is
            // only ever stored/returned by clientHubController.js — nothing downstream (deal creation,
            // document/KYC gating, compliance checks) reads or enforces it, so this fake verification is
            // currently cosmetic only. Re-audit this note if `contact_verified` starts being used to gate
            // anything compliance-sensitive in the future.
            if (field === 'otp') return { ...current, otp: value, contactVerified: value.length === 4 };
            if (field === 'contactNumber') return { ...current, contactNumber: value, contactVerified: false, otp: '' };
            return { ...current, [field]: value };
        });
    };

    const handleSaveEditRequirement = async () => {
        if (!editRequirementForm?.customerName?.trim() || !editRequirementForm?.contactNumber?.trim()) return;
        const now = getNowStamp();
        const updated = {
            id: editRequirementForm._id || null,
            customer_name: editRequirementForm.customerName.trim(),
            contact_number: editRequirementForm.contactNumber.trim(),
            requirement_type: editRequirementForm.status,
            property_category: editRequirementForm.propertyCategory,
            property_type: editRequirementForm.propertyType,
            configuration: editRequirementForm.configuration,
            min_area: editRequirementForm.minArea,
            max_area: editRequirementForm.maxArea,
            area_unit: editRequirementForm.unit,
            budget_min: Number(editRequirementForm.budgetMin || 0),
            budget_max: Number(editRequirementForm.budgetMax || 0),
            preferred_locations: editRequirementForm.location.trim() ? [editRequirementForm.location.trim()] : [],
            notes: editRequirementForm.notes.trim(),
            contact_verified: editRequirementForm.contactVerified,
            created_at: `${now.date} ${now.time}`,
        };

        try {
            await onSaveRequirement(updated);
            setIsEditingRequirement(false);
        } catch (error) {
            console.error('Failed to save client requirement:', error);
        }
    };

    const [meetingSaving, setMeetingSaving] = useState(false);

    const handleSaveMeeting = async () => {
        if (!meetingForm.date || !meetingForm.time) return;

        const meeting = {
            date: meetingForm.date,
            time: meetingForm.time,
            mode: meetingForm.mode,
            location: meetingForm.location || 'Sales office',
            status: meetingForm.status,
            agenda: meetingForm.agenda || 'Client discussion',
            remarks: meetingForm.remarks || 'Client meeting scheduled.',
        };

        setMeetingSaving(true);
        try {
            const editingMeetingId = editingMeetingIndex === null ? null : client.meetings?.[editingMeetingIndex]?.id;
            if (editingMeetingId) {
                await onUpdateMeeting(editingMeetingId, meeting);
            } else {
                await onAddMeeting(meeting);
            }
            setMeetingForm(meetingInitialState);
            setEditingMeetingIndex(null);
        } catch (error) {
            console.error('Failed to save meeting:', error);
        } finally {
            setMeetingSaving(false);
        }
    };

    const handleEditMeeting = (meeting, index) => {
        setEditingMeetingIndex(index);
        setMeetingForm({
            date: meeting.date || '',
            time: meeting.time || '',
            mode: meeting.mode || 'Office Meeting',
            location: meeting.location || '',
            status: meeting.status || 'Scheduled',
            agenda: meeting.agenda || '',
            remarks: meeting.remarks || '',
        });
    };

    const handleCancelMeetingEdit = () => {
        setEditingMeetingIndex(null);
        setMeetingForm(meetingInitialState);
    };

    const handleMeetingStatusChange = async (meeting, index, status) => {
        try {
            await onUpdateMeeting(meeting.id, { ...meeting, status });
        } catch (error) {
            console.error('Failed to update meeting status:', error);
        }
    };

    const handleDeleteMeeting = async (meeting, index) => {
        try {
            await onDeleteMeeting(meeting.id);
            if (editingMeetingIndex === index) {
                handleCancelMeetingEdit();
            }
        } catch (error) {
            console.error('Failed to delete meeting:', error);
        }
    };

    const getMeetingStatusClass = (status = 'Scheduled') => {
        if (status === 'Completed') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
        if (status === 'Cancelled') return 'bg-gray-100 text-gray-500 border-gray-200';
        return 'bg-blue-50 text-blue-700 border-blue-100';
    };

    const openProjectFloorPlan = (project) => {
        setExpandedProjectId((current) => (current === project.id ? null : project.id));
        setExpandedConfigByProject((current) => ({
            ...current,
            [project.id]: current[project.id] ?? 0,
        }));
    };

    const selectProjectConfig = (projectId, configIndex) => {
        setExpandedConfigByProject((current) => ({ ...current, [projectId]: configIndex }));
    };

    const toggleUnitAssignment = (project, config, unit) => {
        if (unit.status !== 'Available') return;

        const key = unit.id;
        setSelectedProps((current) => {
            if (current.some((assignment) => assignment.key === key)) {
                return current.filter((assignment) => assignment.key !== key);
            }

            return [
                ...current,
                {
                    key,
                    projectId: project.id,
                    projectName: project.name,
                    configType: config.type,
                    size: config.size,
                    unitNumber: unit.number,
                    floor: unit.floor,
                    facing: unit.facing,
                    price: unit.price,
                },
            ];
        });
    };

    const handleAssignSubmit = async () => {
        if (!selectedSalesOfficer || selectedProps.length === 0) return;
        try {
            await onAssignUnits(selectedProps, selectedSalesOfficer);
            setAssignmentSuccess(true);
            window.setTimeout(() => {
                setAssignmentSuccess(false);
                setSelectedProps([]);
                setAssignedOfficer('');
            }, 900);
        } catch (error) {
            console.error('Failed to assign units:', error);
        }
    };

    const pendingDealItem = pendingDealIndex !== null ? client.propertyPipeline?.[pendingDealIndex] : null;
    const pendingDealProject = pendingDealItem ? getProject(pendingDealItem.projectId) : null;

    const [pendingVisitDeal, setPendingVisitDeal] = useState(null);
    const [dealAmount, setDealAmount] = useState('');
    const [dealSubmitting, setDealSubmitting] = useState(false);
    const [dealError, setDealError] = useState('');

    const closeDealDialog = () => {
        setPendingDealIndex(null);
        setPendingVisitDeal(null);
        setDealAmount('');
        setDealError('');
    };

    const handleConfirmContinueToDeal = async () => {
        if (pendingDealIndex === null || !pendingDealItem || !pendingDealProject) return;

        const amount = Number(dealAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setDealError('Enter a valid confirmed deal amount.');
            return;
        }
        setDealSubmitting(true);
        setDealError('');
        try {
            await onContinueToDeal({
                pipelineItem: pendingDealItem,
                project: pendingDealProject,
                dealValue: amount,
            });
            closeDealDialog();
        } catch (error) {
            console.error('Failed to continue assigned property to deal:', error);
            setDealError(error.message || 'Unable to start the deal.');
        } finally {
            setDealSubmitting(false);
        }
    };

    const handleConfirmVisitDeal = async () => {
        if (!pendingVisitDeal) return;

        const amount = Number(dealAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setDealError('Enter a valid confirmed deal amount.');
            return;
        }
        setDealSubmitting(true);
        setDealError('');
        try {
            await onContinueToDeal({ visit: pendingVisitDeal, dealValue: amount });
            closeDealDialog();
        } catch (error) {
            console.error('Failed to continue visit to deal:', error);
            setDealError(error.message || 'Unable to start the deal.');
        } finally {
            setDealSubmitting(false);
        }
    };

    const getVisitBadgeClass = (status) => {
        if (status === 'Completed') return 'bg-emerald-50 text-emerald-700';
        if (status === 'Cancelled') return 'bg-gray-100 text-gray-500';
        return 'bg-rose-50 text-rose-600';
    };

    const activeFloorPlanProject = expandedProjectId ? getProject(expandedProjectId) : null;
    const activeFloorPlanInventory = activeFloorPlanProject ? buildInventoryWithUnits(activeFloorPlanProject) : [];
    const activeFloorPlanConfigIndex = activeFloorPlanProject ? (expandedConfigByProject[activeFloorPlanProject.id] ?? 0) : 0;
    const activeFloorPlanConfig = activeFloorPlanInventory[activeFloorPlanConfigIndex] || activeFloorPlanInventory[0];

    return (
        <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold mb-4">Customer Requirements</h2>
                {!client.customerRequirements?.length ? <p className="text-sm text-slate-500">No requirements recorded for this customer.</p> : client.customerRequirements.map(requirement => (
                    <article key={requirement.id} className="border-t first:border-t-0 py-4 space-y-2 text-sm">
                        <div className="font-semibold">{[requirement.type, requirement.property_category, requirement.property_type].filter(Boolean).join(' · ')}</div>
                        <div><span className="text-slate-500">Budget: </span>{requirement.budget_range}</div>
                        <div><span className="text-slate-500">Preferred locations: </span>{requirement.location}</div>
                        <div>{requirement.customer_name} · {requirement.contact_number}</div>
                        {requirement.notes && <p className="whitespace-pre-wrap text-slate-600">{requirement.notes}</p>}
                        <div className="text-xs text-slate-500">{requirement.created_at ? new Date(requirement.created_at).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) : ''} · Contact {requirement.contact_verified ? 'verified' : 'not verified'}</div>
                    </article>
                ))}
            </section>
            <Card noPadding className="bg-linear-to-r from-white to-[#6F4BFF]/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                    <button onClick={openEditRequirement} className="px-3 py-1.5 rounded-lg border border-[#6F4BFF]/30 bg-[#6F4BFF]/5 text-xs font-bold text-[#6F4BFF] hover:bg-[#6F4BFF]/10 transition-all flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Edit Customer Requirement
                    </button>
                    <button onClick={() => setIsAssignPropertyOpen(true)} className="px-3 py-1.5 rounded-lg bg-[#6F4BFF] border border-[#6F4BFF] text-xs font-bold text-white hover:bg-[#5936eb] transition-all flex items-center gap-1.5 shadow-md shadow-[#6F4BFF]/20">
                        <Plus className="w-3.5 h-3.5" /> Assign Property
                    </button>
                    <button onClick={() => setActiveProfileTab('Follow-up & Notes')} className="p-2 hover:bg-white/60 rounded-lg text-gray-500 transition-colors backdrop-blur-sm border border-gray-200">
                        <MessageSquare className="w-4 h-4" />
                    </button>
                    <button onClick={onBack} className="p-2 hover:bg-white/60 rounded-lg text-gray-500 transition-colors backdrop-blur-sm border border-gray-200">
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                </div>
                <div className="p-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex gap-5 flex-1">
                        <div className="w-16 h-16 rounded-2xl bg-[#6F4BFF] text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-[#6F4BFF]/20">
                            {client.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold text-gray-900">{client.name}</h2>
                                {getStatusBadge(client.status)}
                            </div>
                            <p className="text-gray-500 font-medium flex flex-wrap items-center gap-3 mb-3">
                                <span className="flex items-center gap-1"><PhoneCall className="w-3.5 h-3.5" /> {client.phone}</span>
                                <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Officer: {client.officer}</span>
                            </p>
                            <div className="flex flex-wrap gap-2 items-center">
                                <Badge variant={propertyTypeEdit.category === 'Residential' ? 'purple' : 'yellow'}>{propertyTypeEdit.category}</Badge>
                                {propertyTypeEdit.bhkOptions.map((bhk) => <Badge key={bhk} variant="gray">{bhk}</Badge>)}
                            </div>
                        </div>
                    </div>
                    <div className="text-left lg:text-right lg:mt-6 lg:mr-10">
                        <p className="text-sm text-gray-500 font-semibold mb-1">Approved Budget</p>
                        <p className="text-3xl font-bold text-emerald-600">{client.budget}</p>
                    </div>
                </div>
            </Card>

            {/* Edit Customer Requirement Modal */}
            {isEditingRequirement && editRequirementForm && (
                <Modal isOpen={isEditingRequirement} onClose={() => setIsEditingRequirement(false)} title="Edit Customer Requirement" size="lg">
                    <div className="space-y-5">
                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700">Property Category</label>
                            <div className="grid grid-cols-2 gap-3">
                                {propertyCategories.map((item) => (
                                    <button key={item} type="button" onClick={() => updateEditRequirementForm('propertyCategory', item)} className={`rounded-xl border p-4 text-left text-sm font-black ${editRequirementForm.propertyCategory === item ? 'border-[#4A43EC] bg-[#EEEDFD] text-[#4A43EC]' : 'border-gray-200 bg-white text-gray-700'}`}>
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700">Property Type</label>
                            <div className="grid grid-cols-4 gap-2">
                                {(propertyTypesByCategory[editRequirementForm.propertyCategory] || []).map((item) => (
                                    <button key={item} type="button" onClick={() => updateEditRequirementForm('propertyType', item)} className={`rounded-lg border px-3 py-3 text-xs font-black ${editRequirementForm.propertyType === item ? 'border-[#4A43EC] bg-[#EEEDFD] text-[#4A43EC]' : 'border-gray-200 bg-white text-gray-600'}`}>
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {configurationOptions[editRequirementForm.propertyType] && (
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Configuration / Status</label>
                                <select value={editRequirementForm.configuration} onChange={(e) => updateEditRequirementForm('configuration', e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30">
                                    <option value="N/A">Select option</option>
                                    {configurationOptions[editRequirementForm.propertyType].map((item) => <option key={item}>{item}</option>)}
                                </select>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Min Area</label>
                                <input type="number" value={editRequirementForm.minArea} onChange={(e) => updateEditRequirementForm('minArea', e.target.value)} placeholder="Optional" className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Max Area</label>
                                <input type="number" value={editRequirementForm.maxArea} onChange={(e) => updateEditRequirementForm('maxArea', e.target.value)} placeholder="2000" className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700">Unit</label>
                            <select value={editRequirementForm.unit} onChange={(e) => updateEditRequirementForm('unit', e.target.value)} className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30">
                                {areaUnits.map((item) => <option key={item}>{item}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Customer Name</label>
                                <input value={editRequirementForm.customerName} onChange={(e) => updateEditRequirementForm('customerName', e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Contact Number</label>
                                <input value={editRequirementForm.contactNumber} onChange={(e) => updateEditRequirementForm('contactNumber', e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                        </div>

                        {!editRequirementForm.contactVerified && editRequirementForm.contactNumber.length >= 10 && (
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">OTP Verification</label>
                                <input maxLength={4} value={editRequirementForm.otp} onChange={(e) => updateEditRequirementForm('otp', e.target.value.replace(/\D/g, ''))} placeholder="Enter 4 digit OTP" className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                                <p className="mt-1 text-[10px] font-bold text-gray-400">Any 4 digit OTP marks contact verified.</p>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700">Preferred Location</label>
                            <input value={editRequirementForm.location} onChange={(e) => updateEditRequirementForm('location', e.target.value)} placeholder="Enter preferred location" className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Budget Min</label>
                                <input type="number" value={editRequirementForm.budgetMin} onChange={(e) => updateEditRequirementForm('budgetMin', e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-black text-gray-700">Budget Max</label>
                                <input type="number" value={editRequirementForm.budgetMax} onChange={(e) => updateEditRequirementForm('budgetMax', e.target.value)} className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700">Details</label>
                            <textarea rows="3" value={editRequirementForm.notes} onChange={(e) => updateEditRequirementForm('notes', e.target.value)} placeholder="Requirement notes..." className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30" />
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                            <button onClick={() => setIsEditingRequirement(false)} className="px-5 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-bold hover:bg-gray-50">
                                Cancel
                            </button>
                            <button onClick={handleSaveEditRequirement} className="px-5 py-2 rounded-lg bg-[#4A43EC] text-white font-bold hover:bg-[#3932d5] transition-colors">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex overflow-x-auto border-b border-gray-200 hide-scrollbar bg-gray-50/50">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveProfileTab(tab)}
                            className={`whitespace-nowrap px-6 py-4 font-bold text-sm transition-colors border-b-2 ${
                                activeProfileTab === tab
                                    ? 'border-[#6F4BFF] text-[#6F4BFF] bg-white'
                                    : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6 md:p-8 bg-gray-50/30 min-h-[500px]">
                    {activeProfileTab === 'Selected Properties' && (
                        <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-[#6F4BFF]" /> Recommended Matches & Assignment</h3>
                                    <p className="text-sm text-gray-500 mt-1">Select properties below to assign to the client and notify the sales officer.</p>
                                </div>
                            </div>

                            {assignmentSuccess && (
                                <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg flex items-center gap-3 font-bold animate-in zoom-in-95 duration-200">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    Properties successfully assigned to {selectedSalesOfficer} and sent to the client's app.
                                </div>
                            )}

                            <Card className="mb-8 border-t-4 border-t-[#6F4BFF]">
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-gray-800 uppercase tracking-wider">Assign To Sales Officer</label>
                                        {assignedSalesOfficer && !isChangingOfficer && (
                                            <button type="button" onClick={() => setIsChangingOfficer(true)}
                                                className="px-3 py-1.5 rounded-lg border border-[#6F4BFF]/30 bg-[#6F4BFF]/5 text-xs font-black text-[#6F4BFF] hover:bg-[#6F4BFF] hover:text-white transition-all">
                                                Reassign Sales Officer
                                            </button>
                                        )}
                                        {isChangingOfficer && (
                                            <button type="button" onClick={() => { setIsChangingOfficer(false); setAssignedOfficer(''); }}
                                                className="text-xs font-bold text-gray-400 hover:text-gray-700 flex items-center gap-1">
                                                <X className="w-3 h-3" /> Cancel
                                            </button>
                                        )}
                                    </div>

                                    {assignedSalesOfficer && !isChangingOfficer ? (
                                        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 font-black text-sm shrink-0">
                                                {assignedSalesOfficer.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Assigned Officer</p>
                                                <p className="text-sm font-black text-gray-900">{assignedSalesOfficer}</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {officers.map((officer) => {
                                                const officerVisits = visits.filter((v) => v.officerName === officer && v.status !== 'Cancelled' && v.status !== 'Completed');
                                                const slots = ['10:00-11:00', '12:00-13:00', '15:00-16:00', '17:00-18:00'];
                                                const slotHours = { '10:00-11:00': 10, '12:00-13:00': 12, '15:00-16:00': 15, '17:00-18:00': 17 };
                                                const busySlots = officerVisits.map((v) => {
                                                    if (!v.slotStart) return null;
                                                    const hour = new Date(v.slotStart).getHours();
                                                    const match = Object.entries(slotHours).find(([, slotHour]) => slotHour === hour);
                                                    return match ? match[0] : null;
                                                }).filter(Boolean);
                                                const isSelected = (assignedOfficer || assignedSalesOfficer) === officer;
                                                const freeCount = slots.filter((s) => !busySlots.includes(s)).length;

                                                return (
                                                    <button key={officer} type="button"
                                                        onClick={() => {
                                                            setAssignedOfficer(officer);
                                                            setIsChangingOfficer(false);
                                                            if (assignedSalesOfficer) onUpdateClient({ officer });
                                                        }}
                                                        className={`rounded-xl border p-3 text-left transition-all ${isSelected ? 'border-[#6F4BFF] bg-[#6F4BFF]/5 ring-2 ring-[#6F4BFF]/20' : 'border-gray-200 bg-white hover:border-[#6F4BFF]/40'}`}
                                                    >
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${isSelected ? 'bg-[#6F4BFF] text-white' : 'bg-gray-100 text-gray-600'}`}>
                                                                {officer.charAt(0)}
                                                            </div>
                                                            <p className="text-xs font-black text-gray-900 truncate">{officer}</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {slots.map((slot) => {
                                                                const busy = busySlots.includes(slot);
                                                                return (
                                                                    <div key={slot} className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 ${busy ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${busy ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                                                                        <span className={`text-[9px] font-black ${busy ? 'text-rose-600' : 'text-emerald-600'}`}>{slot}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <p className={`mt-2 text-[10px] font-black ${freeCount > 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                            {freeCount} slot{freeCount !== 1 ? 's' : ''} free
                                                        </p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </Card>

                            {(client.propertyPipeline || []).length > 0 && (
                                <div className="mb-8">
                                    <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3">Already Assigned Properties</h4>
                                    <div className="flex gap-4 overflow-x-auto pb-4 snap-x scroll-smooth hide-scrollbar">
                                        {(client.propertyPipeline || []).map((pipelineItem, index) => {
                                            const project = getProject(pipelineItem.projectId);
                                            if (!project) return null;
                                            const continuedToDeal = Boolean(pipelineItem.continuedToDeal || pipelineItem.deal);
                                            const completedVisit = String(pipelineItem.siteVisit?.status || '').toLowerCase() === 'completed';
                                            const isExpanded = expandedProjectId === project.id;
                                            return (
                                                <div key={`${pipelineItem.projectId}-assigned-${index}`} className="snap-start shrink-0 w-80">
                                                    <Card noPadding className={`relative border-2 transition-all h-full flex flex-col justify-between ${isExpanded ? 'border-[#6F4BFF] bg-[#6F4BFF]/5 ring-2 ring-[#6F4BFF]/10 shadow-lg' : continuedToDeal ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 hover:border-[#6F4BFF]/40 bg-white'}`}>
                                                        {continuedToDeal && <div className="absolute top-2 left-2 z-10"><Badge variant="green">Deal Closed</Badge></div>}
                                                        <button type="button" className={`w-full text-left p-4 flex flex-col h-full ${continuedToDeal ? 'pt-10' : ''}`} onClick={() => openProjectFloorPlan(project)}>
                                                            <h4 className="font-bold text-gray-900 text-sm capitalize truncate mb-1">{project.name}</h4>
                                                            <p className="text-[10px] text-gray-500 flex items-start gap-1 mb-1 truncate"><MapPin className="w-3 h-3 text-rose-500 shrink-0" /> {project.location}</p>
                                                            <p className="text-[10px] text-gray-400 mb-1 truncate">by {project.builder}</p>
                                                            <p className="text-xs font-bold text-gray-800 mb-2">{project.priceRange}</p>
                                                            <div className="flex items-center gap-1.5 flex-wrap my-1">
                                                                {pipelineItem.units?.map(u => (
                                                                    <span key={u} className="rounded-md bg-[#6F4BFF]/10 px-1.5 py-0.5 text-[9px] font-black text-[#6F4BFF]">Unit {u}</span>
                                                                ))}
                                                                {(!pipelineItem.units || pipelineItem.units.length === 0) && (
                                                                    <span className="text-[10px] text-gray-400">No unit specified</span>
                                                                )}
                                                            </div>
                                                            <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100">
                                                                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[9px] font-black text-gray-600 truncate">{pipelineItem.status}</span>
                                                                <span className={`text-[9px] font-black uppercase tracking-widest ${isExpanded ? 'text-[#6F4BFF]' : 'text-gray-400'}`}>
                                                                    {isExpanded ? 'Viewing Plan' : 'Open Plan'}
                                                                </span>
                                                            </div>
                                                        </button>
                                                        <div className="px-4 pb-3 flex gap-2">
                                                            {!continuedToDeal && (
                                                                <button type="button" title="Remove assignment"
                                                                    onClick={(e) => { e.stopPropagation(); handleUnassignProperty(pipelineItem.id); }}
                                                                    className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-white transition hover:bg-rose-50">
                                                                    Remove
                                                                </button>
                                                            )}
                                                            <button type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const defaultOfficer = officerOptions.find((o) => o.name === client.officer) || officerOptions[0];
                                                                    setVisitForm((f) => ({
                                                                        ...f,
                                                                        customerName: client.name,
                                                                        customerPhone: client.phone,
                                                                        officerId: defaultOfficer?.id || '',
                                                                        officerName: defaultOfficer?.name || client.officer || officers[0] || '',
                                                                        officerPhone: defaultOfficer?.phone || client.officerPhone || '',
                                                                        projectId: project.id,
                                                                        propertyId: project.propertyId || project.property_id || '',
                                                                        propertyName: project.name || '',
                                                                        propertyType: project.specs || project.property_type || '',
                                                                        propertyConfig: project.configuration || (Array.isArray(project.configs) ? project.configs.join(', ') : '') || '',
                                                                        propertyAddress: project.location || '',
                                                                        propertyPrice: (pipelineItem.unit?.price ? (typeof pipelineItem.unit.price === 'number' ? `Rs. ${pipelineItem.unit.price.toLocaleString('en-IN')}` : String(pipelineItem.unit.price)) : '') || project.priceRange || project.price_range || '',
                                                                        assignedPropertyId: pipelineItem.id,
                                                                    }));
                                                                    setIsScheduleVisitOpen(true);
                                                                }}
                                                                className="flex-1 rounded-lg border border-[#6F4BFF] px-2.5 py-1.5 text-xs font-bold text-[#6F4BFF] bg-white transition hover:bg-[#6F4BFF]/5">
                                                                Book Visit
                                                            </button>
                                                            {completedVisit && <button type="button" disabled={continuedToDeal}
                                                                onClick={(e) => { e.stopPropagation(); setPendingDealIndex(index); }}
                                                                className="flex-1 rounded-lg bg-[#6F4BFF] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#5936eb] disabled:bg-emerald-100 disabled:text-emerald-700">
                                                                {continuedToDeal ? 'Deal Started' : 'Start Deal'}
                                                            </button>}
                                                        </div>
                                                    </Card>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] gap-6 items-start">
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end mb-1">
                                        <h4 className="text-sm font-black text-gray-400 uppercase tracking-widest">Available Properties</h4>
                                        <span className="text-xs font-bold text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200 shadow-xs">Selected Units: <span className="text-[#6F4BFF] text-sm ml-1">{selectedProps.length}</span></span>
                                    </div>

                                    {projects.filter(project => {
                                        const isAssigned = (client.propertyPipeline || []).some(
                                            (p) => p.projectId === project.id
                                        );
                                        return !isAssigned;
                                    }).map((project) => {
                                        const isExpanded = expandedProjectId === project.id;
                                        const selectedProjectUnits = selectedProps.filter((assignment) => assignment.projectId === project.id);
                                        return (
                                            <Card key={project.id} noPadding className={`relative border-2 transition-all ${isExpanded ? 'border-purple-400 shadow-lg ring-2 ring-[#6F4BFF]/10 bg-purple-50/10' : 'border-gray-200 hover:border-[#6F4BFF]/50 bg-white'}`}>
                                                <button type="button" className="w-full text-left flex gap-4 p-4 items-start" onClick={() => openProjectFloorPlan(project)}>
                                                    <div className="flex-1">
                                                        {Number.isFinite(project.matchPercentage) && <div className="mb-1"><Badge variant="green">{project.matchPercentage}% Match</Badge></div>}
                                                        <h4 className="font-bold text-gray-900 text-base capitalize mb-1">{project.name}</h4>
                                                        <p className="text-[11px] text-gray-500 font-medium flex items-start gap-1 mb-1"><MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" /> {project.location}</p>
                                                        <p className="text-[11px] text-gray-400 font-medium mb-2">by {project.builder} · {project.specs}</p>
                                                        <p className="text-sm font-bold text-gray-800">{project.priceRange}</p>
                                                        <p className="text-[11px] text-gray-400 mt-1">{project.available} units available of {project.units}</p>
                                                        {selectedProjectUnits.length > 0 && (
                                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                                {selectedProjectUnits.map((assignment) => (
                                                                    <span key={assignment.key} className="rounded-md bg-[#6F4BFF]/10 px-2 py-1 text-[10px] font-black text-[#6F4BFF]">Unit {assignment.unitNumber}</span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2 mt-1 shrink-0">
                                                        {project.source === 'Broker' && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide bg-amber-50 text-amber-600 border border-amber-200">
                                                                <span className="w-1.5 h-1.5 rounded-full inline-block bg-current opacity-70" /> via Broker
                                                            </span>
                                                        )}
                                                        <span className={`rounded-lg border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${isExpanded ? 'border-[#6F4BFF] bg-[#6F4BFF] text-white' : 'border-gray-200 bg-white text-gray-500'}`}>
                                                            {isExpanded ? 'Viewing Plan' : 'Open Plan'}
                                                        </span>
                                                    </div>
                                                </button>
                                                <div className="px-4 pb-4">
                                                    <Button variant="secondary" icon={Eye} className="w-full text-[10px] py-2 font-black uppercase tracking-widest" onClick={() => setProjectDetails(project)}>
                                                        View Full Project
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>

                                <div className="xl:sticky xl:top-6">
                                    <Card noPadding className="overflow-hidden border-[#ded8ff] shadow-xl shadow-[#6F4BFF]/10">
                                        {activeFloorPlanProject ? (
                                            <div className="bg-gray-50/80 animate-in fade-in slide-in-from-right-3 duration-200">
                                                {/* Property Image */}
                                                <div className="relative h-48 overflow-hidden">
                                                    <img
                                                        src={propertyHeroImage}
                                                        alt={activeFloorPlanProject.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                                                    <div className="absolute bottom-3 left-4">
                                                        <p className="text-white font-black text-base leading-tight">{activeFloorPlanProject.name}</p>
                                                        <p className="text-white/75 text-xs font-medium flex items-center gap-1 mt-0.5">
                                                            <MapPin className="w-3 h-3 text-rose-400" /> {activeFloorPlanProject.location}
                                                        </p>
                                                    </div>
                                                </div>

                                                {activeFloorPlanConfig ? (
                                                    <>
                                                        <div className="border-b border-gray-100 bg-white p-4">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <p className="text-[10px] font-black text-[#6F4BFF] uppercase tracking-widest">Floor Plan Workspace</p>
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <Badge variant="gray">{activeFloorPlanConfig.availableUnits} Available</Badge>
                                                                    <Badge variant="purple">{selectedProps.filter((assignment) => assignment.projectId === activeFloorPlanProject.id).length} Selected</Badge>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-5">
                                                            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5">
                                                                {activeFloorPlanInventory.map((config, configIndex) => (
                                                                    <button
                                                                        key={`${activeFloorPlanProject.id}-${config.type}`}
                                                                        type="button"
                                                                        onClick={() => selectProjectConfig(activeFloorPlanProject.id, configIndex)}
                                                                        className={`shrink-0 rounded-xl border px-4 py-3 text-left transition-all ${activeFloorPlanConfigIndex === configIndex ? 'border-[#6F4BFF] bg-white shadow-md text-[#6F4BFF]' : 'border-gray-200 bg-white/70 text-gray-600 hover:border-[#6F4BFF]/40'}`}
                                                                    >
                                                                        <span className="block text-[10px] font-black uppercase tracking-widest">{config.type}</span>
                                                                        <span className="block text-[10px] font-bold mt-1">{config.size} - {config.basePrice}</span>
                                                                    </button>
                                                                ))}
                                                            </div>

                                                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-inner">
                                                                <div className="mb-5 flex items-center justify-between gap-3">
                                                                    <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                                                                        <Layers className="w-4 h-4 text-[#6F4BFF]" /> Interactive Unit Grid
                                                                    </h5>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{activeFloorPlanConfig.type}</span>
                                                                </div>
                                                                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                                                                    {activeFloorPlanConfig.unitsList.map((unit) => {
                                                                        const isUnitSelected = selectedProps.some((assignment) => assignment.key === unit.id);
                                                                        const assignedPipelineItem = client.propertyPipeline?.find(p => p.projectId === activeFloorPlanProject.id);
                                                                        const assignedUnitCodes = assignedPipelineItem?.units || [];
                                                                        const isUnitAlreadyAssigned = assignedUnitCodes.includes(unit.number);
                                                                        return (
                                                                            <button
                                                                                key={unit.id}
                                                                                type="button"
                                                                                disabled={unit.status !== 'Available' && !isUnitAlreadyAssigned}
                                                                                onClick={() => toggleUnitAssignment(activeFloorPlanProject, activeFloorPlanConfig, unit)}
                                                                                className={`h-14 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                                                                    isUnitAlreadyAssigned
                                                                                        ? 'bg-purple-100 border-[#6F4BFF] text-[#6F4BFF] ring-2 ring-[#6F4BFF]/30 font-black'
                                                                                        : unit.status === 'Available'
                                                                                            ? 'bg-white border-gray-200 hover:border-[#6F4BFF] hover:shadow-md'
                                                                                            : 'bg-rose-50 border-rose-100 text-rose-300 cursor-not-allowed'
                                                                                } ${isUnitSelected ? 'ring-2 ring-[#6F4BFF] border-[#6F4BFF] shadow-lg shadow-[#6F4BFF]/20 scale-105 z-10 text-[#6F4BFF]' : ''}`}
                                                                            >
                                                                                <span className="text-sm font-black">{unit.number}</span>
                                                                                <span className="text-[8px] font-bold uppercase tracking-tighter opacity-60">
                                                                                    {isUnitAlreadyAssigned ? 'Assigned' : isUnitSelected ? 'Selected' : unit.status}
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Configuration</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanConfig.type}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Area</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanConfig.size}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Base Price</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanConfig.basePrice}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Location</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanProject.location}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Builder</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanProject.builder}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanProject.specs}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Available Units</p>
                                                                    <p className="mt-1 text-sm font-black text-emerald-600">{activeFloorPlanConfig.availableUnits} / {activeFloorPlanConfig.totalUnits}</p>
                                                                </div>
                                                                <div className="rounded-xl border border-gray-100 bg-white p-3">
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Status</p>
                                                                    <p className="mt-1 text-sm font-black text-gray-900">{activeFloorPlanProject.status}</p>
                                                                </div>
                                                            </div>

                                                            <p className="mt-4 text-[11px] font-bold text-gray-500">Choose the exact unit number to assign. Sold units are locked.</p>

                                                            <div className="mt-4 rounded-2xl border border-[#6F4BFF]/15 bg-white p-4 shadow-sm">
                                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                                    <div>
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ready to Assign</p>
                                                                        <p className="mt-1 text-sm font-black text-gray-900">
                                                                            {selectedProps.length} selected unit{selectedProps.length === 1 ? '' : 's'}
                                                                            {selectedSalesOfficer ? ` for ${selectedSalesOfficer}` : ' - select a sales officer first'}
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={handleAssignSubmit}
                                                                        disabled={selectedProps.length === 0 || !selectedSalesOfficer}
                                                                        className="min-w-40 rounded-xl bg-[#6F4BFF] px-6 py-3 text-sm font-black text-white shadow-md shadow-[#6F4BFF]/20 transition-all hover:bg-[#5936eb] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none flex items-center justify-center gap-2"
                                                                    >
                                                                        <Navigation className="w-4 h-4" /> Assign
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="p-8 text-center bg-white flex flex-col items-center justify-center min-h-[340px]">
                                                        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 border border-amber-100 animate-pulse">
                                                            <Layers className="h-7 w-7" />
                                                        </div>
                                                        <p className="text-sm font-black uppercase tracking-widest text-gray-900">No Interactive Grid Defined</p>
                                                        <p className="mt-2 max-w-sm text-xs font-semibold text-gray-500 leading-relaxed">
                                                            There are no interactive floor plans or unit configurations defined in this project's workspace yet. You can still assign units manually using the "Assign Property" button on the profile header.
                                                        </p>
                                                        <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md text-left">
                                                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Builder</p>
                                                                <p className="mt-1 text-xs font-black text-gray-900 truncate">{activeFloorPlanProject.builder}</p>
                                                            </div>
                                                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Type</p>
                                                                <p className="mt-1 text-xs font-black text-gray-900 truncate">{activeFloorPlanProject.specs}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex min-h-[520px] flex-col items-center justify-center bg-gray-50/70 p-10 text-center">
                                                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#6F4BFF]/10 text-[#6F4BFF]">
                                                    <Layers className="h-7 w-7" />
                                                </div>
                                                <p className="text-sm font-black uppercase tracking-widest text-gray-900">Select a Property</p>
                                                <p className="mt-2 max-w-sm text-sm font-semibold text-gray-500">Click Open Plan on any available property to view the larger floor plan and assign a specific unit number.</p>
                                            </div>
                                        )}
                                    </Card>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeProfileTab === 'Follow-up & Notes' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6"><MessageSquare className="w-5 h-5 text-[#6F4BFF]" /> Notes & Communication</h3>
                                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-6 relative">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Note Type</label>
                                            <select
                                                value={followUpForm.type}
                                                onChange={(event) => setFollowUpForm({ ...followUpForm, type: event.target.value })}
                                                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 bg-white"
                                            >
                                                <option>Call Note</option>
                                                <option>Follow-up Note</option>
                                                <option>Meeting Note</option>
                                                <option>Requirement Update</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Follow-up</label>
                                            <input
                                                type="date"
                                                value={followUpForm.nextFollowUp}
                                                onChange={(event) => setFollowUpForm({ ...followUpForm, nextFollowUp: event.target.value })}
                                                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client Status</label>
                                            <select
                                                value={followUpForm.status}
                                                onChange={(event) => setFollowUpForm({ ...followUpForm, status: event.target.value })}
                                                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 bg-white"
                                            >
                                                <option>Active</option>
                                                <option>Negotiating</option>
                                                <option>Pending</option>
                                                <option>Completed</option>
                                                <option>Suspended</option>
                                            </select>
                                        </div>
                                    </div>
                                    <textarea rows="4" value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Log a call summary or add an internal note..." className="w-full border border-gray-100 rounded-lg p-3 outline-none resize-none text-gray-800 font-medium focus:ring-2 focus:ring-[#6F4BFF]/30"></textarea>
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3 border-t border-gray-100 pt-3">
                                        <p className="text-xs font-bold text-gray-400">{newNote.trim().length} characters</p>
                                        <button disabled={!newNote.trim()} onClick={handleAddNote} className="bg-[#6F4BFF] hover:bg-[#5936eb] text-white px-6 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Plus className="w-4 h-4" /> Save Follow-up</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {(client.notes || []).map((note, index) => (
                                        <div key={`${note.date}-${note.time}-${index}`} className="bg-amber-50/80 border border-amber-200 p-4 rounded-xl shadow-sm">
                                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                                <Badge variant="yellow">{note.type || 'Note'}</Badge>
                                                {note.nextFollowUp && <span className="text-[10px] font-black text-[#6F4BFF] bg-white border border-amber-100 rounded-lg px-2 py-1">Next: {note.nextFollowUp}</span>}
                                                {note.status && <span className="text-[10px] font-black text-gray-500 bg-white border border-amber-100 rounded-lg px-2 py-1">{note.status}</span>}
                                            </div>
                                            <p className="text-gray-800 font-medium text-sm">{note.text}</p>
                                            <p className="text-xs text-gray-500 mt-3 font-bold flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {note.date} at {note.time}</p>
                                        </div>
                                    ))}
                                    {(client.notes || []).length === 0 && <p className="text-gray-500 font-medium">No notes added yet.</p>}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6"><Activity className="w-5 h-5 text-emerald-500" /> Complete Timeline</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Current Status</p>
                                        <div className="mt-2">{getStatusBadge(client.status)}</div>
                                    </div>
                                    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Next Follow-up</p>
                                        <p className="mt-2 text-sm font-black text-gray-900">{client.nextFollowUp || 'Not Scheduled'}</p>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden p-2">
                                    {(client.timeline || []).map((item, index) => (
                                        <div key={`${item.title}-${index}`} className="flex justify-between items-center p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors rounded-lg">
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
                                                <p className="text-xs font-medium text-gray-500 mt-1">{item.details}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">{item.date} {item.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {(client.timeline || []).length === 0 && <p className="text-center text-gray-400 p-6 text-sm font-medium">No timeline events yet.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeProfileTab === 'Site Visits' && (
                        <div className="animate-in fade-in">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-rose-500" /> Property Site Visits</h3>
                                <Button icon={Calendar} onClick={() => {
                                        const firstProject = schedulableProjects[0];
                                        const defaultOfficer = officerOptions.find((officer) => officer.name === client.officer) || officerOptions[0];
                                        setVisitForm((f) => ({
                                            ...f,
                                            customerName: client.name,
                                            customerPhone: client.phone,
                                            officerId: defaultOfficer?.id || '',
                                            officerName: defaultOfficer?.name || client.officer || officers[0] || '',
                                            officerPhone: defaultOfficer?.phone || client.officerPhone || '',
                                            projectId: firstProject?.id || '',
                                            propertyId: firstProject?.propertyId || firstProject?.property_id || '',
                                            propertyName: firstProject?.name || f.propertyName,
                                            propertyType: firstProject?.specs || firstProject?.property_type || f.propertyType,
                                            propertyConfig: firstProject?.configuration || (Array.isArray(firstProject?.configs) ? firstProject.configs.join(', ') : '') || '',
                                            propertyAddress: firstProject?.location || f.propertyAddress,
                                            propertyPrice: firstProject?.priceRange || firstProject?.price_range || f.propertyPrice,
                                            assignedPropertyId: '',
                                        }));
                                        setIsScheduleVisitOpen(true);
                                    }}>Schedule New Visit</Button>
                            </div>
                            <div className={`grid gap-6 ${selectedSiteVisit ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
                                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden min-w-0">
                                    <Table
                                        headers={['Property', 'Date & Time', 'Officer', 'Status', 'Notes']}
                                        data={clientVisits}
                                        renderRow={(row, index) => (
                                            <tr
                                                key={`${row.id}-${index}`}
                                                onClick={() => setSelectedSiteVisitId(row.id)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault();
                                                        setSelectedSiteVisitId(row.id);
                                                    }
                                                }}
                                                tabIndex={0}
                                                aria-selected={selectedSiteVisitId === row.id}
                                                className={`cursor-pointer transition-colors focus:outline-none focus:bg-[#fbf8ff] ${selectedSiteVisitId === row.id ? 'bg-[#fbf8ff]' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-6 py-4 font-bold text-gray-900">{row.property.name}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-600">{row.date} <span className="text-gray-400 text-xs ml-1">{row.time}</span></td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-800">{row.officerName}</td>
                                                <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                                                <td className="px-6 py-4 text-xs font-medium text-gray-500 max-w-[200px] truncate">{row.notes}</td>
                                            </tr>
                                        )}
                                    />
                                    {clientVisits.length === 0 && <p className="text-center text-gray-500 py-10 font-medium">No site visits found for this client.</p>}
                                </div>

                                {selectedSiteVisit && (
                                    <aside className="rounded-2xl border border-[#d9d2ef] bg-[#fbf8ff] p-5 shadow-sm animate-in slide-in-from-right-4 fade-in duration-200">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-black text-[#151034] leading-tight">
                                                        {selectedSiteVisit.property.name} - {selectedSiteVisit.property.config?.split(' ')[0] || selectedSiteVisit.property.type}
                                                    </h4>
                                                    <span className={`rounded-md px-2.5 py-1 text-xs font-black uppercase ${getVisitBadgeClass(selectedSiteVisit.status)}`}>
                                                        {String(selectedSiteVisit.status).toLowerCase() === 'completed' ? 'HOT' : selectedSiteVisit.status}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-sm font-medium text-gray-600">{selectedSiteVisit.property.address}</p>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                                            <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 font-black text-emerald-600">
                                                <MapPin className="h-4 w-4" />
                                                Scheduled Slot: {selectedSiteVisit.time || 'Not specified'}
                                            </div>
                                        </div>

                                        {/* Completed-only: Arrival time + Review (only rendered when the backend actually provides this data) */}
                                        {String(selectedSiteVisit.status).toLowerCase() === 'completed' && (
                                            <>
                                                {selectedSiteVisit.arrivalTime && (
                                                    <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                                        <Activity className="w-4 h-4 text-blue-500 shrink-0" />
                                                        <p className="text-xs font-black text-blue-700">
                                                            Timing of Reaching: <span className="text-blue-900">{selectedSiteVisit.arrivalTime}</span>
                                                        </p>
                                                    </div>
                                                )}

                                                {selectedSiteVisit.userReview && (
                                                    <div className="mt-3 rounded-xl border border-white bg-white/80 p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Review from Client</p>
                                                            {selectedSiteVisit.userRating && (
                                                                <div className="flex gap-0.5">
                                                                    {Array.from({ length: 5 }, (_, i) => (
                                                                        <span key={i} className={`text-sm ${i < selectedSiteVisit.userRating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-semibold text-gray-700 leading-relaxed">{selectedSiteVisit.userReview}</p>
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                            {[
                                                ['Price', selectedSiteVisit.property.price],
                                                ['Config', selectedSiteVisit.property.config],
                                                ['Type', selectedSiteVisit.property.type],
                                                ['Size', selectedSiteVisit.property.size],
                                                ['Builder', selectedSiteVisit.property.builder],
                                                ['Possession', selectedSiteVisit.property.possession],
                                                ['Total Units', selectedSiteVisit.property.totalUnits],
                                                ['Available', selectedSiteVisit.property.availableUnits],
                                                ['RERA', selectedSiteVisit.property.rera],
                                                ['Officer', selectedSiteVisit.officerName],
                                                ['Visit Date', selectedSiteVisit.date],
                                                ['Purpose', selectedSiteVisit.purpose],
                                            ].filter(([, val]) => val).map(([label, value]) => (
                                                <div key={label} className="rounded-xl border border-white bg-white/80 p-3">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                                    <p className="mt-0.5 font-black text-gray-900 text-xs">{value}</p>
                                                </div>
                                            ))}
                                        </div>

                                        {selectedSiteVisit.property.amenities && (
                                            <div className="mt-2 rounded-xl border border-white bg-white/80 p-3">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Amenities</p>
                                                <p className="mt-0.5 text-xs font-semibold text-gray-700">{selectedSiteVisit.property.amenities}</p>
                                            </div>
                                        )}

                                        <div className="mt-2 rounded-xl border border-white bg-white/80 p-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Visit Notes</p>
                                            <p className="mt-1 text-sm font-semibold text-gray-700">{selectedSiteVisit.notes}</p>
                                        </div>

                                        {String(selectedSiteVisit.status).toLowerCase() === 'completed' && (
                                            <button
                                                type="button"
                                                onClick={() => setPendingVisitDeal(selectedSiteVisit)}
                                                className="mt-4 w-full rounded-lg bg-[#6F4BFF] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#5936eb]"
                                            >
                                                Start Deal
                                            </button>
                                        )}
                                    </aside>
                                )}
                            </div>
                        </div>
                    )}

                    {activeProfileTab === 'Meetings' && (
                        <div className="animate-in fade-in">
                            <div className="flex flex-col gap-2 mb-6 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-600" /> Meetings Log
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    <Badge variant="purple">{(client.meetings || []).filter((meeting) => (meeting.status || 'Scheduled') === 'Scheduled').length} Scheduled</Badge>
                                    <Badge variant="green">{(client.meetings || []).filter((meeting) => meeting.status === 'Completed').length} Completed</Badge>
                                </div>
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-fit">
                                    <div className="flex items-center justify-between mb-5">
                                        <div>
                                            <h4 className="font-black text-gray-900">{editingMeetingIndex === null ? 'Schedule Meeting' : 'Edit Meeting'}</h4>
                                            <p className="text-xs font-semibold text-gray-500 mt-1">Date and time are required.</p>
                                        </div>
                                        {editingMeetingIndex !== null && (
                                            <button onClick={handleCancelMeetingEdit} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-700">Meeting Date</label>
                                                <input type="date" value={meetingForm.date} onChange={(event) => setMeetingForm({ ...meetingForm, date: event.target.value })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-700">Meeting Time</label>
                                                <input type="time" value={meetingForm.time} onChange={(event) => setMeetingForm({ ...meetingForm, time: event.target.value })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-700">Meeting Type</label>
                                                <select value={meetingForm.mode} onChange={(event) => setMeetingForm({ ...meetingForm, mode: event.target.value })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white">
                                                    <option>Office Meeting</option>
                                                    <option>Site Meeting</option>
                                                    <option>Video Call</option>
                                                    <option>Phone Call</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-700">Status</label>
                                                <select value={meetingForm.status} onChange={(event) => setMeetingForm({ ...meetingForm, status: event.target.value })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white">
                                                    <option>Scheduled</option>
                                                    <option>Completed</option>
                                                    <option>Cancelled</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-700">Location</label>
                                            <input value={meetingForm.location} onChange={(event) => setMeetingForm({ ...meetingForm, location: event.target.value })} placeholder="Sales office, site address, or video link" className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white" />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-700">Agenda</label>
                                            <input value={meetingForm.agenda} onChange={(event) => setMeetingForm({ ...meetingForm, agenda: event.target.value })} placeholder="Pricing discussion, documents, site feedback..." className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white" />
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-gray-700">Meeting Remarks</label>
                                            <textarea rows="4" value={meetingForm.remarks} onChange={(event) => setMeetingForm({ ...meetingForm, remarks: event.target.value })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 bg-white"></textarea>
                                        </div>

                                        <Button onClick={handleSaveMeeting} disabled={!meetingForm.date || !meetingForm.time || meetingSaving} className="w-full bg-[#6F4BFF] hover:bg-[#5936eb] text-white disabled:opacity-50 disabled:cursor-not-allowed">
                                            {meetingSaving ? 'Saving...' : editingMeetingIndex === null ? 'Save Meeting' : 'Update Meeting'}
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3 min-w-0">
                                    {(client.meetings || []).map((meeting, index) => {
                                        const status = meeting.status || 'Scheduled';
                                        return (
                                            <div key={meeting.id || `${meeting.date}-${meeting.time}-${index}`} className="bg-white p-5 border border-gray-200 rounded-xl shadow-sm">
                                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="font-black text-gray-900 text-lg flex items-center gap-2">
                                                                <Calendar className="w-4 h-4 text-gray-400" /> {meeting.date}
                                                                <span className="text-gray-400 text-sm font-bold">{meeting.time}</span>
                                                            </p>
                                                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${getMeetingStatusClass(status)}`}>
                                                                {status}
                                                            </span>
                                                        </div>
                                                        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                                                            <p className="font-semibold text-gray-700"><span className="text-gray-400 font-black uppercase text-[10px] block">Type</span>{meeting.mode || 'Office Meeting'}</p>
                                                            <p className="font-semibold text-gray-700"><span className="text-gray-400 font-black uppercase text-[10px] block">Location</span>{meeting.location || 'Sales office'}</p>
                                                            <p className="font-semibold text-gray-700 sm:col-span-2"><span className="text-gray-400 font-black uppercase text-[10px] block">Agenda</span>{meeting.agenda || 'Client discussion'}</p>
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-3 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">{meeting.remarks || 'No remarks added.'}</p>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                                        {status !== 'Completed' && (
                                                            <button onClick={() => handleMeetingStatusChange(meeting, index, 'Completed')} className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                                            </button>
                                                        )}
                                                        {status !== 'Cancelled' && (
                                                            <button onClick={() => handleMeetingStatusChange(meeting, index, 'Cancelled')} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-black text-gray-600 hover:bg-gray-100">
                                                                <X className="w-3.5 h-3.5" /> Cancel
                                                            </button>
                                                        )}
                                                        <button onClick={() => handleEditMeeting(meeting, index)} className="rounded-lg border border-[#6F4BFF]/20 bg-[#6F4BFF]/5 px-3 py-2 text-xs font-black text-[#6F4BFF] hover:bg-[#6F4BFF]/10">
                                                            Edit
                                                        </button>
                                                        <button onClick={() => handleDeleteMeeting(meeting, index)} className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 hover:bg-rose-100">
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(client.meetings || []).length === 0 && (
                                        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
                                            <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                                            <p className="text-gray-500 font-bold">No meetings scheduled.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={Boolean(projectDetails)} onClose={() => setProjectDetails(null)} title={projectDetails ? `${projectDetails.name} - Full Project Details` : 'Project Details'} size="xl">
                {projectDetails && (
                    <div className="space-y-6">
                        {/* Property Image Gallery */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2 relative h-52 rounded-2xl overflow-hidden border border-[#E1DDF0]">
                                <img 
                                    src={propertyHeroImage} 
                                    alt={projectDetails.name} 
                                    className="w-full h-full object-cover" 
                                />
                                <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 backdrop-blur-xs px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                                    Referred Property Hero View
                                </div>
                            </div>
                            <div className="grid grid-rows-2 gap-3">
                                <div className="relative h-[100px] rounded-xl overflow-hidden border border-[#E1DDF0]">
                                    <img 
                                        src={propertyHeroImage} 
                                        alt="Interior View" 
                                        className="w-full h-full object-cover brightness-95" 
                                    />
                                    <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[8px] font-bold text-white">
                                        Layout Plan
                                    </div>
                                </div>
                                <div className="relative h-[100px] rounded-xl overflow-hidden border border-[#E1DDF0]">
                                    <img 
                                        src={propertyHeroImage} 
                                        alt="Elevation View" 
                                        className="w-full h-full object-cover brightness-90" 
                                    />
                                    <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[8px] font-bold text-white">
                                        Elevation View
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                            <div className="rounded-2xl border border-gray-100 bg-linear-to-br from-[#6F4BFF]/10 to-white p-6">
                                <div className="flex items-start gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-[#6F4BFF] text-white flex items-center justify-center shadow-lg shadow-[#6F4BFF]/20">
                                        <Building2 className="h-7 w-7" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">{projectDetails.name}</h3>
                                            {getStatusBadge(projectDetails.status)}
                                        </div>
                                        <p className="mt-2 text-sm font-bold text-gray-600 flex items-center gap-1.5">
                                            <MapPin className="h-4 w-4 text-rose-500" /> {projectDetails.location}
                                        </p>
                                        <p className="mt-3 text-sm font-semibold text-gray-600">
                                            Premium project by <span className="text-[#6F4BFF] font-black">{projectDetails.builder}</span> with {projectDetails.units} total units and {projectDetails.available} currently available.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    ['Price Range', projectDetails.priceRange],
                                    ['Specifications', projectDetails.specs],
                                    ['Progress', `${projectDetails.progress}%`],
                                    ['Updated', projectDetails.updated],
                                ].map(([label, value]) => (
                                    <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
                                        <p className="mt-2 text-sm font-black text-gray-900">{value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Builder & Operations</p>
                                <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                                    <p>Builder: <span className="text-gray-950">{projectDetails.builder}</span></p>
                                    <p>Inventory Officer: <span className="text-gray-950">{projectDetails.officer}</span></p>
                                    <p>Documents: <span className="text-gray-950">{projectDetails.docs} files in vault</span></p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sales Snapshot</p>
                                <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                                    <p>Total Units: <span className="text-gray-950">{projectDetails.units}</span></p>
                                    <p>Available Units: <span className="text-emerald-600">{projectDetails.available}</span></p>
                                    <p>Sold Out: <span className="text-gray-950">{Math.round(((projectDetails.units - projectDetails.available) / projectDetails.units) * 100)}%</span></p>
                                </div>
                            </div>
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Approval Summary</p>
                                <div className="mt-3 space-y-2 text-sm font-bold text-gray-700">
                                    <p>Status: <span className="text-gray-950">{projectDetails.status}</span></p>
                                    <p>Possession: <span className="text-gray-950">{projectDetails.possession}</span></p>
                                    <p>RERA: <span className="text-gray-950">{projectDetails.rera}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
                            <div className="border-b border-gray-100 p-5">
                                <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-[#6F4BFF]" /> Configuration, Pricing & Unit Plan
                                </h4>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            {['Configuration', 'Area', 'Base Price', 'Available', 'Sample Units'].map((header) => (
                                                <th key={header} className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{header}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {buildInventoryWithUnits(projectDetails).map((config) => (
                                            <tr key={config.type}>
                                                <td className="px-5 py-4 text-sm font-black text-gray-900">{config.type}</td>
                                                <td className="px-5 py-4 text-sm font-bold text-gray-600">{config.size}</td>
                                                <td className="px-5 py-4 text-sm font-black text-gray-900">{config.basePrice}</td>
                                                <td className="px-5 py-4 text-sm font-bold text-emerald-600">{config.availableUnits} / {config.totalUnits}</td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {config.unitsList.slice(0, 8).map((unit) => (
                                                            <span key={unit.id} className={`rounded-md border px-2 py-1 text-[10px] font-black ${unit.status === 'Available' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-rose-100 bg-rose-50 text-rose-400'}`}>
                                                                {unit.number}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-5">
                            <h4 className="text-sm font-black uppercase tracking-widest text-gray-900 flex items-center gap-2 mb-4">
                                <FileText className="h-4 w-4 text-[#6F4BFF]" /> Document Vault
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(projectDetails.documents || []).map((doc, index) => (
                                    <div key={`${doc.title}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                        <p className="text-sm font-black text-gray-900">{doc.title}</p>
                                        <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{doc.status} - Updated {doc.updatedAt}</p>
                                    </div>
                                ))}
                                {(projectDetails.documents || []).length === 0 && (
                                    <p className="col-span-full text-center text-xs font-bold text-gray-400 py-4">No documents uploaded for this project yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={pendingDealIndex !== null} onClose={closeDealDialog} title="Start Deal">
                <div className="space-y-5">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-sm font-bold text-gray-900">{pendingDealProject?.name}</p>
                        <p className="text-xs font-medium text-gray-500 mt-1">{pendingDealProject?.location}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Confirmed deal amount (₹)</label>
                        <input autoFocus type="number" min="1" value={dealAmount} onChange={(event) => setDealAmount(event.target.value)} placeholder="Enter agreed amount" className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:border-[#6F4BFF] focus:ring-2 focus:ring-[#6F4BFF]/20" />
                    </div>
                    {dealError ? <p className="text-sm font-semibold text-rose-600">{dealError}</p> : null}
                    <p className="text-xs font-medium text-gray-500">A payment schedule will be created with a Booking Amount milestone. You can edit the complete schedule in Deal Management.</p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="secondary" disabled={dealSubmitting} onClick={closeDealDialog}>Cancel</Button>
                        <Button disabled={dealSubmitting} onClick={handleConfirmContinueToDeal}>{dealSubmitting ? 'Starting…' : 'Start Deal'}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={pendingVisitDeal !== null} onClose={closeDealDialog} title="Start Deal">
                <div className="space-y-5">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-sm font-bold text-gray-900">{pendingVisitDeal?.property?.name}</p>
                        <p className="text-xs font-medium text-gray-500 mt-1">{pendingVisitDeal?.property?.address}</p>
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500">Confirmed deal amount (₹)</label>
                        <input autoFocus type="number" min="1" value={dealAmount} onChange={(event) => setDealAmount(event.target.value)} placeholder="Enter agreed amount" className="mt-2 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-bold outline-none focus:border-[#6F4BFF] focus:ring-2 focus:ring-[#6F4BFF]/20" />
                    </div>
                    {dealError ? <p className="text-sm font-semibold text-rose-600">{dealError}</p> : null}
                    <p className="text-xs font-medium text-gray-500">This starts the shared deal record and opens it in Deal Management for schedule, documents, and stage updates.</p>
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <Button variant="secondary" disabled={dealSubmitting} onClick={closeDealDialog}>Cancel</Button>
                        <Button disabled={dealSubmitting} onClick={handleConfirmVisitDeal}>{dealSubmitting ? 'Starting…' : 'Start Deal'}</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isScheduleVisitOpen} onClose={() => setIsScheduleVisitOpen(false)} title="Schedule New Visit" size="lg">
                <form onSubmit={async (event) => {
                    event.preventDefault();
                    try {
                        await onScheduleVisit({
                            officerId: visitForm.officerId,
                            officerName: visitForm.officerName.trim(),
                            officerPhone: visitForm.officerPhone.trim(),
                            customerName: visitForm.customerName.trim(),
                            customerPhone: visitForm.customerPhone.trim(),
                            purpose: visitForm.purpose,
                            date: visitForm.date,
                            time: `${visitForm.startTime} - ${visitForm.endTime}`,
                            status: 'Scheduled',
                            propertyId: visitForm.propertyId,
                            projectId: visitForm.projectId,
                            assignedPropertyId: visitForm.assignedPropertyId,
                            property: {
                                name: visitForm.propertyName.trim(),
                                type: visitForm.propertyType,
                                config: visitForm.propertyConfig.trim(),
                                address: visitForm.propertyAddress.trim(),
                                price: visitForm.propertyPrice.trim(),
                            },
                            notes: visitForm.notes.trim(),
                        });
                        setIsScheduleVisitOpen(false);
                    } catch (error) {
                        console.error('Failed to schedule client hub visit:', error);
                    }
                }} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</label>
                            <input required value={visitForm.customerName} onChange={(e) => setVisitForm((f) => ({ ...f, customerName: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-gray-50" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Phone</label>
                            <input required value={visitForm.customerPhone} onChange={(e) => setVisitForm((f) => ({ ...f, customerPhone: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Officer Name</label>
                            <select required value={visitForm.officerId} onChange={(e) => {
                                const officer = filteredOfficerOptions.find((item) => item.id === e.target.value);
                                setVisitForm((f) => ({
                                    ...f,
                                    officerId: officer?.id || '',
                                    officerName: officer?.name || '',
                                    officerPhone: officer?.phone || '',
                                }));
                            }} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option value="">Select available officer</option>
                                {filteredOfficerOptions.map((officer) => <option key={officer.id} value={officer.id}>{officer.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Officer Phone</label>
                            <input value={visitForm.officerPhone} onChange={(e) => setVisitForm((f) => ({ ...f, officerPhone: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Purpose</label>
                            <select value={visitForm.purpose} onChange={(e) => setVisitForm((f) => ({ ...f, purpose: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option>BUY</option><option>RENT</option><option>SELL</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</label>
                            <input required type="date" value={visitForm.date} onChange={(e) => setVisitForm((f) => ({ ...f, date: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Time</label>
                            <input required type="time" value={visitForm.startTime} onChange={(e) => setVisitForm((f) => ({ ...f, startTime: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Time</label>
                            <input required type="time" value={visitForm.endTime} onChange={(e) => setVisitForm((f) => ({ ...f, endTime: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    {visitForm.officerId && visitForm.date && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 text-xs text-amber-800">
                            <span className="font-bold block mb-1">
                                ⚠️ Booked slots for {visitForm.officerName || 'Selected Officer'} on {new Date(visitForm.date).toLocaleDateString('en-IN')}:
                            </span>
                            {officerBookedSlots.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-1.5">
                                    {officerBookedSlots.map((b) => (
                                        <span key={b.id} className="bg-amber-100 border border-amber-300 rounded px-2.5 py-1 font-bold text-amber-900">
                                            {b.slot}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <span className="text-emerald-700 font-medium">No bookings yet - officer is fully available.</span>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Name</label>
                            <select required value={visitForm.projectId || ''} onChange={(e) => setVisitForm((f) => {
                                const project = projects.find((item) => item.id === e.target.value);
                                return {
                                    ...f,
                                    projectId: project?.id || '',
                                    propertyId: project?.propertyId || project?.property_id || '',
                                    propertyName: project?.name || '',
                                    propertyType: project?.specs || project?.property_type || f.propertyType,
                                    propertyConfig: project?.configuration || (Array.isArray(project?.configs) ? project.configs.join(', ') : '') || '',
                                    propertyAddress: project?.location || f.propertyAddress,
                                    propertyPrice: project?.priceRange || project?.price_range || f.propertyPrice,
                                };
                            })} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option value="">Select property</option>
                                {schedulableProjects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                        {project.name}
                                    </option>
                                ))}
                            </select>
                            {projects.length > 0 && schedulableProjects.length === 0 && (
                                <p className="mt-2 text-xs font-semibold text-rose-600">
                                    No schedulable property records found for these projects.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Type</label>
                            <select value={visitForm.propertyType} onChange={(e) => setVisitForm((f) => ({ ...f, propertyType: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option>APARTMENT/FLATS</option><option>VILLA PLOTS</option><option>COMMERCIAL</option><option>PLOT</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Configuration</label>
                            <input value={visitForm.propertyConfig} onChange={(e) => setVisitForm((f) => ({ ...f, propertyConfig: e.target.value }))} placeholder="3BHK Premium" className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Price</label>
                            <input value={visitForm.propertyPrice} onChange={(e) => setVisitForm((f) => ({ ...f, propertyPrice: e.target.value }))} placeholder="1.85 Cr" className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Address</label>
                        <input value={visitForm.propertyAddress} onChange={(e) => setVisitForm((f) => ({ ...f, propertyAddress: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notes</label>
                        <textarea rows="3" value={visitForm.notes} onChange={(e) => setVisitForm((f) => ({ ...f, notes: e.target.value }))} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 text-sm font-medium" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <Button variant="secondary" type="button" onClick={() => setIsScheduleVisitOpen(false)}>Cancel</Button>
                        <Button type="submit" icon={Calendar}>Schedule Visit</Button>
                    </div>
                </form>
            </Modal>

            {isAssignPropertyOpen && (
                <Modal isOpen={isAssignPropertyOpen} onClose={() => setIsAssignPropertyOpen(false)} title="Assign Property" size="md">
                    <form onSubmit={handleAssignPropertySubmit} className="space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-black text-[#6F4BFF] uppercase tracking-wider">Select Project</label>
                            <select
                                required
                                value={assignForm.projectId}
                                onChange={(e) => {
                                    setAssignForm({
                                        projectId: e.target.value,
                                        unitId: '',
                                        targetUnits: '',
                                        notes: ''
                                    });
                                }}
                                className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30"
                            >
                                <option value="">Choose Project...</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {assignForm.projectId && (
                            <div>
                                <label className="mb-2 block text-xs font-black text-[#6F4BFF] uppercase tracking-wider">Select Unit (Optional)</label>
                                <select
                                    value={assignForm.unitId}
                                    onChange={(e) => {
                                        const unitId = e.target.value;
                                        const selectedProject = projects.find(p => p.id === assignForm.projectId);
                                        const projectInventory = selectedProject ? buildInventoryWithUnits(selectedProject) : [];
                                        const availableUnits = projectInventory.reduce((acc, config) => {
                                            const units = config.unitsList?.filter(u => u.status === 'Available') || [];
                                            return [...acc, ...units];
                                        }, []);
                                        const unit = availableUnits.find(u => u.id === unitId);
                                        setAssignForm(prev => ({
                                            ...prev,
                                            unitId,
                                            targetUnits: unit ? unit.number : ''
                                        }));
                                    }}
                                    className="w-full rounded-xl border border-gray-300 bg-white p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30"
                                >
                                    <option value="">Select a specific unit...</option>
                                    {(() => {
                                        const selectedProject = projects.find(p => p.id === assignForm.projectId);
                                        const projectInventory = selectedProject ? buildInventoryWithUnits(selectedProject) : [];
                                        const availableUnits = projectInventory.reduce((acc, config) => {
                                            const units = config.unitsList?.filter(u => u.status === 'Available') || [];
                                            return [...acc, ...units];
                                        }, []);
                                        return availableUnits.map((u) => (
                                            <option key={u.id} value={u.id}>{u.number} ({u.configType} - {u.size})</option>
                                        ));
                                    })()}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700 uppercase tracking-wider">Target Units / Unit Number (Optional)</label>
                            <input
                                type="text"
                                value={assignForm.targetUnits}
                                onChange={(e) => setAssignForm(prev => ({ ...prev, targetUnits: e.target.value }))}
                                placeholder="e.g. UNIT-101"
                                className="w-full rounded-lg border border-gray-300 p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#6F4BFF]/30 font-bold"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-black text-gray-700 uppercase tracking-wider">Notes (Optional)</label>
                            <textarea
                                rows="3"
                                value={assignForm.notes}
                                onChange={(e) => setAssignForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Client preferences or internal remarks..."
                                className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 text-sm font-medium"
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                            <Button variant="secondary" type="button" onClick={() => setIsAssignPropertyOpen(false)}>Cancel</Button>
                            <Button type="submit" icon={Plus}>Assign Property</Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const normalizeLookup = (value) => String(value || '').trim().toLowerCase();

const pickDealValue = (...candidates) => {
    for (const candidate of candidates) {
        const parsed = parseBudgetRange(candidate || '');
        if (parsed.budget_max || parsed.budget_min) {
            return parsed.budget_max || parsed.budget_min;
        }
    }

    return null;
};

const resolveTimeToken = (token, fallbackMeridiem = '') => {
    const match = String(token || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) return null;

    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    const meridiem = (match[3] || fallbackMeridiem || '').toLowerCase();

    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;

    return { hour, minute };
};

const toIndiaOffsetIso = (date, hour, minute) => (
    `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`
);

const buildVisitSlotRange = (date, timeRange) => {
    const [startRaw, endRaw] = String(timeRange || '').split(/\s*-\s*/);
    const endMeridiem = endRaw?.match(/\b(am|pm)\b/i)?.[1] || '';
    const startMeridiem = startRaw?.match(/\b(am|pm)\b/i)?.[1] || endMeridiem;
    const start = resolveTimeToken(startRaw, startMeridiem);
    const end = resolveTimeToken(endRaw, endMeridiem || startMeridiem);

    if (!date || !start) return null;

    const startDate = new Date(toIndiaOffsetIso(date, start.hour, start.minute));
    let endDate = end
        ? new Date(toIndiaOffsetIso(date, end.hour, end.minute))
        : new Date(startDate.getTime() + 60 * 60 * 1000);

    if (endDate <= startDate) {
        endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    return {
        slot_start: startDate.toISOString(),
        slot_end: endDate.toISOString(),
    };
};

const Clients = () => {
    const location = useLocation();
    const [isAddClientOpen, setIsAddClientOpen] = useState(false);
    const [selectedClientId, setSelectedClientId] = useState(location.state?.selectedClientId || null);
    const [clients, setClients] = useState([]);
    const [todayVisitCards, setTodayVisitCards] = useState([]);
    const [officerOptions, setOfficerOptions] = useState([]);
    const [selectedClientDetails, setSelectedClientDetails] = useState(null);
    const [selectedProjects, setSelectedProjects] = useState([]);
    const [selectedVisits, setSelectedVisits] = useState([]);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [pageError, setPageError] = useState('');
    const [activeTab, setActiveTab] = useState('All');
    const [dateFilter, setDateFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [clientForm, setClientForm] = useState(clientFormInitialState);

    useEffect(() => {
        if (!location.state?.selectedClientId) return undefined;
        const timeout = window.setTimeout(() => {
            setSelectedClientId(location.state.selectedClientId);
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [location.state?.selectedClientId]);

    const fetchClientList = useCallback(async () => {
        setIsLoadingClients(true);
        setPageError('');

        try {
            const tabMap = {
                Hot: 'Hot Clients',
                Cold: 'Cold Clients',
                Suspended: 'Suspended Clients',
            };
            const [{ items }, visits, officers] = await Promise.all([
                fetchClientHubClients({
                    search: searchQuery.trim(),
                    tab: tabMap[activeTab] || 'All Clients',
                    follow_up_date: dateFilter,
                    via: sourceFilter,
                    page: 1,
                    limit: 50,
                }),
                fetchTodayVisits(),
                fetchAvailableOfficers(),
            ]);

            setClients(items);
            setTodayVisitCards(visits);
            setOfficerOptions(officers);
            console.info('[ClientsHub] Loaded list dependencies', {
                clientsCount: items.length,
                todayVisitsCount: visits.length,
                availableOfficersCount: officers.length,
                availableOfficers: officers.map((officer) => ({
                    id: officer.id,
                    name: officer.name,
                })),
                filters: {
                    search: searchQuery.trim(),
                    activeTab,
                    dateFilter,
                    sourceFilter,
                },
            });
        } catch (error) {
            console.error('Failed to load client hub:', error);
            setPageError(error.message || 'Failed to load clients hub.');
        } finally {
            setIsLoadingClients(false);
        }
    }, [activeTab, dateFilter, sourceFilter, searchQuery]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            fetchClientList();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [fetchClientList]);

    useEffect(() => {
        if (!officerOptions.length) {
            console.warn('[ClientsHub] No available officers returned from /api/admin/client-hub/officers/available. Registration requires one officer id from that endpoint.');
            return;
        }
        const timeout = window.setTimeout(() => {
            setClientForm((current) => {
                if (current.officer && officerOptions.some((officer) => officer.name === current.officer)) {
                    return current;
                }
                return { ...current, officer: officerOptions[0].name };
            });
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [officerOptions]);

    const selectedSummary = clients.find((client) => client.id === selectedClientId);
    const selectedClient = selectedClientDetails?.id === selectedClientId
        ? selectedClientDetails
        : selectedSummary;

    const refreshSelectedClient = useCallback(async (clientId = selectedClientId) => {
        if (!clientId) return;
        const summary = clients.find((client) => client.id === clientId) || {};
        setIsLoadingProfile(true);
        setPageError('');

        try {
            const bundle = await fetchClientProfileBundle(clientId, summary);
            setSelectedClientDetails(bundle.client);
            setSelectedProjects(bundle.projects);
            setSelectedVisits(bundle.visits);
        } catch (error) {
            console.error('Failed to load client profile:', error);
            setPageError(error.message || 'Failed to load client profile.');
        } finally {
            setIsLoadingProfile(false);
        }
    }, [clients, selectedClientId]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            if (selectedClientId) {
                refreshSelectedClient(selectedClientId);
            } else {
                setSelectedClientDetails(null);
                setSelectedProjects([]);
                setSelectedVisits([]);
            }
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [selectedClientId, refreshSelectedClient]);

    const officers = useMemo(() => (
        officerOptions.map((officer) => officer.name).filter(Boolean)
    ), [officerOptions]);

    const filteredClients = clients;

    const todaysVisits = useMemo(() => (
        todayVisitCards.map((visit) => {
            const matchedClient = clients.find((client) => client.phone && client.phone === visit.phone);
            return {
                ...visit,
                id: matchedClient?.id || visit.id,
                displayCode: matchedClient?.displayCode || visit.displayCode,
            };
        })
    ), [clients, todayVisitCards]);

    const updateClientForm = (field, value) => {
        setClientForm((current) => ({ ...current, [field]: value }));
    };

    const toRequirementPayload = (requirement) => ({
        requirement_type: String(requirement.requirement_type || 'Buy').toLowerCase(),
        property_category: requirement.property_category,
        property_type: requirement.property_type,
        min_area: requirement.min_area,
        max_area: requirement.max_area,
        area_unit: requirement.area_unit,
        customer_name: requirement.customer_name,
        contact_number: requirement.contact_number,
        preferred_locations: requirement.preferred_locations || [],
        budget_min: requirement.budget_min,
        budget_max: requirement.budget_max,
        notes: requirement.notes,
        contact_verified: requirement.contact_verified,
    });

    const handleRegisterClient = async (event) => {
        event.preventDefault();
        const selectedOfficer = officerOptions.find((officer) => officer.name === clientForm.officer);
        console.info('[ClientsHub] Register client submit', {
            selectedOfficerName: clientForm.officer,
            matchedOfficer: selectedOfficer || null,
            availableOfficersCount: officerOptions.length,
            availableOfficers: officerOptions.map((officer) => ({
                id: officer.id,
                name: officer.name,
            })),
            form: {
                name: clientForm.name,
                phone: clientForm.phone,
                budget: clientForm.budget,
                location: clientForm.location,
                propertyType: clientForm.propType,
                bhk: clientForm.bhk,
                status: clientForm.status,
                score: clientForm.score,
                nextFollowUp: clientForm.nextFollowUp,
            },
        });
        if (!selectedOfficer) {
            console.error('[ClientsHub] Registration blocked because no selected officer id was available.', {
                selectedOfficerName: clientForm.officer,
                availableOfficersCount: officerOptions.length,
            });
            setPageError('Select an available officer before registering a client. Check console logs for available-officers response details.');
            return;
        }

        try {
            const budgetRange = parseBudgetRange(clientForm.budget);
            const payload = {
                name: clientForm.name.trim(),
                phone: clientForm.phone.trim(),
                budget_min: budgetRange.budget_min,
                budget_max: budgetRange.budget_max,
                location: clientForm.location.trim(),
                property_type: clientForm.propType,
                configuration: clientForm.bhk,
                assigned_officer_id: selectedOfficer.id,
                status: clientForm.status,
                score: clientForm.score,
                follow_up_date: clientForm.nextFollowUp,
                initial_note: clientForm.latestNote,
            };
            console.info('[ClientsHub] Register client payload', payload);
            const created = await registerClient(payload);
            console.info('[ClientsHub] Register client success', created);

            setClientForm({
                ...clientFormInitialState,
                officer: officerOptions[0]?.name || '',
            });
            setIsAddClientOpen(false);
            await fetchClientList();
            if (created?.id) {
                setSelectedClientId(created.id);
            }
        } catch (error) {
            console.error('Failed to register client:', error);
            setPageError(error.message || 'Failed to register client.');
        }
    };

    const handleUpdateSelectedClient = async (changes) => {
        setSelectedClientDetails((current) => current ? { ...current, ...changes } : current);

        const profilePayload = {};
        if (Object.hasOwn(changes, 'name')) profilePayload.name = changes.name;
        if (Object.hasOwn(changes, 'phone')) profilePayload.phone = changes.phone;
        if (Object.hasOwn(changes, 'status')) profilePayload.pipeline_status = changes.status;

        if (Object.hasOwn(changes, 'officer')) {
            const officer = officerOptions.find((item) => item.name === changes.officer);
            if (!officer) {
                setPageError('Selected officer could not be resolved to an available officer ID.');
                return;
            }
            profilePayload.assigned_officer_id = officer.id;
        }

        if (!Object.keys(profilePayload).length) return;

        try {
            await updateClientProfile(selectedClientId, profilePayload);
            await refreshSelectedClient();
            await fetchClientList();
        } catch (error) {
            console.error('Failed to update client profile:', error);
            setPageError(error.message || 'Failed to update client profile.');
        }
    };

    const handleSaveClientNote = async (note, followUp) => {
        await saveClientNote(selectedClientId, {
            note_type: note.type,
            next_follow_up: followUp.nextFollowUp,
            client_status: followUp.status,
            content: note.text,
        });
        await refreshSelectedClient();
        await fetchClientList();
    };

    const toRequirementUpdatePayload = (requirement) => ({
        id: requirement.id,
        customer_name: requirement.customer_name,
        contact_number: requirement.contact_number,
        requirement_type: String(requirement.requirement_type || 'Buy').toLowerCase(),
        property_category: requirement.property_category,
        property_type: requirement.property_type,
        min_area: requirement.min_area,
        max_area: requirement.max_area,
        area_unit: requirement.area_unit,
        budget_min: requirement.budget_min ? Number(requirement.budget_min) : null,
        budget_max: requirement.budget_max ? Number(requirement.budget_max) : null,
        preferred_locations: requirement.preferred_locations || [],
        notes: requirement.notes,
        contact_verified: requirement.contact_verified,
    });

    const handleSaveRequirement = async (requirement) => {
        if (requirement.id) {
            await updateClientRequirement(selectedClientId, toRequirementUpdatePayload(requirement));
        } else {
            await addClientRequirement(selectedClientId, toRequirementPayload(requirement));
        }
        await refreshSelectedClient();
        await fetchClientList();
    };

    const handleUnassignProperty = async (assignedPropertyId) => {
        if (!assignedPropertyId) return;
        if (!window.confirm('Remove this property assignment? The client will lose access to it and the unit becomes available for reassignment.')) return;

        try {
            await unassignProperty(assignedPropertyId);
            await refreshSelectedClient();
            await fetchClientList();
            setPageError('');
        } catch (error) {
            console.error('Failed to unassign property:', error);
            setPageError(error.message || 'Failed to remove this property assignment.');
        }
    };

    const handleAssignUnits = async (assignments) => {
        try {
            // assignPropertyToClient (assigned_properties table) already writes its
            // own client_property_pipeline + lead_timeline rows server-side (see
            // clientHubController.js), so calling the legacy assignUnitsToClient
            // endpoint here too was pure duplication — it inserted a second,
            // near-identical client_property_pipeline row per assignment and its
            // own error was silently swallowed. Removed rather than patched: there
            // is only one write path now, so the two tables can no longer diverge.
            await Promise.all(assignments.map(async (assignment) => {
                const selectedProject = selectedProjects.find(p => p.id === assignment.projectId);
                const payload = {
                    projectId: assignment.projectId,
                    inventoryUnitId: assignment.key, // unit database ID
                    propertyId: selectedProject?.propertyId || selectedProject?.property_id || null,
                    targetUnits: [assignment.unitNumber],
                    notes: 'Assigned from interactive unit grid.'
                };
                return assignPropertyToClient(selectedClientId, payload);
            }));

            await refreshSelectedClient();
            await fetchClientList();
            setPageError('');
        } catch (error) {
            console.error('Failed to assign units:', error);
            setPageError(error.message || 'Failed to assign units.');
        }
    };

    const handleAssignProperty = async (payload) => {
        try {
            await assignPropertyToClient(selectedClientId, payload);
            await refreshSelectedClient();
            await fetchClientList();
            setPageError('');
        } catch (error) {
            console.error('Failed to assign property:', error);
            setPageError(error.message || 'Failed to assign property.');
        }
    };

    const handleAddMeeting = async (meeting) => {
        await addClientMeeting(selectedClientId, meeting);
        await refreshSelectedClient();
    };

    const handleUpdateMeeting = async (meetingId, meeting) => {
        await updateClientMeeting(meetingId, meeting);
        await refreshSelectedClient();
    };

    const handleDeleteMeetingRemote = async (meetingId) => {
        await deleteClientMeeting(meetingId);
        await refreshSelectedClient();
    };

    const handleScheduleVisit = async (visit) => {
        const officerId = visit.officerId
            || officerOptions.find((item) => normalizeLookup(item.name) === normalizeLookup(visit.officerName || selectedClient?.officer))?.id;
        if (!officerId) {
            const message = 'Select an available officer before scheduling the visit.';
            setPageError(message);
            throw new Error(message);
        }

        const slot = buildVisitSlotRange(visit.date, visit.time);
        if (!slot) {
            const message = 'Use a visit time like "10:00 - 11:00 AM" so the slot can be scheduled.';
            setPageError(message);
            throw new Error(message);
        }

        if (visit.assignedPropertyId) {
            // New flow: book visit linked to assigned property
            await bookVisitForAssignedProperty(visit.assignedPropertyId, {
                officerId,
                slotStart: slot.slot_start,
                slotEnd: slot.slot_end,
                userNote: visit.notes || 'Morning preference',
                officerNote: visit.officerNote || 'Scheduled site visit'
            });
        } else {
            // Fallback legacy flow
            const project = selectedProjects.find((item) => (
                item.propertyId === visit.propertyId
                || item.property_id === visit.propertyId
                || normalizeLookup(item.name) === normalizeLookup(visit.property?.name)
            ));
            const propertyId = visit.propertyId || project?.propertyId || project?.property_id;
            if (!propertyId) {
                const message = 'Select a property with a valid property record before scheduling the visit.';
                setPageError(message);
                throw new Error(message);
            }

            await scheduleClientVisit(selectedClientId, {
                property_id: propertyId,
                officer_id: officerId,
                ...slot,
                note: visit.notes || `Scheduled from Client Hub for ${project?.name || visit.property?.name || 'property visit'}.`,
            });
        }

        await refreshSelectedClient();
        await fetchClientList();
        setPageError('');
    };

    const handleContinueToDeal = async ({ pipelineItem, project, visit, dealValue } = {}) => {
        const propertyId = pipelineItem?.propertyId
            || pipelineItem?.property_id
            || project?.propertyId
            || project?.property_id
            || visit?.propertyId
            || visit?.property_id;

        let assignedPropertyId = pipelineItem?.id
            || pipelineItem?.assignedPropertyId
            || pipelineItem?.assigned_property_id
            || visit?.assignedPropertyId
            || visit?.assigned_property_id;

        if (!assignedPropertyId && (pipelineItem?.projectId || visit)) {
            const assignments = await fetchClientAssignedProperties(selectedClientId);
            const visitPropertyName = normalizeLookup(visit?.property?.name);
            const matchingAssignment = assignments.find((assignment) => (
                (pipelineItem?.projectId
                    ? assignment.projectId === pipelineItem.projectId
                    : normalizeLookup(assignment.projectName) === visitPropertyName
                        || visitPropertyName.startsWith(`${normalizeLookup(assignment.projectName)} -`))
                && (!pipelineItem?.units?.length
                    || pipelineItem.units.some((unit) => assignment.units?.includes(unit)))
            ));
            assignedPropertyId = matchingAssignment?.id;
        }

        if (assignedPropertyId) {
            try {
                await initiateDealForAssignedProperty(assignedPropertyId, {
                    bookingDate: new Date().toISOString().slice(0, 10),
                    dealValue: dealValue,
                    tokenAmount: 0,
                    receivedAmount: 0,
                    pendingAmount: dealValue
                });
                await refreshSelectedClient();
                await fetchClientList();
                setPageError('');
            } catch (error) {
                console.error('Failed to initiate deal for assigned property:', error);
                setPageError(error.message || 'Failed to initiate deal for assigned property.');
                throw error;
            }
        } else {
            if (!propertyId || !dealValue) {
                const message = 'Could not resolve property ID and deal value for this conversion.';
                setPageError(message);
                throw new Error(message);
            }
            try {
                await convertClientToDeal(selectedClientId, {
                    property_id: propertyId,
                    deal_value: dealValue,
                    booking_date: new Date().toISOString().slice(0, 10),
                });
                await refreshSelectedClient();
                await fetchClientList();
                setPageError('');
            } catch (error) {
                console.error('Failed to continue visit to deal:', error);
                setPageError(error.message || 'Failed to continue visit to deal.');
                throw error;
            }
        }
    };

    if (selectedClient) {
        return (
            <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
                <Header title="Clients Hub" showBack onBack={() => setSelectedClientId(null)} />
                <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                    {pageError && (
                        <Card className="mb-4 border-l-4 border-l-rose-500 bg-rose-50">
                            <p className="text-sm font-bold text-rose-700">{pageError}</p>
                        </Card>
                    )}
                    <ClientProfileView
                        key={selectedClient.id}
                        client={selectedClient}
                        projects={selectedProjects}
                        visits={selectedVisits}
                        officers={officers}
                        officerOptions={officerOptions}
                        onBack={() => setSelectedClientId(null)}
                        onUpdateClient={handleUpdateSelectedClient}
                        onAddNote={handleSaveClientNote}
                        onAddMeeting={handleAddMeeting}
                        onUpdateMeeting={handleUpdateMeeting}
                        onDeleteMeeting={handleDeleteMeetingRemote}
                        onContinueToDeal={handleContinueToDeal}
                        onScheduleVisit={handleScheduleVisit}
                        onSaveRequirement={handleSaveRequirement}
                        onAssignUnits={handleAssignUnits}
                        onAssignProperty={handleAssignProperty}
                    />
                    {isLoadingProfile && (
                        <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-gray-400">Refreshing client data...</p>
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="Clients Hub" />

            <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                <div className="max-w-[1600px] mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    {pageError && (
                        <Card className="border-l-4 border-l-rose-500 bg-rose-50">
                            <p className="text-sm font-bold text-rose-700">{pageError}</p>
                        </Card>
                    )}
                    {todaysVisits.length > 0 && (
                        <Card className="border-l-4 border-l-emerald-500 bg-linear-to-r from-emerald-50 to-white">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600"><MapPin className="w-5 h-5" /></div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Today's Site Visits</h3>
                                    <p className="text-xs font-bold text-gray-500 uppercase">Clients scheduled for viewing today</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {todaysVisits.map((visit) => (
                                    <div key={visit.id} onClick={() => setSelectedClientId(visit.id)} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors flex items-center gap-2">{visit.name} <Badge variant="green">{visit.displayCode}</Badge></h4>
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1 mt-1"><PhoneCall className="w-3 h-3 text-gray-400" /> {visit.phone}</p>
                                                    {visit.time && (
                                                        <p className="text-xs font-bold text-[#6F4BFF] flex items-center gap-1 mt-1"><Clock className="w-3 h-3 text-[#6F4BFF]" /> {visit.time}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                                <ArrowUpRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-gray-50 text-xs font-medium text-gray-600 line-clamp-2">
                                            <span className="font-bold text-gray-800">Note:</span> {visit.latestNote}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    <Card noPadding>
                        <div className="p-6 border-b border-gray-100 bg-white space-y-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
                                <div>
                                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Active Clients Hub</h2>
                                    <p className="text-sm font-medium text-gray-500 mt-1">Manage pipeline and track follow-ups for your assigned clients.</p>
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <div className="relative">
                                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full sm:w-72 pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-[#6F4BFF]/30" placeholder="Search clients..." />
                                    </div>
                                    <Button icon={Plus} onClick={() => setIsAddClientOpen(true)} className="shadow-md shadow-[#6F4BFF]/20">Register New Client</Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Row 1 — Score tabs + Date filter */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/80 px-2.5 py-2.5 rounded-xl border border-gray-200">
                                    <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                                        {['All', 'Hot', 'Cold', 'Suspended'].map((tab) => {
                                            const selected = activeTab === tab;
                                            const activeClass = tab === 'Hot' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 border-transparent' :
                                                tab === 'Cold' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30 border-transparent' :
                                                    tab === 'Suspended' ? 'bg-gray-800 text-white shadow-md shadow-gray-800/30 border-transparent' :
                                                        'bg-[#6F4BFF] text-white shadow-md shadow-[#6F4BFF]/30 border-transparent';
                                            return (
                                                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${selected ? activeClass : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                                                    {tab === 'Hot' && selected && <Zap className="w-4 h-4 inline mr-1.5" />}
                                                    {tab} Clients
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm self-start sm:self-auto shrink-0">
                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Follow-up:</span>
                                        <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="border-none bg-transparent text-sm font-bold text-gray-800 outline-none cursor-pointer" />
                                        {dateFilter && (
                                            <button onClick={() => setDateFilter('')} className="p-0.5 hover:bg-rose-50 rounded text-rose-400 transition-colors">
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Row 2 — Source filter chips */}
                                <div className="flex flex-wrap items-center gap-2 px-1">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1 mr-1">
                                        <User className="w-3 h-3" /> Via:
                                    </span>
                                    {[
                                        { label: 'All', color: 'bg-gray-800 text-white border-transparent shadow-gray-800/20' },
                                        { label: 'Broker', color: 'bg-amber-500 text-white border-transparent shadow-amber-500/20' },
                                        { label: 'User', color: 'bg-gray-500 text-white border-transparent shadow-gray-500/20' },
                                        { label: 'Sales Officer', color: 'bg-[#6F4BFF] text-white border-transparent shadow-[#6F4BFF]/20' },
                                        { label: 'Meta Ads', color: 'bg-blue-500 text-white border-transparent shadow-blue-500/20' },
                                        { label: 'Website', color: 'bg-emerald-500 text-white border-transparent shadow-emerald-500/20' },
                                    ].map(({ label, color }) => (
                                        <button
                                            key={label}
                                            onClick={() => setSourceFilter(label)}
                                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shadow-sm ${
                                                sourceFilter === label
                                                    ? `${color} shadow-md scale-105`
                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                                            }`}
                                        >
                                            {label === 'Broker' ? 'Added by Broker' : label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto min-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white border-b border-gray-100">
                                        {['CLIENT NO. & INFO', 'REQUIREMENT', 'CURRENT STATUS & NOTES', 'NEXT FOLLOW-UP', 'ACTION'].map((header) => (
                                            <th key={header} className={`px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest ${header === 'ACTION' ? 'text-center' : ''}`}>{header}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredClients.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-16 text-center">
                                                <Search className="w-12 h-12 text-gray-200 mb-3 mx-auto" />
                                                <p className="text-gray-500 font-bold text-lg">{isLoadingClients ? 'Loading clients...' : 'No clients found'}</p>
                                                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or date selection.</p>
                                            </td>
                                        </tr>
                                    ) : filteredClients.map((row) => (
                                        <tr key={row.id} onClick={() => setSelectedClientId(row.id)} className="hover:bg-[#6F4BFF]/5 transition-colors cursor-pointer group bg-white">
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 border border-gray-200 shrink-0">{row.name.charAt(0)}</div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-gray-900 text-base group-hover:text-[#6F4BFF] transition-colors">{row.name}</span>
                                                            <Badge variant="gray" className="text-[10px]">{row.displayCode}</Badge>
                                                            {row.score === 'Hot' && <Badge variant="red" className="shadow-sm">Hot</Badge>}
                                                            {row.score === 'Cold' && <Badge variant="blue" className="shadow-sm">Cold</Badge>}
                                                        </div>
                                                        <div className="text-xs font-medium text-gray-500 flex items-center gap-1.5"><PhoneCall className="w-3 h-3" /> {row.phone}</div>
                                                        {row.source && (
                                                            <div className="mt-1.5">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide ${
                                                                    row.source === 'Broker' ? 'bg-amber-50 text-amber-600' :
                                                                    row.source === 'Meta Ads' ? 'bg-blue-50 text-blue-600' :
                                                                    row.source === 'Website' ? 'bg-emerald-50 text-emerald-600' :
                                                                    row.source === 'Sales Officer' ? 'bg-purple-50 text-purple-600' :
                                                                    'bg-gray-100 text-gray-500'
                                                                }`}>
                                                                    <span className="w-1.5 h-1.5 rounded-full inline-block bg-current opacity-70" />
                                                                    {row.source}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <p className="text-sm font-bold text-gray-800">{row.budget}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{row.propType}</p>
                                            </td>
                                            <td className="px-6 py-5 max-w-xs">
                                                <div className="mb-2">{getStatusBadge(row.status)}</div>
                                                <p className="text-xs font-medium text-gray-600 line-clamp-2" title={row.latestNote}>
                                                    <span className="font-bold text-gray-800">Latest Note:</span> {row.latestNote || 'No recent notes.'}
                                                </p>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                    <Calendar className="w-4 h-4 text-[#6F4BFF]" />
                                                    {row.nextFollowUp || 'Not Scheduled'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <button className="w-8 h-8 rounded-lg bg-gray-100 text-gray-500 inline-flex items-center justify-center group-hover:bg-[#6F4BFF] group-hover:text-white transition-all shadow-sm">
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            </main>

            <Modal isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} title="Register New Client">
                <form onSubmit={handleRegisterClient} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Client Name</label>
                            <input required value={clientForm.name} onChange={(event) => updateClientForm('name', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</label>
                            <input required value={clientForm.phone} onChange={(event) => updateClientForm('phone', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Budget</label>
                            <input required value={clientForm.budget} onChange={(event) => updateClientForm('budget', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" placeholder="1 Cr - 2 Cr" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Location</label>
                            <input value={clientForm.location} onChange={(event) => updateClientForm('location', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Source (Client aaya kahan se?)</label>
                        <select value={clientForm.source} onChange={(event) => updateClientForm('source', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                            <option value="">-- Select Source --</option>
                            <option value="Broker">Broker</option>
                            <option value="User">User</option>
                            <option value="Sales Officer">Sales Officer</option>
                            <option value="Meta Ads">Meta Ads</option>
                            <option value="Website">Website</option>
                        </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Property Type</label>
                            <select value={clientForm.propType} onChange={(event) => updateClientForm('propType', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option>APARTMENT/FLATS</option>
                                <option>VILLA PLOTS</option>
                                <option>COMMERCIAL</option>
                                <option>PLOT</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">BHK</label>
                            <input value={clientForm.bhk} onChange={(event) => updateClientForm('bhk', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Officer</label>
                            <select value={clientForm.officer} onChange={(event) => updateClientForm('officer', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                {officers.map((officer) => <option key={officer}>{officer}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                            <select value={clientForm.status} onChange={(event) => updateClientForm('status', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option>Active</option>
                                <option>Negotiating</option>
                                <option>Pending</option>
                                <option>Suspended</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Score</label>
                            <select value={clientForm.score} onChange={(event) => updateClientForm('score', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold bg-white">
                                <option>Hot</option>
                                <option>Warm</option>
                                <option>Cold</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Follow-up</label>
                            <input type="date" value={clientForm.nextFollowUp} onChange={(event) => updateClientForm('nextFollowUp', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 font-bold" />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Initial Note</label>
                        <textarea rows="3" value={clientForm.latestNote} onChange={(event) => updateClientForm('latestNote', event.target.value)} className="w-full mt-2 border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#6F4BFF]/50 text-sm font-medium" />
                    </div>
                    <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                        <Button variant="secondary" onClick={() => setIsAddClientOpen(false)}>Cancel</Button>
                        <Button type="submit" icon={UserCheck}>Create Client</Button>
                    </div>
                </form>
            </Modal>

        </div>
    );
};

export default Clients;
