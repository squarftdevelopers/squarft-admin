import SiteVisitLeads from '../../components/leads/SiteVisitLeads';
import { useEffect, useMemo, useState } from 'react';
import {
    Bot,
    ChevronDown,
    Download,
    MessageSquareText,
    MoreVertical,
    Phone,
    PhoneCall,
    RotateCcw,
    ShieldCheck,
    TrendingUp,
    UserRound,
    X,
} from 'lucide-react';
import Header from '../../components/layout/Header';
import ProjectLeadPipeline from '../../components/leads/ProjectLeadPipeline';
import { fetchMasterOptions } from '../../services/commonService';
import {
    addManualSummary,
    exportLeadsCsv,
    fetchLeadSummary,
    fetchLeads,
    markLeadQualified,
} from '../../services/leadService';

// Temperature → display label mapping
const TEMP_DISPLAY = { HOT: 'Hot', WARM: 'Warm', COLD: 'Cold' };

// Derive display-friendly fields from a normalized lead
const toDisplayLead = (lead) => {
    const budgetParts = [
        lead.budgetMin != null ? `₹${Number(lead.budgetMin).toLocaleString('en-IN')}` : null,
        lead.budgetMax != null ? `₹${Number(lead.budgetMax).toLocaleString('en-IN')}` : null,
    ].filter(Boolean);

    const requirement = [lead.configuration, lead.propertyType, lead.category]
        .filter(Boolean)
        .join(' • ');

    const brokerName = lead.broker?.name || (lead.attributionStatus === 'DIRECT' ? 'Direct Attribution' : null) || '';
    const attribution = lead.attributionStatus && lead.attributionStatus !== 'DIRECT' ? lead.attributionStatus : '';

    const callState = lead.aiCallStatus === 'IN_PROGRESS'
        ? 'active'
        : ['FAILED', 'RETRY_SCHEDULED'].includes(lead.manualCallStatus)
            ? 'failed'
            : 'success';

    const callTitle = callState === 'active'
        ? 'AI Call Active'
        : callState === 'failed'
            ? 'Manual Call Failed'
            : 'AI Call Success';

    const callDetail = callState === 'failed'
        ? (lead.manualCallStatus === 'RETRY_SCHEDULED' ? 'Retry Scheduled' : 'Call Failed')
        : lead.manualCallStatus === 'NOT_SCHEDULED'
            ? 'Manual: Not Scheduled'
            : '';

    return {
        ...lead,
        status: TEMP_DISPLAY[lead.temperature] || lead.temperature,
        broker: brokerName,
        attribution,
        requirement: requirement || '-',
        budget: budgetParts.length ? budgetParts.join(' - ') : '-',
        timeline: lead.timelineLabel || '',
        callState,
        callTitle,
        callDetail,
        brokerPhone: lead.broker?.phone || '',
        manualSummary: lead.manualSummaries?.[0]?.summary || lead.manualSummary || '',
        aiSummary: lead.aiSummary || 'No AI summary available.',
        added: lead.createdAt ? `Added ${new Date(lead.createdAt).toLocaleDateString('en-IN')}` : '',
        contactMode: '',
    };
};

const fallbackSourceOptions = ['All Sources', 'Broker', 'User', 'Sales Officer'];
const fallbackStatusOptions = ['Any Status', 'Hot', 'Cold', 'Warm', 'Suspended'];

const mergeFilterOptions = (leadingOption, apiOptions = [], fallbackOptions = []) => {
    const labels = apiOptions.map((option) => option.label || option.value).filter(Boolean);
    return [leadingOption, ...new Set([...labels, ...fallbackOptions.filter((option) => option !== leadingOption)])];
};

const statusStyles = {
    Hot: 'bg-rose-100 text-rose-700',
    Warm: 'bg-orange-100 text-orange-700',
    Cold: 'bg-slate-100 text-slate-700',
    Suspended: 'bg-zinc-200 text-zinc-700',
};

const sourcePillStyles = {
    'Broker App': 'bg-blue-100 text-blue-700',
    'Meta Ads': 'bg-indigo-100 text-indigo-700',
};

