import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Sidebar from '../components/Sidebar';
import { getMyEffectiveAccess } from '../store/roleAccessSlice';

const AppLayout = () => {
  const dispatch = useDispatch();

  // Source of truth for sidebar visibility and route access (see
  // docs/frontend-roles-access-handoff.md "Main Frontend Rule"). Fetched
  // once here since AppLayout stays mounted for the whole dashboard session
  // - individual pages don't need to re-fetch it.
  useEffect(() => {
    dispatch(getMyEffectiveAccess());
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-[#F8F9FE] flex">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 min-h-screen flex flex-col relative overflow-hidden">
        <Suspense fallback={<div role="status" className="p-6 text-sm text-gray-500">Loading page...</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
};

export default AppLayout;
