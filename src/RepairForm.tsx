import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from './firebase';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from './AuthContext';
import { RepairRequest, MasterData, Urgency } from './types';
import { Camera, Send, Wrench, Check, Home, ArrowLeft } from 'lucide-react';
import { compressImage } from './lib/imageUtils';

import { motion } from 'motion/react';

const RepairForm: React.FC<{ onSuccess: () => void, onNavigate?: (tab: string) => void }> = ({ onSuccess, onNavigate }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [masterData, setMasterData] = useState<MasterData | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    machineName: '',
    currentTask: '',
    problem: '',
    area: '',
    urgency: 'normal' as Urgency,
    employeeId: profile?.employeeId || '',
    shift: profile?.shift || '',
  });

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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      let photoUrl = '';
      if (photo) {
        const compressedBlob = await compressImage(photo);
        const storageRef = ref(storage, `repairs/before_${Date.now()}_${photo.name}`);
        const snapshot = await uploadBytes(storageRef, compressedBlob);
        photoUrl = await getDownloadURL(snapshot.ref);
      }

      const newRequest: Partial<RepairRequest> = {
        timestamp: Timestamp.now(),
        requesterName: profile.name || 'Unknown',
        requesterId: formData.employeeId || 'no-id',
        requesterEmail: profile.email || '',
        requesterShift: formData.shift || 'no-shift',
        machineName: formData.machineName || '',
        currentTask: formData.currentTask || '',
        problem: formData.problem || '',
        area: formData.area || '',
        urgency: formData.urgency || 'normal',
        status: 'pending',
        beforePhoto: photoUrl || '',
      };

      await addDoc(collection(db, 'repair_requests'), newRequest);

      // Send notifications in the background (non-blocking)
      (async () => {
        // Send LINE Notification if enabled
        const lineConfig = masterData?.lineConfig || { token: masterData?.lineToken || '', enabled: !!masterData?.lineToken, notifyUrgentOnly: false, notifyOnCreate: true, notifyOnComplete: true };
        
        if (lineConfig.enabled && lineConfig.token && lineConfig.notifyOnCreate) {
          const shouldNotify = !lineConfig.notifyUrgentOnly || formData.urgency === 'urgent';
          
          if (shouldNotify) {
            const message = `\n🚨 มีงานแจ้งซ่อมใหม่!\n🛠 เครื่องจักร: ${formData.machineName}\n📍 พื้นที่: ${formData.area}\n⚠️ ปัญหา: ${formData.problem}\n👤 ผู้แจ้ง: ${profile.name}\n🕒 เวลา: ${new Date().toLocaleString('th-TH')}`;
            
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

        // Send Email Notification if enabled
        if (masterData?.emailConfig?.enabled && masterData.emailConfig.notifyOnCreate) {
          const shouldNotify = !masterData.emailConfig.notifyUrgentOnly || formData.urgency === 'urgent';
          
          if (shouldNotify) {
            const subject = `[แจ้งซ่อมใหม่] ${formData.machineName} - ${formData.area}`;
            const text = `มีการแจ้งซ่อมใหม่\nเครื่องจักร: ${formData.machineName}\nพื้นที่: ${formData.area}\nปัญหา: ${formData.problem}\nผู้แจ้ง: ${profile.name}\nความเร่งด่วน: ${formData.urgency === 'urgent' ? 'ด่วน' : 'ปกติ'}`;
            const html = `
              <div style="font-family: sans-serif; padding: 20px; border: 2px solid #334155;">
                <h2 style="color: #2563eb; text-transform: uppercase;">มีการแจ้งซ่อมใหม่</h2>
                <hr style="border: 1px solid #e2e8f0;" />
                <p><strong>เครื่องจักร:</strong> ${formData.machineName}</p>
                <p><strong>พื้นที่:</strong> ${formData.area}</p>
                <p><strong>ปัญหา:</strong> ${formData.problem}</p>
                <p><strong>ผู้แจ้ง:</strong> ${profile.name} (${formData.employeeId})</p>
                <p><strong>กะ:</strong> ${formData.shift}</p>
                <p><strong>ความเร่งด่วน:</strong> <span style="color: ${formData.urgency === 'urgent' ? '#dc2626' : '#16a34a'}; font-weight: bold;">${formData.urgency === 'urgent' ? 'ด่วน' : 'ปกติ'}</span></p>
                <p><strong>เวลา:</strong> ${new Date().toLocaleString('th-TH')}</p>
                ${photoUrl ? `<p><strong>รูปภาพ:</strong> <br/><img src="${photoUrl}" style="max-width: 100%; border: 1px solid #ccc;" /></p>` : ''}
              </div>
            `;

            try {
              fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  subject, 
                  text, 
                  html, 
                  config: masterData.emailConfig 
                }),
              }).catch(err => console.error('Background Email notification error:', err));
            } catch (err) {
              console.error('Failed to initiate Email notification:', err);
            }
          }
        }
      })();

      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'repair_requests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Navigation Buttons */}
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
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white max-w-3xl mx-auto rounded-[2.5rem] shadow-2xl shadow-blue-500/5 border border-slate-100 overflow-hidden"
      >
        <div className="p-10 border-b border-slate-100 bg-slate-50/50 flex items-center gap-6">
          <div className="bg-app-primary p-4 rounded-2xl text-white shadow-lg shadow-blue-500/20">
            <Wrench size={28} />
          </div>
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight uppercase">แบบฟอร์มแจ้งซ่อม</h2>
            <p className="text-slate-500 font-medium">กรุณากรอกรายละเอียดให้ครบถ้วนเพื่อความรวดเร็วในการดำเนินการ</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="retro-label">ชื่อเครื่องจักร / อุปกรณ์</label>
              <input
                required
                type="text"
                className="retro-input"
                placeholder="เช่น เครื่องจักร A-01"
                value={formData.machineName}
                onChange={e => setFormData({ ...formData, machineName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="retro-label">พื้นที่ / สถานที่</label>
              <select
                required
                className="retro-input"
                value={formData.area}
                onChange={e => setFormData({ ...formData, area: e.target.value })}
              >
                <option value="">เลือกพื้นที่</option>
                {masterData?.areas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
                {!masterData && <option value="Production Line 1">Production Line 1</option>}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="retro-label">งานที่เครื่องจักรทำงานอยู่</label>
            <input
              type="text"
              className="retro-input"
              placeholder="ระบุชื่อโปรเจกต์หรือรหัสงาน"
              value={formData.currentTask}
              onChange={e => setFormData({ ...formData, currentTask: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="retro-label">ปัญหาที่พบ / อาการเสีย</label>
            <textarea
              required
              rows={4}
              className="retro-input"
              placeholder="อธิบายอาการเสียอย่างละเอียด..."
              value={formData.problem}
              onChange={e => setFormData({ ...formData, problem: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label className="retro-label">รหัสพนักงาน</label>
              <input
                required
                type="text"
                className="retro-input"
                value={formData.employeeId}
                onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="retro-label">กะการทำงาน</label>
              <select
                required
                className="retro-input"
                value={formData.shift}
                onChange={e => setFormData({ ...formData, shift: e.target.value })}
              >
                <option value="">เลือกกะ</option>
                <option value="A">กะ A (เช้า)</option>
                <option value="B">กะ B (บ่าย)</option>
                <option value="C">กะ C (ดึก)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="retro-label">ระดับความเร่งด่วน</label>
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'normal' })}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    formData.urgency === 'normal' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:bg-white'
                  }`}
                >
                  ปกติ
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, urgency: 'urgent' })}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                    formData.urgency === 'urgent' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:bg-white'
                  }`}
                >
                  ด่วน
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <label className="retro-label">อัปโหลดรูปภาพอาการเสีย (ถ้ามี)</label>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 bg-slate-50/50 rounded-[2rem] p-10 space-y-4 transition-all hover:border-app-primary group/upload">
              {photoPreview ? (
                <div className="relative">
                  <img src={photoPreview} alt="Preview" className="max-h-48 rounded-2xl border border-slate-100 shadow-xl" />
                  <div className="absolute -top-3 -right-3 bg-emerald-500 text-white rounded-full p-2 border-4 border-white shadow-lg">
                    <Check size={16} />
                  </div>
                </div>
              ) : (
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-slate-300 group-hover/upload:text-app-primary group-hover/upload:bg-app-primary/5 transition-all shadow-sm">
                  <Camera size={32} />
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                id="photo-upload" 
                onChange={handlePhotoChange}
              />
              <label htmlFor="photo-upload" className="px-8 py-3 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-800 transition-all uppercase tracking-widest shadow-lg">
                {photoPreview ? 'เปลี่ยนรูปภาพ' : 'เลือกไฟล์รูปภาพ'}
              </label>
            </div>
          </div>

          <button
            disabled={loading}
            type="submit"
            className="w-full bg-app-primary hover:bg-blue-600 text-white font-extrabold py-5 rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 uppercase tracking-widest"
          >
            {loading ? (
              <span className="animate-pulse">กำลังส่งข้อมูล...</span>
            ) : (
              <>
                <Send size={20} />
                <span className="text-lg">ส่งข้อมูลแจ้งซ่อม</span>
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default RepairForm;
