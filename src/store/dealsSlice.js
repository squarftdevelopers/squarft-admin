import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  deals: [],
  selectedDeal: null,
  loading: false,
  error: null,
};

const dealsSlice = createSlice({
  name: 'deals',
  initialState,
  reducers: {
    addDeal: (state, action) => {
      const incomingDeal = action.payload;
      if (!incomingDeal?.dealCode) return;

      const alreadyExists = state.deals.some((deal) => (
        deal.dealCode === incomingDeal.dealCode
        || (
          incomingDeal.sourceVisitId
          && deal.sourceVisitId === incomingDeal.sourceVisitId
          && deal.sourcePropertyName === incomingDeal.sourcePropertyName
        )
      ));

      if (alreadyExists) {
        return;
      }

      state.deals.unshift(incomingDeal);
      state.selectedDeal = incomingDeal;
    },
    setDeals: (state, action) => {
      state.deals = action.payload;
      if (state.selectedDeal) {
        state.selectedDeal = action.payload.find((deal) => (
          deal.dealCode === state.selectedDeal.dealCode
          || (deal.id && deal.id === state.selectedDeal.id)
        )) || state.selectedDeal;
      }
    },
    setSelectedDeal: (state, action) => {
      state.selectedDeal = action.payload;
    },
    deleteDeal: (state, action) => {
      state.deals = state.deals.filter(deal => deal.dealCode !== action.payload);
    },
    updateDealStatus: (state, action) => {
      const { dealCode, status } = action.payload;
      const deal = state.deals.find(d => d.dealCode === dealCode);
      if (deal) {
        deal.status = status;
      }
      if (state.selectedDeal?.dealCode === dealCode) {
        state.selectedDeal = { ...state.selectedDeal, status };
      }
    },
    updateDealDetails: (state, action) => {
      const { dealCode, changes } = action.payload;
      const deal = state.deals.find(d => d.dealCode === dealCode);
      if (deal) {
        Object.assign(deal, changes);
      }
      if (state.selectedDeal?.dealCode === dealCode) {
        state.selectedDeal = { ...state.selectedDeal, ...changes };
      }
    },
  },
});

export const { addDeal, setDeals, setSelectedDeal, deleteDeal, updateDealStatus, updateDealDetails } = dealsSlice.actions;
export default dealsSlice.reducer;
