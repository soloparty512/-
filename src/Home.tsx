import React from 'react';
import { useAuth } from './AuthContext';
import { Wrench, ClipboardList, ShieldCheck, BarChart3, ArrowRight } from 'lucide-react';

const Home: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { profile } = useAuth();

  const features = [
    { 
      title: 'แจ้งซ่อมง่าย', 
      desc: 'แจ้งปัญหาผ่านมือถือได้ทันที พร้อมอัปโหลดรูปภาพ', 
      icon: Wrench, 
      color: 'bg-retro-blue',
      action: 'request',
      roles: ['user', 'admin', 'manager']
    },
    { 
      title: 'ติดตามสถานะ', 
      desc: 'ตรวจสอบสถานะงานซ่อมได้แบบ Real-time', 
      icon: ClipboardList, 
      color: 'bg-retro-orange',
      action: 'list',
      roles: ['user', 'staff', 'admin', 'executive', 'manager']
    },
    { 
      title: 'จัดการงานซ่อม', 
      desc: 'สำหรับเจ้าหน้าที่เพื่อรับงานและบันทึกการแก้ไข', 
      icon: ShieldCheck, 
      color: 'bg-green-600',
      action: 'list',
      roles: ['staff', 'admin', 'manager']
    },
    { 
      title: 'Dashboard', 
      desc: 'สรุปภาพรวมสำหรับผู้บริหารเพื่อการวางแผน', 
      icon: BarChart3, 
      color: 'bg-purple-600',
      action: 'dashboard',
      roles: ['executive', 'admin', 'manager']
    },
  ];

  const filteredFeatures = features.filter(f => profile && f.roles.includes(profile.role));

  return (
    <div className="space-y-12 py-6">
      <div className="text-center space-y-4">
        <div className="flex flex-col items-center justify-center mb-8">
          <div className="bg-retro-blue p-5 rounded-3xl text-white shadow-2xl shadow-blue-500/20 mb-6 border-4 border-white">
            <Wrench size={48} className="shrink-0" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 text-center">
            REPAIR <span className="text-app-primary">PRO</span>
          </h1>
        </div>
        <p className="text-lg font-medium text-slate-500 max-w-2xl mx-auto">
          ระบบจัดการงานซ่อมบำรุงอัจฉริยะ เพื่อประสิทธิภาพสูงสุดขององค์กร
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {filteredFeatures.map((f, idx) => (
          <div 
            key={idx} 
            onClick={() => onNavigate(f.action)}
            className="group relative bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500 cursor-pointer overflow-hidden"
          >
            <div className={`absolute top-0 right-0 w-32 h-32 ${f.color} opacity-[0.03] rounded-bl-full transition-all duration-500 group-hover:scale-150`} />
            
            <div className="flex items-start space-x-6 relative z-10">
              <div className={`${f.color} p-4 text-white rounded-2xl shadow-lg transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                <f.icon className="w-7 h-7 shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-app-primary transition-colors">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-6">{f.desc}</p>
                <div className="flex items-center text-app-primary font-bold text-xs uppercase tracking-widest">
                  <span>เข้าใช้งานระบบ</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-2 shrink-0 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,#3b82f633,transparent_70%)]" />
        <div className="relative z-10">
          <h3 className="text-2xl font-bold text-white mb-2">ยินดีต้อนรับกลับมา, {profile?.name}</h3>
          <p className="text-slate-400 mb-8">สิทธิ์การเข้าถึง: <span className="text-app-primary font-bold uppercase tracking-widest">{profile?.role}</span></p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="px-5 py-2 bg-slate-800/50 rounded-full text-[10px] font-bold text-slate-400 border border-slate-700 uppercase tracking-widest">Version 2.0.0</div>
            <div className="px-5 py-2 bg-emerald-500/10 rounded-full text-[10px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              System Online
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
