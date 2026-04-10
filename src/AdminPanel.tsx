import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { RepairRequest, UserProfile, MasterData } from './types';
import { UserCog, Database, Save, Plus, Trash2, Bell, Download, FileSpreadsheet, Mail, Home, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { useAuth } from './AuthContext';

const AdminPanel: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [masterData, setMasterData] = useState<MasterData>({
    types: ['เครื่องจักร', 'ไฟฟ้า', 'ประปา', 'IT'],
    areas: ['Production Line 1', 'Production Line 2', 'Warehouse', 'Office'],
    buildings: ['อาคาร A', 'อาคาร B', 'อาคาร C'],
    urgencies: ['ปกติ', 'ด่วน'],
  });
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'assignments' | 'data' | 'export'>('users');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ employeeId: '', shift: '', name: '' });

  const staffUsers = users.filter(u => u.role === 'staff' || u.role === 'admin' || u.role === 'manager');

  const handleAssignTechnician = async (requestId: string, techId: string) => {
    const tech = staffUsers.find(u => u.uid === techId);
    if (!tech) return;

    try {
      await updateDoc(doc(db, 'repair_requests', requestId), {
        technicianId: tech.uid,
        technicianName: tech.name,
        technicianShift: tech.shift || '',
        status: 'in-progress' // Auto update status to in-progress when assigned
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'repair_requests');
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    });

    const qRequests = query(collection(db, 'repair_requests'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairRequest)));
      setLoading(false);
    });

    const fetchMasterData = async () => {
      const docRef = doc(db, 'master_data', 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setMasterData(docSnap.data() as MasterData);
      } else {
        await setDoc(docRef, masterData);
      }
    };
    fetchMasterData();

    return () => {
      unsubscribeUsers();
      unsubscribeRequests();
    };
  }, []);

  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setEditForm({
      employeeId: user.employeeId || '',
      shift: user.shift || '',
      name: user.name || ''
    });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      await updateDoc(doc(db, 'users', editingUser.uid), {
        employeeId: editForm.employeeId,
        shift: editForm.shift,
        name: editForm.name
      });
      setEditingUser(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const saveMasterData = async () => {
    try {
      const dataToSave = {
        ...masterData,
        lineToken: masterData.lineToken || ''
      };
      await setDoc(doc(db, 'master_data', 'config'), dataToSave);
      alert('บันทึกข้อมูลตั้งค่าสำเร็จ');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'master_data');
    }
  };

  const downloadCSV = () => {
    if (requests.length === 0) {
      alert('ไม่มีข้อมูลสำหรับการดาวน์โหลด');
      return;
    }

    // Define headers
    const headers = [
      'ID',
      'วันที่แจ้ง',
      'เครื่องจักร',
      'พื้นที่',
      'ปัญหา',
      'ผู้แจ้ง',
      'รหัสผู้แจ้ง',
      'กะ',
      'ระดับความเร่งด่วน',
      'สถานะ',
      'เวลาเริ่มซ่อม',
      'เวลาซ่อมเสร็จ',
      'ผู้ดำเนินการซ่อม',
      'ผู้ตรวจสอบ (Supervisor)',
      'วิธีแก้ไข',
      'สาเหตุ'
    ];

    // Map data to rows
    const rows = requests.map(req => [
      req.id,
      format(req.timestamp.toDate(), 'yyyy-MM-dd HH:mm:ss'),
      `"${req.machineName}"`,
      `"${req.area}"`,
      `"${req.problem.replace(/"/g, '""')}"`,
      `"${req.requesterName}"`,
      req.requesterId,
      req.requesterShift,
      req.urgency,
      req.status,
      req.startTime ? format(req.startTime.toDate(), 'yyyy-MM-dd HH:mm:ss') : '-',
      req.endTime ? format(req.endTime.toDate(), 'yyyy-MM-dd HH:mm:ss') : '-',
      `"${req.technicianName || '-'}"`,
      `"${req.supervisorName || '-'}"`,
      `"${(req.repairAction || '-').replace(/"/g, '""')}"`,
      `"${(req.failureCause || '-').replace(/"/g, '""')}"`
    ]);

    // Combine headers and rows
    const csvContent = [
      '\ufeff' + headers.join(','), // Add BOM for Excel Thai support
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `repair_requests_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateEmailConfig = (updates: Partial<NonNullable<MasterData['emailConfig']>>) => {
    const defaultConfig = { 
      smtpHost: '', 
      smtpPort: 587, 
      smtpUser: '', 
      smtpPass: '', 
      fromEmail: '', 
      toEmail: '', 
      enabled: false, 
      notifyUrgentOnly: false, 
      notifyOnCreate: true, 
      notifyOnComplete: true 
    };
    const currentConfig = masterData.emailConfig || defaultConfig;
    setMasterData({
      ...masterData,
      emailConfig: { ...currentConfig, ...updates }
    });
  };

  if (loading) return <div className="text-center py-20 font-bold animate-pulse">กำลังโหลดข้อมูลผู้ใช้...</div>;

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
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">จัดการระบบ</h2>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeSubTab === 'users' ? 'bg-white text-app-primary shadow-sm' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <UserCog size={16} /> ผู้ใช้งาน
          </button>
          <button 
            onClick={() => setActiveSubTab('assignments')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeSubTab === 'assignments' ? 'bg-white text-app-primary shadow-sm' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Plus size={16} /> มอบหมายงาน
          </button>
          <button 
            onClick={() => setActiveSubTab('data')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeSubTab === 'data' ? 'bg-white text-app-primary shadow-sm' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Database size={16} /> ข้อมูลระบบ
          </button>
          <button 
            onClick={() => setActiveSubTab('export')}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 ${
              activeSubTab === 'export' ? 'bg-white text-app-primary shadow-sm' : 'text-slate-500 hover:bg-white/50'
            }`}
          >
            <Download size={16} /> ส่งออก
          </button>
        </div>
      </div>

      {activeSubTab === 'users' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">ชื่อ - อีเมล</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">สิทธิ์การใช้งาน</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">รหัสพนักงาน</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">กะ</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(user => (
                  <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-8">
                      <p className="font-bold text-slate-900">{user.name}</p>
                      <p className="text-xs font-medium text-slate-400">{user.email}</p>
                    </td>
                    <td className="p-8">
                      <select 
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value)}
                        disabled={currentUser?.role === 'manager'}
                        className="bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-app-primary/20 transition-all disabled:opacity-50"
                      >
                        <option value="user">ผู้แจ้งซ่อม (User)</option>
                        <option value="staff">เจ้าหน้าที่ (Staff)</option>
                        <option value="manager">ผู้จัดการระบบ (Manager)</option>
                        <option value="executive">ผู้บริหาร (Executive)</option>
                        <option value="admin">แอดมิน (Admin)</option>
                      </select>
                    </td>
                    <td className="p-8">
                      <span className="font-mono text-xs bg-slate-100 px-3 py-1 rounded-lg text-slate-600 font-bold">{user.employeeId || '-'}</span>
                    </td>
                    <td className="p-8">
                      <span className="font-bold text-slate-700">{user.shift || '-'}</span>
                    </td>
                    <td className="p-8 text-center">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="p-3 bg-white text-slate-400 hover:text-app-primary hover:bg-blue-50 border border-slate-100 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
                        title="แก้ไขข้อมูล"
                      >
                        <UserCog size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'assignments' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">ข้อมูลการแจ้งซ่อม</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">สถานะ</th>
                  <th className="p-8 font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">มอบหมายให้</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {requests
                  .filter(r => r.status === 'pending' || r.status === 'in-progress')
                  .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime())
                  .map(req => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-8">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          req.urgency === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {req.urgency === 'urgent' ? 'ด่วน' : 'ปกติ'}
                        </span>
                        <p className="font-bold text-slate-900">{req.machineName}</p>
                      </div>
                      <p className="text-xs font-medium text-slate-500 line-clamp-1">{req.problem}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                        {req.area} • {format(req.timestamp.toDate(), 'dd MMM HH:mm', { locale: th })}
                      </p>
                    </td>
                    <td className="p-8">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {req.status === 'pending' ? 'รอดำเนินการ' : 'กำลังซ่อม'}
                      </span>
                    </td>
                    <td className="p-8">
                      <select 
                        value={req.technicianId || ''}
                        onChange={(e) => handleAssignTechnician(req.id, e.target.value)}
                        className="w-full bg-slate-100 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-app-primary/20 transition-all"
                      >
                        <option value="">เลือกช่างซ่อม...</option>
                        {staffUsers.map(tech => (
                          <option key={tech.uid} value={tech.uid}>{tech.name} ({tech.shift || '-'})</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
                {requests.filter(r => r.status === 'pending' || r.status === 'in-progress').length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-20 text-center">
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">ไม่มีรายการที่ต้องมอบหมาย</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'data' ? (
        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full" />
              ตั้งค่า LINE Notify
            </h4>
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="line-enabled"
                    checked={masterData.lineConfig?.enabled ?? true}
                    onChange={(e) => setMasterData({ 
                      ...masterData, 
                      lineConfig: { ...(masterData.lineConfig || { token: masterData.lineToken || '', enabled: true, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true }), enabled: e.target.checked } 
                    })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </div>
                <label htmlFor="line-enabled" className="font-bold text-slate-700">เปิดใช้งาน LINE Notify</label>
              </div>

              <div className="space-y-2">
                <label className="retro-label">LINE Notify Token</label>
                <input 
                  type="password"
                  className="retro-input"
                  placeholder="ใส่ Token ที่ได้จาก LINE Notify"
                  value={masterData.lineConfig?.token ?? masterData.lineToken ?? ''}
                  onChange={(e) => setMasterData({ 
                    ...masterData, 
                    lineConfig: { ...(masterData.lineConfig || { token: '', enabled: true, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true }), token: e.target.value },
                    lineToken: e.target.value
                  })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="line-urgent"
                    checked={masterData.lineConfig?.notifyUrgentOnly || false}
                    onChange={(e) => setMasterData({ 
                      ...masterData, 
                      lineConfig: { ...(masterData.lineConfig || { token: '', enabled: true, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true }), notifyUrgentOnly: e.target.checked } 
                    })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="line-urgent" className="text-xs font-bold text-slate-600 uppercase tracking-widest">เฉพาะงานด่วน</label>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="line-create"
                    checked={masterData.lineConfig?.notifyOnCreate ?? true}
                    onChange={(e) => setMasterData({ 
                      ...masterData, 
                      lineConfig: { ...(masterData.lineConfig || { token: '', enabled: true, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true }), notifyOnCreate: e.target.checked } 
                    })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="line-create" className="text-xs font-bold text-slate-600 uppercase tracking-widest">แจ้งเมื่อแจ้งซ่อม</label>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="line-complete"
                    checked={masterData.lineConfig?.notifyOnComplete ?? true}
                    onChange={(e) => setMasterData({ 
                      ...masterData, 
                      lineConfig: { ...(masterData.lineConfig || { token: '', enabled: true, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true }), notifyOnComplete: e.target.checked } 
                    })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="line-complete" className="text-xs font-bold text-slate-600 uppercase tracking-widest">แจ้งเมื่อซ่อมเสร็จ</label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 mb-8 flex items-center gap-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              ตั้งค่าการแจ้งเตือนผ่าน Email
            </h4>
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="email-enabled"
                    checked={masterData.emailConfig?.enabled || false}
                    onChange={(e) => updateEmailConfig({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                </div>
                <label htmlFor="email-enabled" className="font-bold text-slate-700">เปิดใช้งานการแจ้งเตือนผ่าน Email</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="email-urgent"
                    checked={masterData.emailConfig?.notifyUrgentOnly || false}
                    onChange={(e) => updateEmailConfig({ notifyUrgentOnly: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="email-urgent" className="text-xs font-bold text-slate-600 uppercase tracking-widest">เฉพาะงานด่วน</label>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="email-create"
                    checked={masterData.emailConfig?.notifyOnCreate ?? true}
                    onChange={(e) => updateEmailConfig({ notifyOnCreate: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="email-create" className="text-xs font-bold text-slate-600 uppercase tracking-widest">แจ้งเมื่อแจ้งซ่อม</label>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="email-complete"
                    checked={masterData.emailConfig?.notifyOnComplete ?? true}
                    onChange={(e) => updateEmailConfig({ notifyOnComplete: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-300 text-app-primary focus:ring-app-primary/20"
                  />
                  <label htmlFor="email-complete" className="text-xs font-bold text-slate-600 uppercase tracking-widest">แจ้งเมื่อซ่อมเสร็จ</label>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="retro-label">SMTP Host</label>
                  <input 
                    type="text"
                    className="retro-input"
                    placeholder="เช่น smtp.gmail.com"
                    value={masterData.emailConfig?.smtpHost || ''}
                    onChange={(e) => updateEmailConfig({ smtpHost: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="retro-label">SMTP Port</label>
                  <input 
                    type="number"
                    className="retro-input"
                    placeholder="เช่น 587 หรือ 465"
                    value={masterData.emailConfig?.smtpPort || 587}
                    onChange={(e) => updateEmailConfig({ smtpPort: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="retro-label">SMTP User (Email)</label>
                  <input 
                    type="text"
                    className="retro-input"
                    value={masterData.emailConfig?.smtpUser || ''}
                    onChange={(e) => updateEmailConfig({ smtpUser: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="retro-label">SMTP Password (App Password)</label>
                  <input 
                    type="password"
                    className="retro-input"
                    value={masterData.emailConfig?.smtpPass || ''}
                    onChange={(e) => updateEmailConfig({ smtpPass: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="retro-label">ชื่อผู้ส่ง (Display Name)</label>
                  <input 
                    type="text"
                    className="retro-input"
                    placeholder="เช่น Repair System"
                    value={masterData.emailConfig?.fromEmail || ''}
                    onChange={(e) => updateEmailConfig({ fromEmail: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="retro-label">Email ผู้รับแจ้ง (Recipient)</label>
                  <input 
                    type="email"
                    className="retro-input"
                    placeholder="เช่น admin@example.com"
                    value={masterData.emailConfig?.toEmail || ''}
                    onChange={(e) => updateEmailConfig({ toEmail: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 p-4 rounded-2xl border border-slate-100">
                💡 หากใช้ Gmail ต้องเปิดใช้งาน 2-Step Verification และสร้าง "App Password" มาใช้งาน
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                พื้นที่ / สถานที่
              </h4>
              <div className="space-y-4">
                {masterData.areas.map((area, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <input 
                      className="retro-input" 
                      value={area} 
                      onChange={(e) => {
                        const newAreas = [...masterData.areas];
                        newAreas[idx] = e.target.value;
                        setMasterData({ ...masterData, areas: newAreas });
                      }}
                    />
                    <button 
                      onClick={() => {
                        const newAreas = masterData.areas.filter((_, i) => i !== idx);
                        setMasterData({ ...masterData, areas: newAreas });
                      }}
                      className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setMasterData({ ...masterData, areas: [...masterData.areas, ''] })}
                  className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Plus size={16} /> เพิ่มพื้นที่
                </button>
              </div>
            </div>

            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-8">
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-3">
                <div className="w-2 h-2 bg-violet-500 rounded-full" />
                ประเภทงานซ่อม
              </h4>
              <div className="space-y-4">
                {masterData.types.map((type, idx) => (
                  <div key={idx} className="flex gap-3 group">
                    <input 
                      className="retro-input" 
                      value={type} 
                      onChange={(e) => {
                        const newTypes = [...masterData.types];
                        newTypes[idx] = e.target.value;
                        setMasterData({ ...masterData, types: newTypes });
                      }}
                    />
                    <button 
                      onClick={() => {
                        const newTypes = masterData.types.filter((_, i) => i !== idx);
                        setMasterData({ ...masterData, types: newTypes });
                      }}
                      className="p-3 text-rose-500 bg-rose-50 hover:bg-rose-500 hover:text-white rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setMasterData({ ...masterData, types: [...masterData.types, ''] })}
                  className="w-full py-4 bg-slate-50 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Plus size={16} /> เพิ่มประเภท
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-4">
            <button 
              onClick={saveMasterData} 
              className="px-12 py-5 bg-app-primary hover:bg-blue-600 text-white font-extrabold rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-3 uppercase tracking-widest"
            >
              <Save size={20} />
              <span>บันทึกการตั้งค่าทั้งหมด</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white p-20 rounded-[3rem] border border-slate-100 shadow-sm text-center space-y-10">
          <div className="bg-blue-50 w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner">
            <FileSpreadsheet size={64} className="text-app-primary" />
          </div>
          <div className="max-w-xl mx-auto space-y-4">
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">ส่งออกข้อมูลการแจ้งซ่อม</h3>
            <p className="text-slate-500 font-medium leading-relaxed">ดาวน์โหลดข้อมูลทั้งหมดในรูปแบบไฟล์ CSV เพื่อนำไปวิเคราะห์ผลใน Excel หรือ Google Sheets ได้อย่างง่ายดาย</p>
          </div>
          
          <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 max-w-md mx-auto space-y-8">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
              <span className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Total Records</span>
              <span className="text-2xl font-black text-app-primary">{requests.length}</span>
            </div>
            <button 
              onClick={downloadCSV}
              className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest"
            >
              <Download size={20} />
              <span className="text-lg">ดาวน์โหลดไฟล์ CSV</span>
            </button>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            * ไฟล์ที่ดาวน์โหลดจะรองรับภาษาไทย (UTF-8 with BOM) สามารถเปิดใน Excel ได้ทันที
          </p>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
          <div className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight uppercase">แก้ไขข้อมูลผู้ใช้งาน</h3>
              <button 
                onClick={() => setEditingUser(null)} 
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
              >
                <Trash2 size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="retro-label text-[10px]">ชื่อ-นามสกุล</label>
                <input 
                  type="text"
                  className="retro-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="retro-label text-[10px]">รหัสพนักงาน</label>
                <input 
                  type="text"
                  className="retro-input"
                  value={editForm.employeeId}
                  onChange={(e) => setEditForm({ ...editForm, employeeId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="retro-label text-[10px]">กะการทำงาน</label>
                <select 
                  className="retro-input"
                  value={editForm.shift}
                  onChange={(e) => setEditForm({ ...editForm, shift: e.target.value })}
                >
                  <option value="">เลือกกะ...</option>
                  <option value="A">กะ A</option>
                  <option value="B">กะ B</option>
                  <option value="C">กะ C</option>
                  <option value="Office">Office</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-4">
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={handleUpdateUser}
                  className="flex-1 py-4 bg-app-primary text-white font-bold rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
