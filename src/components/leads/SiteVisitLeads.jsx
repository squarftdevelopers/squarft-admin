import { useEffect, useState } from 'react';
import { fetchVisits } from '../../services/visitManagementService';

const dateTime = value => value ? new Date(value).toLocaleString('en-IN', {timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
export default function SiteVisitLeads() {
    const [items,setItems]=useState([]);
    const [page,setPage]=useState(1);
    const [pagination,setPagination]=useState({});
    const [status,setStatus]=useState('');
    const [search,setSearch]=useState('');
    const [error,setError]=useState('');
    const [loading,setLoading]=useState(true);
    const [refresh,setRefresh]=useState(0);
    useEffect(()=>{
        let active=true, sequence=0;
        const load=async()=>{
            const request=++sequence;
            try {
                const result=await fetchVisits({page,pageSize:20,status,search});
                if(active && request===sequence){setItems(result.items);setPagination(result.pagination || {});setError('');}
            } catch(e){if(active && request===sequence)setError(e.message || 'Unable to load visits');}
            finally{if(active && request===sequence)setLoading(false);}
        };
        setLoading(true);
        const initial=setTimeout(load,250);
        const update=()=>{if(!document.hidden)load();};
        const timer=setInterval(update,15000);
        window.addEventListener('focus',update);
        return ()=>{active=false;clearTimeout(initial);clearInterval(timer);window.removeEventListener('focus',update);};
    },[page,status,search,refresh]);
    return <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">Site Visits</h2><p className="text-sm text-slate-500">Customer bookings and their latest visit status · {pagination.total ?? 0} matching visits</p></div>
            <button onClick={()=>setRefresh(v=>v+1)} className="text-sm font-semibold text-indigo-600">Refresh</button>
        </div>
        <div className="p-4 flex flex-wrap gap-3">
            <input aria-label="Search site visits" placeholder="Customer, phone, project or visit ID" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-60" />
            <select aria-label="Visit status" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}} className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All visit statuses</option>{['pending','pending_confirmation','confirmed','completed','cancelled','rescheduled'].map(value=><option key={value} value={value}>{value.replaceAll('_',' ')}</option>)}
            </select>
        </div>
        {error && <p role="alert" className="px-5 pb-3 text-red-600">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-slate-500"><tr>{['Customer','Project / Property','Schedule (IST)','Sales Officer','Status / Details'].map(label=><th key={label} className="p-4 font-semibold">{label}</th>)}</tr></thead>
            <tbody>{loading ? <tr><td colSpan={5} className="p-8 text-center">Loading visits…</td></tr> : !items.length ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">{error ? 'Visits could not be loaded.' : 'No visits match these filters.'}</td></tr> : items.map(v=><tr key={v.id} className="border-t border-slate-100 align-top">
                <td className="p-4"><div className="font-semibold">{v.customerName}</div><div>{v.customerPhone || 'Phone unavailable'}</div><div className="text-slate-500 mt-1">{v.visitorsCount} visitors</div></td>
                <td className="p-4"><div className="font-semibold">{v.projectName || v.property.name}</div>{v.projectName && <div>{v.property.name}</div>}<div className="text-slate-500">{[v.property.type,v.property.config].filter(Boolean).join(' · ')}</div><div>{v.property.price}</div><div className="text-slate-500 max-w-xs">{v.property.address}</div></td>
                <td className="p-4"><div>{dateTime(v.slotStart)}</div><div className="text-slate-500">Until {dateTime(v.slotEnd)}</div><div className="mt-1">{v.branchName || 'Branch unavailable'}</div></td>
                <td className="p-4"><div className="font-semibold">{v.officerName}</div><div>{v.officerPhone || '—'}</div><div className="mt-1 text-slate-500">Customer OTP: {v.otpStatus}</div></td>
                <td className="p-4 min-w-64"><span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-1 capitalize">{String(v.apiStatus || 'Unknown').replaceAll('_',' ')}</span>
                    <details className="mt-3"><summary className="cursor-pointer text-indigo-600">View details</summary><dl className="mt-2 space-y-2 text-slate-600">
                        <div><dt className="font-semibold">Visit ID</dt><dd className="break-all">{v.id}</dd></div>
                        {v.notes && <div><dt className="font-semibold">Customer note</dt><dd>{v.notes}</dd></div>}
                        {v.officerNote && <div><dt className="font-semibold">Officer note</dt><dd>{v.officerNote}</dd></div>}
                        {v.cancellationReason && <div><dt className="font-semibold">Cancellation / rejection reason</dt><dd>{v.cancellationReason}</dd></div>}
                        {v.completedAt && <div><dt className="font-semibold">Completed</dt><dd>{dateTime(v.completedAt)}</dd></div>}
                        {v.userReview && <div><dt className="font-semibold">Customer review</dt><dd>{v.userReview}{v.userRating != null ? ` (${v.userRating}/5)` : ''}</dd></div>}
                    </dl></details>
                </td>
            </tr>)}</tbody></table></div>
        <div className="p-4 border-t flex items-center justify-between text-sm"><button disabled={page<=1 || loading} onClick={()=>setPage(p=>p-1)} className="disabled:opacity-40">Previous</button><span>Page {page} of {Math.max(1,Number(pagination.pages)||1)}</span><button disabled={page>=Number(pagination.pages || 1) || loading} onClick={()=>setPage(p=>p+1)} className="disabled:opacity-40">Next</button></div>
    </section>;
}
