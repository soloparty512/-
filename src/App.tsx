import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Layout from './Layout';
import Home from './Home';
import RepairForm from './RepairForm';
import RepairList from './RepairList';
import Dashboard from './Dashboard';
import AdminPanel from './AdminPanel';
import OnlineUsers from './OnlineUsers';
import { LogIn, Wrench } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, profile, loading, login } = useAuth();
  const [activeTab, setActiveTab] = useState('home');

  if (loading) {
    return (
      <div className="min-h-screen bg-retro-bg flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-retro-blue border-t-retro-orange animate-spin mx-auto"></div>
          <p className="font-black uppercase tracking-widest text-retro-blue">กำลังโหลดระบบ...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-retro-bg flex items-center justify-center p-6">
        <div className="retro-card max-w-md w-full text-center space-y-8 py-12">
          <div className="bg-retro-blue w-20 h-20 mx-auto flex items-center justify-center text-white border-2 border-retro-border shadow-[4px_4px_0px_0px_rgba(51,65,85,1)]">
            <Wrench size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-retro-blue uppercase">REPAIR SYSTEM</h1>
            <p className="font-bold text-slate-500">กรุณาเข้าสู่ระบบด้วย Google Account ของหน่วยงาน</p>
          </div>
          <button 
            onClick={login}
            className="retro-button-primary w-full py-4 flex items-center justify-center space-x-3"
          >
            <LogIn size={24} />
            <span className="text-xl">เข้าสู่ระบบด้วย GOOGLE</span>
          </button>
          <p className="text-[10px] text-slate-400 uppercase font-bold">© 2026 REPAIR SERVICE SYSTEM - ALL RIGHTS RESERVED</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <Home onNavigate={setActiveTab} />;
      case 'request': return <RepairForm onSuccess={() => setActiveTab('list')} onNavigate={setActiveTab} />;
      case 'list': return <RepairList onNavigate={setActiveTab} />;
      case 'calendar': return <RepairList onNavigate={setActiveTab} initialView="calendar" />;
      case 'dashboard': return <Dashboard onNavigate={setActiveTab} />;
      case 'admin': return <AdminPanel onNavigate={setActiveTab} />;
      default: return <Home onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
      <OnlineUsers />
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
