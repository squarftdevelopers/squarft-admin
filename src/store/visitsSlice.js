import { createSlice } from '@reduxjs/toolkit';
const initialState = {
  // Visits must always come from the backend. Mock records caused a brief
  // flash of incorrect visits before the API response replaced them.
  visits: [],
  loading: true,
  error: null,
};

const visitsSlice = createSlice({
  name: 'visits',
  initialState,
  reducers: {
    setVisitsLoading: (state, action) => {
      state.loading = Boolean(action.payload);
    },
    setVisits: (state, action) => {
      state.visits = Array.isArray(action.payload) ? action.payload : [];
      state.loading = false;
      state.error = null;
    },
    addVisit: (state, action) => {
      if (action.payload?.id) {
        state.visits.unshift(action.payload);
        return;
      }

      const nextNumber = state.visits.reduce((max, visit) => {
        const visitNumber = Number(String(visit.id).replace(/\D/g, '')) || 0;
        return Math.max(max, visitNumber);
      }, 0) + 1;
      state.visits.unshift({ id: `V${String(nextNumber).padStart(3, '0')}`, ...action.payload });
    },
    updateVisitStatus: (state, action) => {
      const { id, status } = action.payload;
      const visit = state.visits.find(v => v.id === id);
      if (visit) {
        visit.status = status;
      }
    },
    updateVisit: (state, action) => {
      const { id, changes } = action.payload;
      const visit = state.visits.find(v => v.id === id);
      if (visit) {
        Object.assign(visit, changes);
      }
    },
    addVisitNote: (state, action) => {
      const { id, note } = action.payload;
      const visit = state.visits.find(v => v.id === id);
      if (visit) {
        visit.notes = `${visit.notes || ''}\n\n[Updated]: ${note}`.trim();
      }
    },
  },
});

export const { setVisitsLoading, setVisits, addVisit, updateVisitStatus, updateVisit, addVisitNote } = visitsSlice.actions;
export default visitsSlice.reducer;
