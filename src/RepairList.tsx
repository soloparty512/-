import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from './firebase';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, Timestamp, deleteDoc, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { useAuth } from './AuthContext';
import { RepairRequest, MasterData, UserProfile } from './types';
import { format, isSameDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertCircle, XCircle, ChevronRight, User, MapPin, Settings, Camera, Image as ImageIcon, Check, Trash2, Calendar as CalendarIcon, List, Home, ArrowLeft, Wrench, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { compressImage } from './lib/imageUtils';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

interface RepairListProps {
  onNavigate?: (tab: string) => void;
  initialView?: 'list' | 'calendar';
}

const RepairList: React.FC<RepairListProps> = ({ onNavigate, initialView = 'list' }) => {
  const { profile } = useAuth();
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RepairRequest | null>(null);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null);
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in-progress' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialView);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [supervisorName, setSupervisorName] = useState('');
  const [repairAction, setRepairAction] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [technicians, setTechnicians] = useState<UserProfile[]>([]);
  const [assignedTechId, setAssignedTechId] = useState('');
  const [assignedTechName, setAssignedTechName] = useState('');
  const [repairType, setRepairType] = useState('');
  const [failureCause, setFailureCause] = useState('');

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  useEffect(() => {
    if (!profile) return;

    let q = query(collection(db, 'repair_requests'), orderBy('timestamp', 'desc'));

    // Filter based on role
    if (profile.role === 'user') {
      q = query(collection(db, 'repair_requests'), where('requesterEmail', '==', profile.email), orderBy('timestamp', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RepairRequest));
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'repair_requests');
    });

    return () => unsubscribe();
  }, [profile]);

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const docRef = doc(db, 'master_data', 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMasterData(docSnap.data() as MasterData);
        }
      } catch (error) {
        console.error('Error fetching master data:', error);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    const fetchTechnicians = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', 'in', ['staff', 'admin', 'manager']));
        const snapshot = await getDocs(q);
        const techList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
        setTechnicians(techList);
      } catch (error) {
        console.error('Error fetching technicians:', error);
      }
    };
    fetchTechnicians();
  }, []);

  useEffect(() => {
    if (selectedRequest?.status === 'pending' && profile) {
      setAssignedTechId(profile.uid);
      setAssignedTechName(profile.name);
    }
  }, [selectedRequest, profile]);

  const filteredRequests = requests.filter(req => {
    if (viewMode === 'calendar') {
      return isSameDay(req.timestamp.toDate(), selectedDate);
    }
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const getRequestsForDate = (date: Date) => {
    return requests.filter(req => isSameDay(req.timestamp.toDate(), date));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="bg-yellow-100 text-yellow-800 border-2 border-yellow-800 px-2 py-1 text-xs font-bold uppercase">รอรับงาน</span>;
      case 'in-progress': return <span className="bg-blue-100 text-blue-800 border-2 border-blue-800 px-2 py-1 text-xs font-bold uppercase">กำลังดำเนินการ</span>;
      case 'completed': return <span className="bg-green-100 text-green-800 border-2 border-green-800 px-2 py-1 text-xs font-bold uppercase">เสร็จสิ้น</span>;
      case 'cancelled': return <span className="bg-red-100 text-red-800 border-2 border-red-800 px-2 py-1 text-xs font-bold uppercase">ยกเลิก</span>;
      default: return null;
    }
  };

  const handleAfterPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAfterPhoto(file);
      setAfterPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleUpdateStatus = async (requestId: string, newStatus: string, additionalData: any = {}) => {
    setUpdateLoading(true);
    try {
      const docRef = doc(db, 'repair_requests', requestId);
      const updateData: any = { status: newStatus, ...additionalData };
      
      if (newStatus === 'in-progress' && !selectedRequest?.startTime) {
        updateData.startTime = Timestamp.now();
      }
      
      if (newStatus === 'completed') {
        updateData.endTime = Timestamp.now();
        if (afterPhoto) {
          const compressedBlob = await compressImage(afterPhoto);
          const storageRef = ref(storage, `repairs/after_${Date.now()}_${afterPhoto.name}`);
          const snapshot = await uploadBytes(storageRef, compressedBlob);
          const photoUrl = await getDownloadURL(snapshot.ref);
          updateData.afterPhoto = photoUrl;
        }
      }

      await updateDoc(docRef, updateData);

      // Send Notifications in the background (non-blocking)
      if (newStatus === 'completed' && selectedRequest) {
        (async () => {
          const lineConfig = masterData?.lineConfig || { token: masterData?.lineToken || '', enabled: !!masterData?.lineToken, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true };
          
          // LINE Notification
          if (lineConfig.enabled && lineConfig.token && lineConfig.notifyOnComplete) {
            const shouldNotify = !lineConfig.notifyUrgentOnly || selectedRequest.urgency === 'urgent';
            if (shouldNotify) {
              const message = `\n✅ งานซ่อมเสร็จสิ้น!\n🛠 เครื่องจักร: ${selectedRequest.machineName}\n📍 พื้นที่: ${selectedRequest.area}\n📝 วิธีแก้ไข: ${additionalData.repairAction || 'แก้ไขเรียบร้อย'}\n👤 ช่าง: ${profile?.name}\n🕒 เวลาเสร็จ: ${new Date().toLocaleString('th-TH')}`;
              try {
                fetch('/api/notify', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ message, token: lineConfig.token }),
                }).catch(err => console.error('Background LINE notification error:', err));
              } catch (err) {
                console.error('Failed to initiate LINE notification:', err);
              }
            }
          }

          // Email Notification
          if (masterData?.emailConfig?.enabled && masterData.emailConfig.notifyOnComplete) {
            const shouldNotify = !masterData.emailConfig.notifyUrgentOnly || selectedRequest.urgency === 'urgent';
            if (shouldNotify) {
              const subject = `[ซ่อมเสร็จสิ้น] ${selectedRequest.machineName} - ${selectedRequest.area}`;
              const text = `งานซ่อมเสร็จสิ้นเรียบร้อยแล้ว\nเครื่องจักร: ${selectedRequest.machineName}\nพื้นที่: ${selectedRequest.area}\nวิธีแก้ไข: ${additionalData.repairAction || 'แก้ไขเรียบร้อย'}\nช่างผู้ซ่อม: ${profile?.name}\nเวลาเสร็จสิ้น: ${new Date().toLocaleString('th-TH')}`;
              const html = `
                <div style="font-family: sans-serif; padding: 20px; border: 2px solid #16a34a;">
                  <h2 style="color: #16a34a; text-transform: uppercase;">งานซ่อมเสร็จสิ้นเรียบร้อยแล้ว</h2>
                  <hr style="border: 1px solid #e2e8f0;" />
                  <p><strong>เครื่องจักร:</strong> ${selectedRequest.machineName}</p>
                  <p><strong>พื้นที่:</strong> ${selectedRequest.area}</p>
                  <p><strong>วิธีแก้ไข:</strong> ${additionalData.repairAction || 'แก้ไขเรียบร้อย'}</p>
                  <p><strong>ช่างผู้ซ่อม:</strong> ${profile?.name}</p>
                  <p><strong>เวลาเสร็จสิ้น:</strong> ${new Date().toLocaleString('th-TH')}</p>
                  ${updateData.afterPhoto ? `<p><strong>รูปภาพหลังซ่อม:</strong> <br/><img src="${updateData.afterPhoto}" style="max-width: 100%; border: 1px solid #ccc;" /></p>` : ''}
                </div>
              `;
              try {
                fetch('/api/email', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ subject, text, html, config: masterData.emailConfig }),
                }).catch(err => console.error('Background Email notification error:', err));
              } catch (err) {
                console.error('Failed to initiate Email notification:', err);
              }
            }
          }
        })();
      }

      setSelectedRequest(null);
      setAfterPhoto(null);
      setAfterPhotoPreview(null);
      setSupervisorName('');
      setRepairAction('');
      setRepairType('');
      setFailureCause('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'repair_requests');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeleteRequest = async (request: RepairRequest) => {
    setUpdateLoading(true);
    try {
      // Delete photos from storage if they exist
      if (request.beforePhoto) {
        try {
          const beforeRef = ref(storage, request.beforePhoto);
          await deleteObject(beforeRef);
        } catch (e) {
          console.error('Error deleting before photo:', e);
        }
      }
      if (request.afterPhoto) {
        try {
          const afterRef = ref(storage, request.afterPhoto);
          await deleteObject(afterRef);
        } catch (e) {
          console.error('Error deleting after photo:', e);
        }
      }

      // Delete document from Firestore
      await deleteDoc(doc(db, 'repair_requests', request.id));
      setSelectedRequest(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'repair_requests');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) return <div className="text-center py-20 font-bold animate-pulse">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="space-y-8">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onNavigate?.('home')}
            className="p-3 bg-white hover:bg-slate-50 border border-app-border rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
            title="หน้าแรก"
          >
            <Home className="w-5 h-5 shrink-0 text-slate-600" />
          </button>
          <button 
            onClick={() => onNavigate?.('home')}
            className="p-3 bg-white hover:bg-slate-50 border border-app-border rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
            title="ย้อนกลับ"
          >
            <ArrowLeft className="w-5 h-5 shrink-0 text-slate-600" />
          </button>
          <div className="h-10 w-[1px] bg-app-border mx-2 hidden md:block" />
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
            {viewMode === 'list' ? 'รายการแจ้งซ่อม' : 'ปฏิทินงานซ่อม'}
          </h2>
        </div>

        <div className="flex bg-white p-1.5 rounded-2xl border border-app-border shadow-sm">
          <button 
            onClick={() => setViewMode('list')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              viewMode === 'list' ? 'bg-app-primary text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List size={18} />
            <span>รายการ</span>
          </button>
          <button 
            onClick={() => setViewMode('calendar')}
            className={`flex-1 md:flex-none px-6 py-2 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              viewMode === 'calendar' ? 'bg-app-primary text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <CalendarIcon size={18} />
            <span>ปฏิทิน</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'pending', 'in-progress', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest border transition-all ${
                  filter === f 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                  : 'bg-white text-slate-500 border-app-border hover:border-slate-400'
                }`}
              >
                {f === 'all' ? 'ทั้งหมด' : 
                 f === 'pending' ? 'รอดำเนินการ' : 
                 f === 'in-progress' ? 'กำลังซ่อม' : 'เสร็จสิ้น'}
              </button>
            ))}
          </div>

          {/* List View */}
          <div className="grid grid-cols-1 gap-4">
            {filteredRequests.map(req => (
              <div 
                key={req.id} 
                onClick={() => setSelectedRequest(req)}
                className="group bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col md:flex-row md:items-center gap-6"
              >
                <div className="flex-shrink-0 w-full md:w-32 h-24 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 relative">
                  {req.beforePhoto ? (
                    <img src={req.beforePhoto} alt="Machine" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Wrench size={32} />
                    </div>
                  )}
                  {req.urgency === 'urgent' && (
                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-rose-500 text-white text-[8px] font-black rounded-md uppercase tracking-tighter">URGENT</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`badge ${
                      req.status === 'pending' ? 'badge-pending' : 
                      req.status === 'in-progress' ? 'badge-progress' : 'badge-completed'
                    }`}>
                      {req.status === 'pending' ? 'รอดำเนินการ' : 
                       req.status === 'in-progress' ? 'กำลังซ่อม' : 'เสร็จสิ้น'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">ID: {req.id.slice(-6)}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 truncate mb-1">{req.machineName}</h3>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span>{req.building ? `${req.building} • ` : ''}{req.area}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-slate-400 shrink-0" />
                      <span>{req.requesterName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400 shrink-0" />
                      <span>{format(req.timestamp.toDate(), 'd MMM yy HH:mm', { locale: th })}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">ปัญหาที่พบ</p>
                    <p className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{req.problem}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg group-hover:bg-app-primary group-hover:text-white transition-colors">
                    <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            ))}
            
            {filteredRequests.length === 0 && (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <ClipboardList size={32} className="text-slate-300" />
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">ไม่พบรายการแจ้งซ่อม</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <Calendar 
                onChange={(date) => setSelectedDate(date as Date)} 
                value={selectedDate}
                locale="th-TH"
                className="w-full border-none font-sans"
                tileContent={({ date, view }) => {
                  if (view === 'month') {
                    const dayRequests = getRequestsForDate(date);
                    if (dayRequests.length > 0) {
                      const hasUrgent = dayRequests.some(r => r.urgency === 'urgent');
                      return (
                        <div className="flex justify-center mt-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${hasUrgent ? 'bg-rose-500 animate-pulse' : 'bg-app-primary'}`} />
                        </div>
                      );
                    }
                  }
                  return null;
                }}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
              <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-2">รายการประจำวันที่</h4>
              <p className="text-xl font-bold">{format(selectedDate, 'd MMMM yyyy', { locale: th })}</p>
            </div>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
              {filteredRequests.map(req => (
                <div 
                  key={req.id} 
                  onClick={() => setSelectedRequest(req)}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`badge ${
                      req.status === 'pending' ? 'badge-pending' : 
                      req.status === 'in-progress' ? 'badge-progress' : 'badge-completed'
                    }`}>
                      {req.status === 'pending' ? 'รอดำเนินการ' : 
                       req.status === 'in-progress' ? 'กำลังซ่อม' : 'เสร็จสิ้น'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{format(req.timestamp.toDate(), 'HH:mm')}</span>
                  </div>
                  <h5 className="font-bold text-slate-900 group-hover:text-app-primary transition-colors">{req.machineName}</h5>
                  <p className="text-xs text-slate-500 truncate">{req.problem}</p>
                </div>
              ))}
              {filteredRequests.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold italic text-sm">
                  ไม่มีรายการในวันนี้
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white max-w-4xl w-full max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl shadow-lg ${
                  selectedRequest.urgency === 'urgent' ? 'bg-rose-500 text-white' : 'bg-app-primary text-white'
                }`}>
                  <Wrench size={28} className="shrink-0" />
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{selectedRequest.machineName}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`badge ${
                      selectedRequest.status === 'pending' ? 'badge-pending' : 
                      selectedRequest.status === 'in-progress' ? 'badge-progress' : 'badge-completed'
                    }`}>
                      {selectedRequest.status === 'pending' ? 'รอดำเนินการ' : 
                       selectedRequest.status === 'in-progress' ? 'กำลังซ่อม' : 'เสร็จสิ้น'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">ID: {selectedRequest.id}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedRequest(null)} 
                className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-100"
              >
                <XCircle size={24} className="shrink-0" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-8">
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">ข้อมูลผู้แจ้ง</h4>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center font-bold text-slate-400 border border-slate-100">
                          {selectedRequest.requesterName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{selectedRequest.requesterName}</p>
                          <p className="text-xs text-slate-500">รหัส: {selectedRequest.requesterId} | กะ: {selectedRequest.requesterShift}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/50">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">อาคาร / พื้นที่</p>
                          <p className="text-sm font-bold text-slate-700">{selectedRequest.building ? `${selectedRequest.building} - ` : ''}{selectedRequest.area}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">วันเวลาที่แจ้ง</p>
                          <p className="text-sm font-bold text-slate-700">{format(selectedRequest.timestamp.toDate(), 'd MMM yy HH:mm', { locale: th })}</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">รายละเอียดปัญหา</h4>
                    <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 text-amber-900 italic font-medium leading-relaxed">
                      "{selectedRequest.problem}"
                    </div>
                  </section>

                  {selectedRequest.beforePhoto && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">รูปภาพอาการเสีย</h4>
                      <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-lg">
                        <img 
                          src={selectedRequest.beforePhoto} 
                          alt="Before" 
                          className="w-full h-64 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-8">
                  <section>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">สถานะการดำเนินการ</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                        <span className="text-sm font-bold text-slate-500">ความเร่งด่วน</span>
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                          selectedRequest.urgency === 'urgent' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>
                          {selectedRequest.urgency === 'urgent' ? 'ด่วนมาก' : 'ปกติ'}
                        </span>
                      </div>
                      {selectedRequest.repairType && (
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                          <span className="text-sm font-bold text-slate-500">ประเภทงาน</span>
                          <span className="text-sm font-bold text-slate-700">{selectedRequest.repairType}</span>
                        </div>
                      )}
                      {selectedRequest.startTime && (
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                          <span className="text-sm font-bold text-slate-500">เริ่มดำเนินการ</span>
                          <span className="text-sm font-bold text-blue-600">{format(selectedRequest.startTime.toDate(), 'HH:mm น.')}</span>
                        </div>
                      )}
                      {selectedRequest.endTime && (
                        <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100">
                          <span className="text-sm font-bold text-slate-500">เสร็จสิ้นเมื่อ</span>
                          <span className="text-sm font-bold text-emerald-600">{format(selectedRequest.endTime.toDate(), 'HH:mm น.')}</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {selectedRequest.technicianName && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">ผู้รับผิดชอบ</h4>
                      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="w-10 h-10 bg-app-primary/10 rounded-xl flex items-center justify-center text-app-primary">
                          <User size={20} className="shrink-0" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{selectedRequest.technicianName}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</p>
                        </div>
                      </div>
                    </section>
                  )}

                  {selectedRequest.failureCause && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">สาเหตุที่พบ</h4>
                      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-slate-700 font-medium text-sm">
                        {selectedRequest.failureCause}
                      </div>
                    </section>
                  )}

                  {selectedRequest.repairAction && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">การแก้ไข</h4>
                      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 text-emerald-900 font-bold text-sm">
                        {selectedRequest.repairAction}
                      </div>
                    </section>
                  )}

                  {selectedRequest.afterPhoto && (
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">รูปภาพหลังการซ่อม</h4>
                      <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-lg">
                        <img 
                          src={selectedRequest.afterPhoto} 
                          alt="After" 
                          className="w-full h-64 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </section>
                  )}
                </div>
              </div>

              {/* Technician Actions */}
              {(profile?.role === 'staff' || profile?.role === 'admin' || profile?.role === 'manager') && (
                <div className="mt-12 pt-12 border-t border-slate-100">
                  <h4 className="text-lg font-extrabold text-slate-900 mb-6 flex items-center gap-2 uppercase tracking-tight">
                    <Settings className="text-app-primary shrink-0" />
                    การจัดการงานซ่อม
                  </h4>
                  
                  {selectedRequest.status === 'pending' && (
                    <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <div>
                        <label className="retro-label">เลือกช่างผู้รับผิดชอบ</label>
                        <select 
                          className="retro-input"
                          value={assignedTechId}
                          onChange={(e) => {
                            const tech = technicians.find(t => t.uid === e.target.value);
                            setAssignedTechId(e.target.value);
                            setAssignedTechName(tech?.name || '');
                          }}
                        >
                          <option value="">-- เลือกช่าง --</option>
                          {technicians.map(tech => (
                            <option key={tech.uid} value={tech.uid}>
                              {tech.name} ({tech.employeeId || 'ไม่มีรหัส'})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="retro-label">ประเภทงานซ่อม</label>
                        <select 
                          className="retro-input"
                          value={repairType}
                          onChange={(e) => setRepairType(e.target.value)}
                        >
                          <option value="">-- เลือกประเภท --</option>
                          {masterData?.types.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {selectedRequest.status === 'in-progress' && (
                    <div className="mb-8 space-y-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="retro-label">ชื่อผู้ตรวจสอบการซ่อม (Supervisor)</label>
                          <input 
                            type="text"
                            className="retro-input"
                            placeholder="ระบุชื่อผู้ตรวจสอบ..."
                            value={supervisorName}
                            onChange={(e) => setSupervisorName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="retro-label">สาเหตุของปัญหา</label>
                          <input 
                            className="retro-input"
                            placeholder="ระบุสาเหตุที่พบ..."
                            value={failureCause}
                            onChange={(e) => setFailureCause(e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="retro-label">วิธีแก้ไข / การดำเนินการ</label>
                          <textarea 
                            className="retro-input"
                            rows={2}
                            placeholder="ระบุวิธีแก้ไขที่ดำเนินการ..."
                            value={repairAction}
                            onChange={(e) => setRepairAction(e.target.value)}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="retro-label">อัปโหลดรูปภาพหลังซ่อม</label>
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-white rounded-3xl p-8 space-y-4 transition-all hover:border-app-primary group/upload">
                          {afterPhotoPreview ? (
                            <div className="relative">
                              <img src={afterPhotoPreview} alt="After Preview" className="max-h-48 rounded-2xl border border-slate-100 shadow-lg" />
                              <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-2 border-4 border-white shadow-lg">
                                <Check size={16} />
                              </div>
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 group-hover/upload:text-app-primary group-hover/upload:bg-app-primary/5 transition-all">
                              <Camera size={32} className="shrink-0" />
                            </div>
                          )}
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            id="after-photo-upload" 
                            onChange={handleAfterPhotoChange}
                          />
                          <label htmlFor="after-photo-upload" className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-800 transition-all uppercase tracking-widest">
                            {afterPhotoPreview ? 'เปลี่ยนรูปภาพ' : 'เลือกไฟล์รูปภาพ'}
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-4">
                    {selectedRequest.status === 'pending' && (
                      <button 
                        disabled={updateLoading || (!assignedTechId && !assignedTechName)}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'in-progress', { 
                          technicianName: assignedTechName || 'Unknown', 
                          technicianId: assignedTechId || 'no-id',
                          repairType: repairType || 'ทั่วไป'
                        })}
                        className="flex-1 retro-button-primary py-4"
                      >
                        {updateLoading ? 'กำลังดำเนินการ...' : 'รับงานซ่อม'}
                      </button>
                    )}
                    {selectedRequest.status === 'in-progress' && (
                      <button 
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'completed', { 
                          repairAction: repairAction || 'แก้ไขเรียบร้อย',
                          failureCause: failureCause || 'เสื่อมสภาพตามการใช้งาน',
                          supervisorName: supervisorName || 'ยังไม่ได้ระบุ'
                        })}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                      >
                        {updateLoading ? 'กำลังบันทึก...' : 'ปิดงานซ่อม'}
                      </button>
                    )}
                    {['pending', 'in-progress'].includes(selectedRequest.status) && (
                      <button 
                        disabled={updateLoading}
                        onClick={() => handleUpdateStatus(selectedRequest.id, 'cancelled')}
                        className="px-8 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-bold py-4 rounded-2xl transition-all active:scale-95"
                      >
                        ยกเลิกงาน
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {profile?.role === 'admin' && (
                <div className="mt-12 pt-12 border-t border-slate-100">
                  <button 
                    type="button"
                    disabled={updateLoading}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full py-4 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                  >
                    <Trash2 size={18} />
                    {updateLoading ? 'กำลังลบ...' : 'ลบรายการแจ้งซ่อมนี้'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 z-[100]">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white max-w-md w-full p-10 rounded-[2.5rem] shadow-2xl border border-slate-100"
          >
            <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            
            <h3 className="text-2xl font-extrabold text-slate-900 text-center mb-4 tracking-tight">ยืนยันการลบข้อมูล?</h3>
            
            <p className="text-slate-500 text-center mb-8 leading-relaxed">
              คุณแน่ใจหรือไม่ว่าต้องการลบรายการของ <span className="font-bold text-slate-900 underline decoration-rose-500 decoration-2">{selectedRequest.machineName}</span>? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
            
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                disabled={updateLoading}
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => handleDeleteRequest(selectedRequest)}
                className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all active:scale-95"
                disabled={updateLoading}
              >
                {updateLoading ? 'กำลังลบ...' : 'ยืนยันการลบ'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RepairList;
