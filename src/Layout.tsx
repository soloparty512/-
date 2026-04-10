import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { LogOut, LayoutDashboard, Wrench, UserCog, ClipboardList, Home, Menu, X, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const { profile, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: 'home', label: 'หน้าแรก', icon: Home, roles: ['user', 'staff', 'admin', 'executive'] },
    { id: 'request', label: 'แจ้งซ่อม', icon: Wrench, roles: ['user', 'admin', 'manager'] },
    { id: 'list', label: 'รายการซ่อม', icon: ClipboardList, roles: ['user', 'staff', 'admin', 'executive', 'manager'] },
    { id: 'calendar', label: 'ปฏิทินงาน', icon: Calendar, roles: ['user', 'staff', 'admin', 'executive', 'manager'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'executive', 'manager'] },
    { id: 'admin', label: 'จัดการระบบ', icon: UserCog, roles: ['admin', 'manager'] },
  ];

  const filteredNav = navItems.filter(item => profile && item.roles.includes(profile.role));

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-retro-bg overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden bg-retro-blue text-white p-4 flex items-center justify-between border-b-2 border-retro-border sticky top-0 z-[60]">
        <div className="flex items-center space-x-2">
          <Wrench size={24} className="text-retro-orange" />
          <h1 className="text-xl font-bold tracking-tighter uppercase">REPAIR SYS</h1>
        </div>
        <button 
          onClick={toggleSidebar}
          className="p-2 border-2 border-white hover:bg-blue-800 transition-colors"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col md:relative shadow-2xl md:shadow-none"
          >
            <div className="p-8 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-app-primary p-2 rounded-lg">
                  <Wrench size={24} className="text-white" />
                </div>
                <h1 className="text-xl font-extrabold tracking-tight">REPAIR<span className="text-app-primary">PRO</span></h1>
              </div>
              <button 
                onClick={toggleSidebar}
                className="hidden md:block p-2 hover:bg-slate-800 rounded-lg transition-all text-slate-400 hover:text-white"
                title="ซ่อนเมนู"
              >
                <ChevronLeft size={20} />
              </button>
            </div>
            
            <nav className="px-4 py-2 space-y-1 flex-1 overflow-y-auto">
              {filteredNav.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 768) setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-4 py-3.5 font-semibold transition-all rounded-xl ${
                    activeTab === item.id 
                    ? 'bg-app-primary text-white shadow-lg shadow-blue-500/20' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="tracking-tight">{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="p-6 mt-auto">
              <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-app-primary to-blue-400 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner">
                    {profile?.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate text-white">{profile?.name}</p>
                    <div className="flex items-center mt-0.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        profile?.role === 'admin' ? 'bg-rose-500/20 text-rose-400' :
                        profile?.role === 'manager' ? 'bg-blue-500/20 text-blue-400' :
                        profile?.role === 'staff' ? 'bg-emerald-500/20 text-emerald-400' :
                        profile?.role === 'executive' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {profile?.role.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={logout}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 text-xs font-bold bg-slate-700 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all"
                >
                  <LogOut size={14} />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Toggle Button (when sidebar is closed) */}
      {!isSidebarOpen && (
        <button 
          onClick={toggleSidebar}
          className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-retro-blue text-white p-2 border-y-2 border-r-2 border-retro-border hover:bg-blue-800 transition-all shadow-[2px_2px_0px_0px_rgba(30,58,138,1)]"
          title="แสดงเมนู"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-10 overflow-y-auto h-screen">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
