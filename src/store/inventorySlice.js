import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as inventoryService from '../services/inventoryService';

/**
 * Async thunks for fetching inventory data from the backend
 */
export const getProjects = createAsyncThunk(
  'inventory/getProjects',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await inventoryService.fetchProjects(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getSourceProfiles = createAsyncThunk(
  'inventory/getSourceProfiles',
  async (params = {}, { rejectWithValue }) => {
    try {
      return await inventoryService.fetchSourceProfiles(params);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getProjectById = createAsyncThunk(
  'inventory/getProjectById',
  async (projectId, { rejectWithValue }) => {
    try {
      return await inventoryService.fetchProjectById(projectId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updateProjectFeatured = createAsyncThunk(
  'inventory/updateProjectFeatured',
  async ({ projectId, isFeatured }, { rejectWithValue }) => {
    try {
      return await inventoryService.updateProjectFeatured(projectId, isFeatured);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const getConfigurationUnits = createAsyncThunk(
  'inventory/getConfigurationUnits',
  async ({ projectId, configurationId }, { rejectWithValue }) => {
    try {
      return await inventoryService.fetchConfigurationUnits(projectId, configurationId);
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

const initialState = {
  projects: [],
  filteredProjects: [],
  sourceProfiles: [],
  selectedProject: null,
  selectedBuilder: null,
  selectedBroker: null,
  viewMode: 'projects', // 'projects', 'builderProjects', 'brokerProjects'
  loading: false,
  featuredUpdatingById: {},
  error: null,
  filters: {
    search: '',
    status: 'All',
    propertySource: 'all', // 'all', 'builder', 'broker'
    priceRange: 'all', // 'all', 'under-1cr', '1cr-2cr', '2cr-5cr', '5cr-plus'
    location: 'all', // 'all', or specific city names
    branchId: '',
  },
  pagination: {
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  },
};

const applyLocalFilters = (projects, filters) => {
  const { search, status, propertySource, priceRange, location } = filters;
  
  return projects.filter(project => {
    const projectName = project.name || '';
    const projectBuilder = project.builder || '';
    const projectLocation = project.location || [project.area, project.city].filter(Boolean).join(', ');

    // Search filter (in case frontend wants local refining)
    const matchesSearch = 
      !search ||
      projectName.toLowerCase().includes(search.toLowerCase()) || 
      projectBuilder.toLowerCase().includes(search.toLowerCase()) ||
      projectLocation.toLowerCase().includes(search.toLowerCase());
    
    // Status filter
    const matchesStatus = status === 'All' || project.status === status;
    
    // Property source filter
    const matchesSource = propertySource === 'all' || project.addedBy === propertySource;
    
    // Price range filter
    let matchesPriceRange = true;
    if (priceRange !== 'all') {
      const numericPrice = Number(project.inventoryMinPrice || project.priceFrom || project.minPrice || project.price_from);
      const priceStr = (project.priceRange || '').toLowerCase();
      let minPrice = Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice / 100000 : 0;
      
      // Parse the minimum price
      if (!minPrice && priceStr.includes('cr')) {
        const match = priceStr.match(/(\d+\.?\d*)\s*cr/i);
        if (match) minPrice = parseFloat(match[1]) * 100; // Convert Cr to Lacs
      } else if (!minPrice && (priceStr.includes('l') || priceStr.includes('lacs'))) {
        const match = priceStr.match(/(\d+\.?\d*)\s*(l|lacs?)/i);
        if (match) minPrice = parseFloat(match[1]);
      }
      
      // Apply price range filter
      switch(priceRange) {
        case 'under-1cr':
          matchesPriceRange = minPrice < 100;
          break;
        case '1cr-2cr':
          matchesPriceRange = minPrice >= 100 && minPrice < 200;
          break;
        case '2cr-5cr':
          matchesPriceRange = minPrice >= 200 && minPrice < 500;
          break;
        case '5cr-plus':
          matchesPriceRange = minPrice >= 500;
          break;
      }
    }
    
    // Location filter
    let matchesLocation = true;
    if (location !== 'all') {
      matchesLocation = projectLocation.toLowerCase().includes(location.toLowerCase());
    }
    
    return matchesSearch && matchesStatus && matchesSource && matchesPriceRange && matchesLocation;
  });
};

const inventorySlice = createSlice({
  name: 'inventory',
  initialState,
  reducers: {
    setProjects: (state, action) => {
      state.projects = action.payload;
      state.filteredProjects = applyLocalFilters(action.payload, state.filters);
    },
    setSelectedProject: (state, action) => {
      state.selectedProject = action.payload;
    },
    setSelectedBuilder: (state, action) => {
      state.selectedBuilder = action.payload;
    },
    setSelectedBroker: (state, action) => {
      state.selectedBroker = action.payload;
    },
    setViewMode: (state, action) => {
      state.viewMode = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
      state.filteredProjects = applyLocalFilters(state.projects, state.filters);
    },
    clearInventoryError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Get projects
      .addCase(getProjects.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProjects.fulfilled, (state, action) => {
        state.loading = false;
        const responseData = action.payload?.projects || action.payload || [];
        state.projects = responseData;
        state.filteredProjects = applyLocalFilters(responseData, state.filters);
        if (action.payload?.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(getProjects.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch inventory projects';
      })

      // Get source profiles
      .addCase(getSourceProfiles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSourceProfiles.fulfilled, (state, action) => {
        state.loading = false;
        state.sourceProfiles = action.payload?.profiles || action.payload || [];
        if (action.payload?.pagination) {
          state.pagination = action.payload.pagination;
        }
      })
      .addCase(getSourceProfiles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch inventory source profiles';
      })

      // Get project details by ID
      .addCase(getProjectById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getProjectById.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedProject = action.payload;
      })
      .addCase(getProjectById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch project details';
      })

      // Update featured flag
      .addCase(updateProjectFeatured.pending, (state, action) => {
        state.featuredUpdatingById[action.meta.arg.projectId] = true;
        state.error = null;
      })
      .addCase(updateProjectFeatured.fulfilled, (state, action) => {
        const updated = action.payload || {};
        const applyFeatured = (project) => {
          if (project?.id === updated.id) project.isFeatured = updated.isFeatured;
        };

        state.featuredUpdatingById[updated.id] = false;
        state.projects.forEach(applyFeatured);
        state.filteredProjects.forEach(applyFeatured);
        state.sourceProfiles.forEach((profile) => (profile.projects || []).forEach(applyFeatured));
        (state.selectedBuilder?.projects || []).forEach(applyFeatured);
        (state.selectedBroker?.projects || []).forEach(applyFeatured);
        if (state.selectedProject?.id === updated.id) {
          state.selectedProject.isFeatured = updated.isFeatured;
        }
      })
      .addCase(updateProjectFeatured.rejected, (state, action) => {
        state.featuredUpdatingById[action.meta.arg.projectId] = false;
        state.error = action.payload?.message || 'Failed to update featured status';
      })

      // Get configuration units
      .addCase(getConfigurationUnits.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getConfigurationUnits.fulfilled, (state, action) => {
        state.loading = false;
        if (state.selectedProject && state.selectedProject.inventory) {
          const configId = action.meta.arg.configurationId;
          const configIndex = state.selectedProject.inventory.findIndex(
            (c) => c.id === configId
          );
          if (configIndex !== -1) {
            state.selectedProject.inventory[configIndex].unitsList = action.payload?.units || [];
          }
        }
      })
      .addCase(getConfigurationUnits.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.message || 'Failed to fetch configuration units';
      });
  },
});

export const {
  setProjects,
  setSelectedProject,
  setSelectedBuilder,
  setSelectedBroker,
  setViewMode,
  setFilters,
  clearInventoryError,
} = inventorySlice.actions;

export default inventorySlice.reducer;
