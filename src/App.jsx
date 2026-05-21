import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import TripList from './components/TripList'
import TripView from './components/TripView'
import SettingsScreen from './components/SettingsScreen'

const SETTINGS_RETURN_KEY = 'tripsplit_settings_return'

function getRoute() {
  let path = window.location.pathname
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (path === '/settings') return { page: 'settings' }
  if (path === '/trips' || path === '/trips/') return { page: 'trips' }
  if (path === '/overview' || path === '/overview/') return { page: 'dashboard' }
  const match = path.match(/^\/trip\/([a-f0-9-]+)$/)
  if (match) return { page: 'trip', tripId: match[1] }
  return { page: 'trips' }
}

function AppLayout({
  children,
  theme,
  setTheme,
  user,
  profile,
  searchQuery,
  setSearchQuery,
  onSignOut,
  activeTrip,
  activeTripTab,
  setActiveTripTab,
  goTo,
  route,
  onOpenSettings
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const initials = (profile?.display_name || user?.email || '?')[0].toUpperCase()

  // Sidebar elements
  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
      </svg>
    ), active: route.page === 'dashboard', onClick: () => goTo('/overview') },
    { id: 'trips', label: 'Trips', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ), active: route.page === 'trips', onClick: () => goTo('/trips') }
  ]

  // Add Settings item
  const settingsItem = { id: 'settings', label: 'Settings', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ), active: route.page === 'settings', onClick: () => onOpenSettings(window.location.pathname) }

  // Title of current section
  let pageTitle = 'Overview'
  if (route.page === 'settings') pageTitle = 'Settings'
  else if (route.page === 'trips') pageTitle = 'Trip Directory'
  else if (route.page === 'trip' && activeTrip) pageTitle = activeTrip.name

  return (
    <div className="flex min-h-screen bg-[#F5F7FA] dark:bg-[#121212] transition-colors duration-300">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-[#1A1A1A] text-surface-500 dark:text-white shrink-0 border-r border-[#E8ECF0] dark:border-[#2D2D2D] p-5 justify-between">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <span className="text-base text-white">✈️</span>
            </div>
            <span className="typo-h2 text-surface-500 dark:text-white">
              TRIPSPLIT
            </span>
          </div>

          {/* Sidebar Menu */}
          <nav className="space-y-1">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl typo-nav transition-all ${
                  item.active
                    ? 'bg-[#16B843] text-white shadow-md shadow-[#16B843]/15'
                    : 'text-surface-400 dark:text-surface-400 hover:text-surface-500 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-white/[0.05]'
                }`}
              >
                <span className={item.active ? '' : 'opacity-70'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}

            {/* Active Trip Sub-Menu */}
            {route.page === 'trip' && activeTrip && (
              <div className="mt-6 pt-6 border-t border-[#E8ECF0] dark:border-[#2D2D2D] space-y-4">
                <div className="px-3 flex items-center gap-2">
                  <span className="text-lg">{activeTrip.emoji || '🧳'}</span>
                  <span className="text-xs font-black text-surface-300 dark:text-white/40 uppercase tracking-widest truncate">{activeTrip.name}</span>
                </div>
                <div className="space-y-0.5">
                  {[
                    { id: 'expenses', label: 'Costs', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )},
                    { id: 'summary', label: 'Analytics', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                      </svg>
                    )},
                    { id: 'members', label: 'Crew', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )},
                    { id: 'settle', label: 'Transfer', icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    )}
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTripTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                        activeTripTab === tab.id
                          ? 'bg-[#16B843]/10 text-[#16B843] dark:text-brand-400 font-black'
                          : 'text-surface-400 dark:text-surface-400 hover:text-surface-500 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={activeTripTab === tab.id ? 'text-[#16B843]' : 'opacity-60'}>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#E8ECF0] dark:border-[#2D2D2D]">
          <button
            onClick={settingsItem.onClick}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
              settingsItem.active
                ? 'bg-[#16B843] text-white shadow-md shadow-[#16B843]/15'
                : 'text-surface-400 dark:text-surface-400 hover:text-surface-500 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-white/[0.05]'
            }`}
          >
            <span className="opacity-70">{settingsItem.icon}</span>
            <span>{settingsItem.label}</span>
          </button>
          
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-bold text-[#F63332] hover:bg-[#F63332]/10 dark:hover:bg-[#F63332]/15 transition-all"
          >
            <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <header className="bg-white dark:bg-[#1E1E1E] border-b border-[#E8ECF0] dark:border-[#2D2D2D] py-3.5 px-4 md:pl-6 md:pr-10 flex justify-between items-center sticky top-0 z-30 transition-colors shadow-sm">
          {/* Section / Trip Title */}
          <div className="flex items-center gap-3">
            {route.page !== 'dashboard' && (
              <button
                onClick={() => goTo('/')}
                className="md:hidden flex h-8 w-8 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-500 text-surface-400 hover:text-brand-600 transition-all active:scale-95"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <h2 className="typo-h2 truncate max-w-[200px] sm:max-w-xs md:max-w-none">
              {pageTitle}
            </h2>
          </div>

          {/* Search, Tools, Profile */}
          <div className="flex items-center gap-4">
            {/* Search Pill */}
            {route.page === 'dashboard' && (
              <div className="relative hidden sm:block">
                <input
                  type="text"
                  placeholder="Search trips..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-48 md:w-64 bg-[#F9F9F9] dark:bg-[#121212] border border-[#E8ECF0] dark:border-[#2D2D2D] rounded-full py-2 pl-10 pr-4 text-xs font-semibold text-surface-500 dark:text-white outline-none focus:border-[#16B843] focus:ring-1 focus:ring-[#16B843] transition-all placeholder-surface-300 dark:placeholder-surface-400"
                />
                <svg className="absolute left-3.5 top-2.5 w-3.5 h-3.5 text-surface-400 dark:text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            )}

            {/* Dark Mode Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#F9F9F9] dark:bg-[#2D2D2D] border border-[#E8ECF0] dark:border-[#3D3D3D] hover:text-[#16B843] dark:hover:text-[#16B843] text-surface-400 dark:text-surface-300 transition-all active:scale-95 shadow-sm"
              title="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                </svg>
              )}
            </button>

            {/* Notifications Alert Bell */}
            <div className="relative">
              <button
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#F9F9F9] dark:bg-[#2D2D2D] border border-[#E8ECF0] dark:border-[#3D3D3D] text-surface-400 dark:text-surface-300 transition-all active:scale-95 shadow-sm"
                title="Notifications"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F63332] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#F63332]"></span>
              </span>
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 bg-[#F9F9F9] dark:bg-[#2D2D2D] hover:bg-surface-100 dark:hover:bg-[#3D3D3D] border border-[#E8ECF0] dark:border-[#3D3D3D] pl-2.5 pr-3 py-1.5 rounded-2xl transition-all active:scale-95 shadow-sm"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-inner">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <span className="text-xs font-bold text-surface-500 dark:text-white hidden md:block max-w-[80px] truncate tracking-tight">
                  {profile?.display_name || user?.email?.split('@')[0]}
                </span>
                <svg className="w-3 h-3 text-surface-400 dark:text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-[#1E1E1E] border border-[#E8ECF0] dark:border-[#2D2D2D] rounded-2xl shadow-xl py-1.5 z-50 animate-fadeIn origin-top-right">
                    <div className="px-4 py-2 border-b border-[#E8ECF0] dark:border-[#2D2D2D]">
                      <p className="text-xs font-black text-surface-300 dark:text-surface-400 uppercase tracking-widest">Logged In As</p>
                      <p className="text-xs font-bold text-surface-500 dark:text-white truncate mt-0.5">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setProfileOpen(false); onOpenSettings(window.location.pathname) }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-surface-500 dark:text-white hover:bg-brand-50 dark:hover:bg-[#2D2D2D] hover:text-[#16B843] dark:hover:text-[#16B843] transition-colors"
                    >
                      Settings Screen
                    </button>
                    <button
                      onClick={() => { setProfileOpen(false); onSignOut() }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#F63332] hover:bg-red-50 dark:hover:bg-[#2D2D2D] transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* SCREEN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto px-4 md:pl-6 md:pr-10 py-6 pb-20 md:pb-6 relative">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

      {/* MOBILE BOTTOM NAV - TRIP VIEW (trip detail pages) */}
      {route.page === 'trip' && activeTrip && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30">
          <div className="bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl border-t border-[#E8ECF0] dark:border-[#2D2D2D] rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center py-2 px-2">
              {[
                { id: 'expenses', label: 'Costs', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                )},
                { id: 'summary', label: 'Analytics', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                  </svg>
                )},
                { id: 'members', label: 'Crew', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )},
                { id: 'settle', label: 'Transfer', icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                )}
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTripTab(tab.id)}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all relative ${
                    activeTripTab === tab.id ? 'text-[#16B843]' : 'text-surface-400 hover:text-surface-500 dark:hover:text-white'
                  } active:scale-90`}
                >
                  {activeTripTab === tab.id && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#16B843] rounded-full" />
                  )}
                  <span className={`transition-transform duration-200 ${activeTripTab === tab.id ? 'scale-110' : ''}`}>
                    {tab.icon}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    activeTripTab === tab.id ? 'text-[#16B843]' : ''
                  }`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* MOBILE BOTTOM NAV - MAIN (dashboard, trips list, settings) */}
      {route.page !== 'trip' && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30">
          <div className="bg-white/95 dark:bg-[#1E1E1E]/95 backdrop-blur-xl border-t border-[#E8ECF0] dark:border-[#2D2D2D] rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex justify-around items-center py-2 px-2">
              {[
                {
                  id: 'overview', label: 'Overview',
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z" />
                    </svg>
                  ),
                  active: route.page === 'dashboard',
                  onClick: () => goTo('/overview')
                },
                {
                  id: 'trips', label: 'Trips',
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  ),
                  active: route.page === 'trips',
                  onClick: () => goTo('/trips')
                },
                {
                  id: 'settings', label: 'Settings',
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                  active: route.page === 'settings',
                  onClick: () => onOpenSettings(window.location.pathname)
                }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={tab.onClick}
                  className={`flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all relative ${
                    tab.active ? 'text-[#16B843]' : 'text-surface-400 hover:text-surface-500 dark:hover:text-white'
                  } active:scale-90`}
                >
                  {tab.active && (
                    <span className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-[#16B843] rounded-full" />
                  )}
                  <span className={`transition-transform duration-200 ${tab.active ? 'scale-110' : ''}`}>
                    {tab.icon}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-wider ${
                    tab.active ? 'text-[#16B843]' : ''
                  }`}>
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [route, setRoute] = useState(getRoute)
  const [currency, setCurrency] = useState(() => localStorage.getItem('currency') || '₹')
  const [profile, setProfile] = useState(null)
  
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('tripsplit_theme') || 'light')

  // Invitation redemption states
  const [redeemingInvite, setRedeemingInvite] = useState(false)
  const [activeTrip, setActiveTrip] = useState(null)
  const [activeTripTab, setActiveTripTab] = useState('expenses')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('tripsplit_theme', theme)
  }, [theme])

  const fetchProfile = async (userId) => {
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) setProfile(data)
  }

  const goTo = (path) => {
    const normalized = path === '/' ? '/' : (path.startsWith('/') ? path : `/${path}`)
    window.history.pushState({}, '', normalized)
    setRoute(getRoute())
  }

  const openSettings = (returnPath = '/') => {
    try {
      sessionStorage.setItem(SETTINGS_RETURN_KEY, returnPath)
    } catch {
      /* ignore */
    }
    goTo('/settings')
  }

  const closeSettings = () => {
    let dest = '/'
    try {
      dest = sessionStorage.getItem(SETTINGS_RETURN_KEY) || '/'
      sessionStorage.removeItem(SETTINGS_RETURN_KEY)
    } catch {
      /* ignore */
    }
    goTo(dest)
  }

  const handleSignOut = async () => {
    try {
      sessionStorage.removeItem(SETTINGS_RETURN_KEY)
    } catch {
      /* ignore */
    }
    goTo('/')
    await supabase.auth.signOut()
  }

  // Intercept invite token on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const token = params.get('token')
      if (token) {
        localStorage.setItem('invite_token', token)
        // Clean URL parameters
        const search = window.location.search.replace(/[?&]token=[^&]+/, '').replace(/^&/, '?')
        const newUrl = window.location.pathname + (search === '?' ? '' : search)
        window.history.replaceState({}, '', newUrl)
      }
    } catch (e) {
      console.error('Failed to parse invite token from URL:', e)
    }
  }, [])

  // Listen to popstate (back/forward browser buttons)
  useEffect(() => {
    const onPop = () => setRoute(getRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session?.user) {
      fetchProfile(session.user.id)
    } else {
      setProfile(null)
    }
  }, [session])

  // Redemption function
  const redeemInvite = async (token) => {
    setRedeemingInvite(true)
    try {
      const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })
      
      try {
        localStorage.removeItem('invite_token')
      } catch {}

      if (error) {
        alert(`Failed to redeem invite: ${error.message}`)
        return
      }

      if (data && data.ok === false) {
        alert(`Failed to redeem invite: ${data.error || 'Invalid or expired invite link'}`)
        return
      }

      if (data && data.trip_id) {
        goTo(`/trip/${data.trip_id}`)
      }
    } catch (err) {
      console.error('Error redeeming invite:', err)
      try {
        localStorage.removeItem('invite_token')
      } catch {}
    } finally {
      setRedeemingInvite(false)
    }
  }

  // Monitor session to trigger invite redemption
  useEffect(() => {
    if (session) {
      try {
        const token = localStorage.getItem('invite_token')
        if (token) {
          redeemInvite(token)
        }
      } catch {}
    }
  }, [session])

  const handleCurrencyChange = (c) => {
    setCurrency(c)
    localStorage.setItem('currency', c)
  }

  // Loading
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center transition-colors">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-bounce">✈️</div>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-bold">Loading TripSplit...</p>
        </div>
      </div>
    )
  }

  if (redeemingInvite) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100 dark:from-neutral-900 dark:via-neutral-800 dark:to-neutral-900 flex items-center justify-center transition-colors">
        <div className="w-full max-w-sm p-8 text-center space-y-4">
          <div className="text-5xl animate-bounce">🎫</div>
          <h3 className="text-2xl font-black text-surface-500 dark:text-white">
            Redeeming Ticket...
          </h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold">
            We are validating your invitation and adding you to the trip. Please wait a moment.
          </p>
          <div className="w-16 h-1.5 bg-slate-100 dark:bg-neutral-700 rounded-full mx-auto overflow-hidden relative">
            <div className="absolute top-0 bottom-0 bg-brand-500 rounded-full animate-pulse w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!session) return <Auth />

  // Render Routed components inside global layout
  let content = null

  if (route.page === 'settings') {
    content = (
      <SettingsScreen
        user={session.user}
        currency={currency}
        onCurrencyChange={handleCurrencyChange}
        onBack={closeSettings}
        onSignOut={handleSignOut}
        onProfileUpdated={() => fetchProfile(session.user.id)}
      />
    )
  } else if (route.page === 'trips') {
    content = (
      <TripList
        user={session.user}
        currency={currency}
        onSelectTrip={(id) => goTo(`/trip/${id}`)}
        onOpenSettings={() => openSettings('/trips')}
        profile={profile}
      />
    )
  } else if (route.page === 'trip' && route.tripId) {
    content = (
      <TripView
        tripId={route.tripId}
        user={session.user}
        currency={currency}
        activeTab={activeTripTab}
        setActiveTab={setActiveTripTab}
        onBack={() => { setActiveTrip(null); goTo('/') }}
        onOpenSettings={() => openSettings(`/trip/${route.tripId}`)}
        onTripLoaded={(t) => setActiveTrip(t)}
      />
    )
  } else {
    content = (
      <Dashboard
        user={session.user}
        currency={currency}
        searchQuery={searchQuery}
        onCurrencyChange={handleCurrencyChange}
        onSelectTrip={(id) => goTo(`/trip/${id}`)}
        onOpenSettings={() => openSettings('/overview')}
        profile={profile}
      />
    )
  }

  return (
    <AppLayout
      theme={theme}
      setTheme={setTheme}
      user={session.user}
      profile={profile}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onSignOut={handleSignOut}
      activeTrip={activeTrip}
      activeTripTab={activeTripTab}
      setActiveTripTab={setActiveTripTab}
      goTo={goTo}
      route={route}
      onOpenSettings={openSettings}
    >
      {content}
    </AppLayout>
  )
}
