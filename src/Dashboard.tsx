import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, onSnapshot, Timestamp } from 'firebase/firestore';
import { RepairRequest } from './types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend, AreaChart, Area 
} from 'recharts';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, TrendingUp, User, Calendar, Zap, Home, ArrowLeft } from 'lucide-react';
import { format, subDays, startOfDay, isAfter, differenceInMinutes } from 'date-fns';
import { th } from 'date-fns/locale';

const Dashboard: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'repair_requests'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairRequest));
      setRequests(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    inProgress: requests.filter(r => r.status === 'in-progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    urgent: requests.filter(r => r.urgency === 'urgent').length,
    avgResponse: Math.round(
      requests.filter(r => r.startTime && r.timestamp).reduce((acc, r) => acc + differenceInMinutes(r.startTime.toDate(), r.timestamp.toDate()), 0) / 
      (requests.filter(r => r.startTime && r.timestamp).length || 1)
    )
  };

  // Data for Charts
  const typeData = [
    { name: 'เครื่องจักร', value: requests.filter(r => r.repairType === 'machine' || !r.repairType).length },
    { name: 'ไฟฟ้า', value: requests.filter(r => r.repairType === 'electrical').length },
    { name: 'ประปา', value: requests.filter(r => r.repairType === 'plumbing').length },
    { name: 'IT', value: requests.filter(r => r.repairType === 'it').length },
  ].filter(d => d.value > 0);

  const areaData = Array.from(new Set(requests.map(r => r.area))).map(area => ({
    name: area,
    count: requests.filter(r => r.area === area).length
  })).sort((a, b) => b.count - a.count).slice(0, 5);

  const technicianData = Array.from(new Set(requests.filter(r => r.status === 'completed' && r.technicianName).map(r => r.technicianName as string)))
    .map(name => ({
      name,
      count: requests.filter(r => r.status === 'completed' && r.technicianName === name).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Average Response Time per Technician (Time from Request to Start)
  const technicianResponseData = Array.from(new Set(requests.filter(r => r.technicianName && r.startTime && r.timestamp).map(r => r.technicianName as string)))
    .map(name => {
      const techRequests = requests.filter(r => r.technicianName === name && r.startTime && r.timestamp);
      const avgResponse = techRequests.reduce((acc, r) => {
        const start = r.startTime.toDate();
        const created = r.timestamp.toDate();
        return acc + differenceInMinutes(start, created);
      }, 0) / techRequests.length;
      return {
        name,
        avgMinutes: Math.round(avgResponse)
      };
    })
    .sort((a, b) => b.avgMinutes - a.avgMinutes) // Faster response first
    .slice(0, 5);

  // Machine Breakdown (Top 10)
  const machineBreakdownData = Array.from(new Set(requests.map(r => r.machineName)))
    .filter(name => name)
    .map(name => ({
      name,
      count: requests.filter(r => r.machineName === name).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Average Repair Time (Past Month)
  const oneMonthAgo = subDays(new Date(), 30);
  const completedLastMonth = requests.filter(r => 
    r.status === 'completed' && 
    r.startTime && 
    r.endTime && 
    isAfter(r.endTime.toDate(), oneMonthAgo)
  );

  const avgRepairTimeData = ['normal', 'urgent'].map(urgency => {
    const group = completedLastMonth.filter(r => r.urgency === urgency);
    const avg = group.length > 0 
      ? group.reduce((acc, r) => acc + differenceInMinutes(r.endTime!.toDate(), r.startTime!.toDate()), 0) / group.length
      : 0;
    return {
      name: urgency === 'urgent' ? 'ด่วน' : 'ปกติ',
      minutes: Math.round(avg)
    };
  });

  // Requests Completed per Day (Last Week)
  const lastWeek = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), i);
    const start = startOfDay(date);
    const dayRequests = requests.filter(r => 
      r.status === 'completed' && 
      r.endTime && 
      isAfter(r.endTime.toDate(), start) && 
      !isAfter(r.endTime.toDate(), startOfDay(subDays(date, -1)))
    );
    return {
      date: format(date, 'dd MMM', { locale: th }),
      count: dayRequests.length,
      timestamp: date.getTime()
    };
  }).reverse();

  const COLORS = ['#1e3a8a', '#f97316', '#10b981', '#ef4444', '#8b5cf6'];

  if (loading) return <div className="text-center py-20 font-bold animate-pulse">กำลังประมวลผลข้อมูล...</div>;

  return (
    <div className="space-y-10">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate?.('home')}
            className="p-3 bg-white hover:bg-slate-50 border border-app-border rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
            title="หน้าแรก"
          >
            <Home size={20} className="text-slate-600" />
          </button>
          <button 
            onClick={() => onNavigate?.('home')}
            className="p-3 bg-white hover:bg-slate-50 border border-app-border rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
            title="ย้อนกลับ"
          >
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="h-10 w-[1px] bg-app-border mx-2 hidden md:block" />
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">Dashboard ภาพรวม</h2>
        </div>
        <div className="bg-white px-6 py-2.5 rounded-2xl border border-app-border shadow-sm text-xs font-bold text-slate-500 flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          อัปเดตล่าสุด: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 text-app-primary rounded-2xl group-hover:bg-app-primary group-hover:text-white transition-colors">
              <ClipboardList size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Total</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">แจ้งซ่อมทั้งหมด</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.total}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-amber-500/5 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Clock size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Pending</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">รอดำเนินการ</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.pending}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Done</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ซ่อมเสร็จแล้ว</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.completed}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-rose-500/5 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-rose-50 text-rose-500 rounded-2xl group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <AlertTriangle size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Urgent</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">งานด่วน</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.urgent}</h3>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-orange-500/5 transition-all group">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <Zap size={24} />
            </div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Response</span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">ตอบรับเฉลี่ย (นาที)</p>
          <h3 className="text-4xl font-black text-slate-900">{stats.avgResponse}</h3>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-app-primary rounded-full" />
            แยกตามพื้นที่ (Top 5)
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={areaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full" />
            สัดส่วนประเภทงาน
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
            เวลาซ่อมเฉลี่ย (นาที)
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={avgRepairTimeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} barSize={60}>
                  {avgRepairTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.name === 'ด่วน' ? '#f43f5e' : '#10b981'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-indigo-500 rounded-full" />
            งานที่เสร็จสิ้นรายวัน (7 วันล่าสุด)
          </h4>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lastWeek}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                />
                <Area type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm lg:col-span-2">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-slate-900 rounded-full" />
            ผลงานช่างซ่อม (จำนวนงานที่เสร็จสิ้น)
          </h4>
          <div className="h-80">
            {technicianData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={technicianData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={100} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Bar dataKey="count" fill="#0f172a" radius={[0, 6, 6, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center">
                  <User size={32} />
                </div>
                <p className="font-bold uppercase tracking-widest text-xs">ยังไม่มีข้อมูลการซ่อมที่เสร็จสิ้น</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-orange-500 rounded-full" />
            เวลาตอบรับงานเฉลี่ย (นาที) - รายบุคคล
          </h4>
          <div className="h-72">
            {technicianResponseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={technicianResponseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Bar dataKey="avgMinutes" fill="#f97316" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                <p className="font-bold uppercase tracking-widest text-xs">ไม่มีข้อมูลเวลาตอบรับ</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
            <div className="w-2 h-2 bg-rose-500 rounded-full" />
            รายการเครื่องจักรที่แจ้งซ่อมบ่อย (Top 10)
          </h4>
          <div className="h-72">
            {machineBreakdownData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={machineBreakdownData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={80} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Bar dataKey="count" fill="#e11d48" radius={[0, 6, 6, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-300">
                <p className="font-bold uppercase tracking-widest text-xs">ไม่มีข้อมูลเครื่องจักร</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