const MetricCard = ({ label, value, detail, icon: Icon, tone }) => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm min-h-[112px] flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
            </div>
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon className="h-5 w-5" />
            </div>
        </div>
        <p className="text-xs font-bold text-slate-500">{detail}</p>
    </div>
);

const SelectFilter = ({ label, value, options, onChange }) => (
    <label className="flex items-center gap-2 text-xs font-black text-slate-900">
        {label}:
        <span className="relative">
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-9 text-xs font-black text-slate-950 outline-none transition focus:border-[#4D3BFF] focus:ring-2 focus:ring-[#4D3BFF]/15"
            >
                {options.map((option) => (
                    <option key={option}>{option}</option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        </span>
    </label>
);

const SourceBadge = ({ lead }) => (
    <div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${sourcePillStyles[lead.sourceLabel] || 'bg-slate-100 text-slate-700'}`}>
            <ShieldCheck className="h-3 w-3" />
            {lead.sourceLabel}
        </span>
        <p className={`mt-2 text-[11px] font-black ${lead.attribution ? 'text-[#3630ff]' : 'text-slate-800'}`}>
            {lead.broker}
        </p>
        {lead.attribution && (
            <p className={`mt-1 text-[9px] font-black ${lead.attribution.includes('DISPUTED') ? 'text-red-700 bg-red-50 inline-block px-1' : 'text-emerald-700'}`}>
                {lead.attribution}
            </p>
        )}
    </div>
);

const CallStatus = ({ lead }) => {
    if (lead.callState === 'active') {
        return (
            <div className="flex items-center gap-1 text-[#6D63FF]">
                <PhoneCall className="h-4 w-4" />
                <span className="text-2xl leading-none tracking-widest">_ACTIVE</span>
                <span className="ml-2 text-xs font-black leading-tight">AI Call<br />Active</span>
            </div>
        );
    }

    if (lead.callState === 'failed') {
        return (
            <div>
                <p className="flex items-center gap-1.5 text-sm font-black text-slate-800">
                    <RotateCcw className="h-4 w-4" /> {lead.callTitle}
                </p>
                <p className="mt-2 text-xs font-black text-red-600">{lead.callDetail}</p>
            </div>
        );
    }

    return (
        <div>
            <p className="flex items-center gap-1.5 text-sm font-black text-[#4D3BFF]">
                <Bot className="h-4 w-4" /> {lead.callTitle}
            </p>
            <p className="mt-2 text-xs font-medium text-slate-700">{lead.callDetail}</p>
        </div>
    );
};

const LeadDetailPanel = ({ lead, noteValue, onNoteChange, onAddNote, onClose }) => {
    if (!lead) return null;

    const initials = lead.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
    const isBrokerAppLead = lead.sourceLabel === 'Broker App';

    return (
        <aside className="w-full xl:w-[330px] shrink-0 rounded-lg border border-[#CDCBE5] bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#D9D7EA] bg-[#F9F7FF] px-4 py-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-[#4D3BFF]">Quick View Detail</p>
                <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100">
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="p-5">
                <div className="flex flex-col items-center text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#CFCBFF] bg-[#F0EEFF] text-2xl font-black text-[#4D3BFF]">
                        {initials}
                    </div>
                    <h3 className="mt-4 text-base font-black text-slate-950">{lead.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${statusStyles[lead.status]}`}>
                            {lead.status} Lead
                        </span>
                        <span className="rounded-full bg-[#4D3BFF] px-2.5 py-1 text-[10px] font-black text-white">{lead.id}</span>
                    </div>
                </div>

                <div className="mt-5 rounded-lg border border-[#D8D4F2] bg-[#F1EEFF] p-4">
                    <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#4D3BFF]">
                        <Bot className="h-4 w-4" /> AI Call Summary
                    </p>
                    <p className="mt-3 text-xs font-medium leading-relaxed text-slate-700">{lead.aiSummary}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D9D7EA] bg-white px-3 py-2 text-xs font-black text-slate-800 transition hover:border-[#4D3BFF]/40 hover:text-[#4D3BFF]">
                        <Phone className="h-4 w-4" /> Manual Call
                    </button>
                    <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#4D3BFF] px-3 py-2 text-xs font-black text-white transition hover:bg-[#382BD2]">
                        <Bot className="h-4 w-4" /> AI Call
                    </button>
                </div>

                <div className="mt-5 border-t border-slate-200 pt-4">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-800">Add Manual Summary</p>
                        <button type="button" onClick={onAddNote} className="text-xs font-black text-[#4D3BFF]">Add</button>
                    </div>
                    <textarea
                        rows="4"
                        value={noteValue}
                        onChange={(event) => onNoteChange(event.target.value)}
                        className="w-full resize-none rounded-lg border border-[#D9D7EA] bg-white p-3 text-xs font-medium leading-relaxed text-slate-800 outline-none transition focus:border-[#4D3BFF] focus:ring-2 focus:ring-[#4D3BFF]/15"
                        placeholder="Write manual call summary..."
                    />
                    {lead.manualSummary && (
                        <p className="mt-2 border-l-2 border-[#4D3BFF] pl-3 text-xs italic leading-relaxed text-slate-700">
                            {lead.manualSummary}
                        </p>
                    )}
                </div>

                {isBrokerAppLead && (
                    <div className="mt-5 border-t border-slate-200 pt-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-800">Broker Attribution</p>
                        <div className="rounded-lg border border-[#D9D7EA] bg-white p-4">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Broker</p>
                            <p className="mt-2 text-sm font-black text-slate-950">{lead.broker}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{lead.brokerPhone}</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

const csvColumns = [
    ['Lead ID', 'id'],
    ['Name', 'name'],
    ['Added', 'added'],
    ['Phone', 'phone'],
    ['Contact Mode', 'contactMode'],
    ['Source Type', 'sourceType'],
    ['Source', 'sourceLabel'],
    ['Broker', 'broker'],
    ['Attribution', 'attribution'],
    ['Requirement', 'requirement'],
    ['Budget', 'budget'],
    ['Timeline', 'timeline'],
    ['Status', 'status'],
    ['Score', 'score'],
    ['Call Status', 'callTitle'],
    ['Call Detail', 'callDetail'],
];

const escapeCsvValue = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
};

const Leads = () => {
    const [pipelineView, setPipelineView] = useState('customer');
    const [leads, setLeads] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sourceFilter, setSourceFilter] = useState('All Sources');
    const [statusFilter, setStatusFilter] = useState('Any Status');
    const [selectedLeadId, setSelectedLeadId] = useState(null);
    const [manualSummaryDraft, setManualSummaryDraft] = useState('');
    const [sourceOptions, setSourceOptions] = useState(fallbackSourceOptions);
    const [statusOptions, setStatusOptions] = useState(fallbackStatusOptions);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            try {
                const [optionsRes, leadsRes, summaryRes] = await Promise.allSettled([
                    fetchMasterOptions(['lead_sources', 'lead_temperatures']),
                    fetchLeads({ page: 1, limit: 100 }),
                    fetchLeadSummary(),
                ]);

                if (!isMounted) return;

                if (optionsRes.status === 'fulfilled') {
                    const options = optionsRes.value;
                    setSourceOptions(mergeFilterOptions('All Sources', options?.leadSources, fallbackSourceOptions));
                    setStatusOptions(mergeFilterOptions('Any Status', options?.leadTemperatures, fallbackStatusOptions));
                }

                if (leadsRes.status === 'fulfilled') {
                    setLeads(leadsRes.value.leads.map(toDisplayLead));
                    if (!selectedLeadId && leadsRes.value.leads.length) {
                        setSelectedLeadId(leadsRes.value.leads[0].id);
                    }
                }

                if (summaryRes.status === 'fulfilled') {
                    setSummary(summaryRes.value);
                }
            } catch {
                // fallback to empty state — already set above
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();

        return () => { isMounted = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const visibleLeads = useMemo(() => (
        leads.filter((lead) => {
            const matchesSource = sourceFilter === 'All Sources' || lead.sourceType === sourceFilter;
            const matchesStatus = statusFilter === 'Any Status' || lead.status === statusFilter;
            return matchesSource && matchesStatus;
        })
    ), [leads, sourceFilter, statusFilter]);

    const selectedLead = useMemo(() => (
        leads.find((lead) => lead.id === selectedLeadId) || null
    ), [leads, selectedLeadId]);

    const metrics = useMemo(() => {
        const total = summary?.totalLeads ?? leads.length;
        const brokerSources = summary?.brokerSources ?? leads.filter((l) => l.sourceType === 'BROKER').length;
        const callPending = summary?.callPending ?? 0;
        const conversionRate = summary?.conversionRate ?? 0;
        const avgScore = summary?.averageLeadScore ?? (leads.length ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length) : 0);

        return [
            { label: 'Total leads', value: total, detail: `${summary?.visibleAfterFilters ?? visibleLeads.length} visible after filters`, icon: UserRound, tone: 'bg-blue-50 text-blue-600' },
            { label: 'Broker sources', value: brokerSources, detail: 'Confirmed and disputed broker leads', icon: ShieldCheck, tone: 'bg-emerald-50 text-emerald-600' },
            { label: 'Call pending', value: callPending, detail: 'Manual or retry follow-ups', icon: Phone, tone: 'bg-orange-50 text-orange-600' },
            { label: 'Conversion rate', value: `${conversionRate}%`, detail: 'Qualified leads ratio', icon: TrendingUp, tone: 'bg-violet-50 text-violet-600' },
            { label: 'Average score', value: avgScore, detail: 'Average lead score', icon: MessageSquareText, tone: 'bg-slate-100 text-slate-700' },
        ];
    }, [leads, summary, visibleLeads.length]);

    const handleMarkQualified = async (leadId) => {
        try {
            await markLeadQualified(leadId);
        } catch (error) {
            console.error('Failed to qualify lead:', error);
            return;
        }
        setLeads((current) => current.filter((l) => l.id !== leadId));
        if (selectedLeadId === leadId) {
            setSelectedLeadId(null);
            setManualSummaryDraft('');
        }
    };

    const handleSelectLead = (lead) => {
        setSelectedLeadId(lead.id);
        setManualSummaryDraft('');
    };

    const handleAddManualSummary = async () => {
        const summary = manualSummaryDraft.trim();
        if (!selectedLead || !summary) return;

        try {
            const updated = await addManualSummary(selectedLead.id, summary);
            setLeads((current) =>
                current.map((l) =>
                    l.id === selectedLead.id ? { ...l, ...toDisplayLead(updated) } : l
                )
            );
        } catch (error) {
            console.error('Failed to add summary:', error);
        }
        setManualSummaryDraft('');
    };

    const handleDownloadCsv = async () => {
        try {
            const blob = await exportLeadsCsv({ page: 1, limit: 10000 });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'lead-pipeline.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            // fallback: client-side CSV from visible rows
            const headers = csvColumns.map(([label]) => label);
            const rows = visibleLeads.map((lead) =>
                csvColumns.map(([, key]) => escapeCsvValue(lead[key])).join(',')
            );
            const csv = [headers.map(escapeCsvValue).join(','), ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'lead-pipeline.csv';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full relative bg-[#F5F6FA] font-sans text-gray-900">
            <Header title="Leads Pipeline" />

            <main className="flex-1 overflow-y-auto p-6 md:p-8 scroll-smooth">
                <div className="mx-auto mb-5 flex max-w-[1600px] gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                    <button type="button" onClick={() => setPipelineView('customer')} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${pipelineView === 'customer' ? 'bg-[#4D3BFF] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>Customer Leads</button>
                    <button type="button" onClick={() => setPipelineView('project')} className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-black transition ${pipelineView === 'project' ? 'bg-[#4D3BFF] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>Project Leads</button>
                </div>
                {pipelineView === 'project' ? <div className="mx-auto max-w-[1600px]"><ProjectLeadPipeline /></div> : (
                <div className="mx-auto max-w-[1600px] space-y-5">
                    <SiteVisitLeads />
                    <h2 className="text-lg font-bold text-slate-900">Other Customer Leads</h2>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {metrics.map((metric) => (
                            <MetricCard key={metric.label} {...metric} />
                        ))}
                    </div>

                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                        <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#CDCBE5] bg-white shadow-sm">
                        <div className="flex flex-col gap-4 border-b border-[#D9D7EA] bg-[#F9F7FF] px-4 py-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                                <SelectFilter label="Filter" value={sourceFilter} options={sourceOptions} onChange={setSourceFilter} />
                                <SelectFilter label="Status" value={statusFilter} options={statusOptions} onChange={setStatusFilter} />
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadCsv}
                                className="inline-flex items-center gap-2 text-sm font-black text-[#3630ff] transition hover:text-[#2017c9]"
                            >
                                <Download className="h-4 w-4" />
                                Download CSV
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1040px] border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-[#D9D7EA] bg-[#F3F1FB] text-[12px] font-black uppercase tracking-wider text-[#25243C]">
                                        <th className="px-5 py-4">Lead Info</th>
                                        <th className="px-5 py-4">Contact</th>
                                        <th className="px-5 py-4">Source & Broker</th>
                                        <th className="px-5 py-4">Requirement<br />Summary</th>
                                        <th className="px-5 py-4">Call Status</th>
                                        <th className="px-5 py-4">Action</th>
                                        <th className="w-10 px-3 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E1E0EA]">
                                    {visibleLeads.map((lead) => (
                                        <tr
                                            key={lead.id}
                                            onClick={() => handleSelectLead(lead)}
                                            className={`cursor-pointer bg-white align-middle transition hover:bg-[#FAFAFF] ${selectedLeadId === lead.id ? 'bg-[#FAFAFF]' : ''}`}
                                        >
                                            <td className="px-5 py-4">
                                                <p className="text-base font-black leading-tight text-black">{lead.name.split(' ')[0]}<br />{lead.name.split(' ').slice(1).join(' ')}</p>
                                                <p className="mt-1 text-xs font-medium text-slate-600">{lead.added}</p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                                    <Phone className="h-4 w-4 text-emerald-500" />
                                                    {lead.phone.split(' ').slice(0, 2).join(' ')}<br />
                                                    {lead.phone.split(' ').slice(2).join(' ')}
                                                </p>
                                                {lead.contactMode && (
                                                    <p className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                                                        <MessageSquareText className="h-4 w-4 text-green-500" />
                                                        WhatsApp<br />Active
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                <SourceBadge lead={lead} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-sm font-black text-black">{lead.requirement}</p>
                                                <p className="mt-1 text-sm font-medium text-slate-800">Budget: {lead.budget}</p>
                                                {lead.timeline && <p className="mt-1 text-xs italic text-slate-600">Timeline: {lead.timeline}</p>}
                                            </td>
                                            <td className="px-5 py-4">
                                                <CallStatus lead={lead} />
                                            </td>
                                            <td className="px-5 py-4">
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        handleMarkQualified(lead.id);
                                                    }}
                                                    className="h-10 w-24 rounded-lg bg-[#4C3BEE] text-xs font-black leading-tight text-white shadow-sm shadow-[#4C3BEE]/20 transition hover:bg-[#382BD2]"
                                                >
                                                    Mark<br />Qualified
                                                </button>
                                            </td>
                                            <td className="px-3 py-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100"
                                                >
                                                    <MoreVertical className="h-5 w-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {visibleLeads.length === 0 && (
                            <div className="px-6 py-12 text-center text-sm font-black text-slate-400">
                                {loading ? 'Loading leads...' : 'No leads match the selected filters.'}
                            </div>
                        )}
                        </div>

                        <LeadDetailPanel
                            lead={selectedLead}
                            noteValue={manualSummaryDraft}
                            onNoteChange={setManualSummaryDraft}
                            onAddNote={handleAddManualSummary}
                            onClose={() => setSelectedLeadId(null)}
                        />
                    </div>
                </div>
                )}
            </main>
        </div>
    );
};

export default Leads;
