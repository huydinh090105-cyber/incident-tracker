import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,                   
  onAuthStateChanged,
  signInWithCustomToken,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  writeBatch,
  getDocs, 
  where
} from 'firebase/firestore';
import { 
  AlertTriangle, CheckCircle, Clock, Camera, User, 
  MoreHorizontal, Filter, Plus, ChevronLeft, Activity, 
  Save, X, LayoutGrid, List, Database, MapPin, 
  Repeat, BarChart2, Phone, Calendar, MessageSquare,
  Lock, LogOut, UserCheck, Mail, RefreshCw, Copy, Layers,
  Aperture, Upload, Eye, PieChart, TrendingUp, AlertOctagon,
  Timer, Shield, ShieldAlert, Key, Settings, UserCog, Edit3,
  Send, History, MessageCircle, HelpCircle, BookOpen
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATION LAYER
// ==========================================

// --- CẤU HÌNH (SANDBOX ENVIRONMENT) ---
const firebaseConfig = {
  apiKey: "AIzaSyBxOcR7j53VOT4Uh-yjel6luVOjOtxNw5o",
  authDomain: "incident-tracker-f9651.firebaseapp.com",
  projectId: "incident-tracker-f9651",
  storageBucket: "incident-tracker-f9651.firebasestorage.app",
  messagingSenderId: "320586095896",
  appId: "1:320586095896:web:3e3ee4044206872617926d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==========================================
// 2. BACKUP DATA (DỮ LIỆU DỰ PHÒNG)
// ==========================================
const BACKUP_PROFILES = [
  { email: 'admin@demo.com', name: 'Nguyễn Quản Lý', role: 'MANAGER', phone: '0909000111', title: 'Quản lý dự án' },
  { email: 'tech@demo.com', name: 'Trần Kỹ Thuật', role: 'TECH', phone: '0912333444', title: 'Kỹ thuật viên' },
  { email: 'user@demo.com', name: 'Lê Nhân Viên', role: 'USER', phone: '0988777666', title: 'Nhân viên văn phòng' }
];

const INITIAL_PROJECTS = [
  { name: 'Dự án Alpha', areas: ['Sảnh chính', 'Phòng Server', 'Khu văn phòng Tầng 2', 'Khu Pantry', 'Hầm xe'] },
  { name: 'Dự án Beta', areas: ['Phòng họp lớn', 'Phòng họp nhỏ', 'Khu lễ tân', 'Hành lang'] },
  { name: 'Tòa nhà Center Point', areas: ['Thang máy A', 'Thang máy B', 'Hệ thống lạnh trung tâm', 'Tầng thượng'] },
  { name: 'Kho vận Logistic', areas: ['Cổng nhập hàng', 'Kho lạnh A', 'Kho mát B', 'Khu đóng gói'] }
];

// ==========================================
// 3. SERVICE LAYER
// ==========================================
const IncidentService = {
  getUserProfile: async (email) => {
    try {
        const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/users` : 'users';
        const q = query(collection(db, path), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) return querySnapshot.docs[0].data();
        return BACKUP_PROFILES.find(p => p.email === email) || null;
    } catch (e) {
        console.error("Lỗi lấy profile:", e);
        return BACKUP_PROFILES.find(p => p.email === email) || null;
    }
  },

  updateUserProfile: async (email, data) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/users` : 'users';
    const q = query(collection(db, path), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
        const docRef = doc(db, path, querySnapshot.docs[0].id);
        await updateDoc(docRef, data);
        return true;
    }
    return false;
  },

  seedUserProfiles: async () => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/users` : 'users';
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
        const batch = writeBatch(db);
        BACKUP_PROFILES.forEach(profile => {
            const docRef = doc(collection(db, path)); 
            batch.set(docRef, profile);
        });
        await batch.commit();
        return true;
    }
    return false;
  },

  subscribeToProjects: (onData) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/projects` : 'projects';
    const q = query(collection(db, path));
    return onSnapshot(q, (snapshot) => {
      const projects = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.name) {
            projects[data.name] = data.areas || [];
        }
      });
      onData(projects);
    });
  },

  seedProjects: async () => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/projects` : 'projects';
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_PROJECTS.forEach(proj => {
            const docRef = doc(collection(db, path));
            batch.set(docRef, proj);
        });
        await batch.commit();
    }
  },

  subscribeToIncidents: (onData, onError) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    const q = query(collection(db, path));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      onData(data);
    }, onError);
  },

  // --- ACTIVITY LOGS & COMMENTS ---
  subscribeToActivities: (incidentId, onData) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/activities` : 'activities';
    const q = query(collection(db, path)); // Lấy hết rồi filter ở client vì hạn chế index
    return onSnapshot(q, (snapshot) => {
        const activities = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.incidentId === incidentId) {
                activities.push({ id: doc.id, ...data });
            }
        });
        activities.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        onData(activities);
    });
  },

  addActivity: async (data) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/activities` : 'activities';
    return await addDoc(collection(db, path), {
        ...data,
        createdAt: serverTimestamp()
    });
  },

  create: async (data, user) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    const docRef = await addDoc(collection(db, path), {
      ...data,
      status: 'NEW',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      imagesBefore: data.imagesBefore || [], 
      imagesAfter: data.imagesAfter || []
    });

    await IncidentService.addActivity({
        incidentId: docRef.id,
        type: 'SYSTEM',
        content: `đã tạo báo cáo sự cố mới.`,
        user: { name: user.name, uid: user.uid, role: user.role }
    });

    return docRef;
  },

  update: async (id, data, oldData, user) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    await updateDoc(doc(db, path, id), {
      ...data,
      updatedAt: serverTimestamp()
    });

    if (oldData) {
        if (data.status && data.status !== oldData.status) {
            await IncidentService.addActivity({
                incidentId: id,
                type: 'SYSTEM',
                content: `đã chuyển trạng thái từ ${STATUS[oldData.status]?.label} sang ${STATUS[data.status]?.label}.`,
                user: { name: user.name, uid: user.uid, role: user.role }
            });
        }
        if (data.assignee && data.assignee !== oldData.assignee) {
            await IncidentService.addActivity({
                incidentId: id,
                type: 'SYSTEM',
                content: `đã phân công cho kỹ thuật viên: ${data.assignee}.`,
                user: { name: user.name, uid: user.uid, role: user.role }
            });
        }
    }
  },

  generateMockData: async (mockDataList, user) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    const batch = writeBatch(db);
    mockDataList.forEach(data => {
      const docRef = doc(collection(db, path));
      batch.set(docRef, {
        ...data,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        imagesBefore: [],
        imagesAfter: []
      });
    });
    await batch.commit();
  }
};

// ==========================================
// 4. CONSTANTS & ENUMS
// ==========================================
const TYPES = ['Phần cứng', 'Phần mềm', 'Người dùng', 'Hạ tầng mạng', 'Cơ điện lạnh'];

const SEVERITY = {
  CRITICAL: { label: 'Nghiêm trọng', color: 'bg-red-100 text-red-800', border: 'border-red-500' },
  MAJOR: { label: 'Quan trọng', color: 'bg-orange-100 text-orange-800', border: 'border-orange-500' },
  MINOR: { label: 'Cần quan tâm', color: 'bg-blue-100 text-blue-800', border: 'border-blue-500' },
};

const PRIORITY = {
  IMMEDIATE: { label: 'Ngay lập tức', color: 'text-red-600' },
  URGENT_1H: { label: 'Trong vòng 1h', color: 'text-orange-600' },
  HIGH_2H: { label: 'Trong vòng 2h', color: 'text-yellow-600' },
};

const STATUS = {
  NEW: { label: 'Mới', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: 'Đang xử lý', color: 'bg-blue-100 text-blue-800' },
  DONE: { label: 'Hoàn thành', color: 'bg-green-100 text-green-800' },
  MONITOR: { label: 'Theo dõi thêm', color: 'bg-purple-100 text-purple-800' },
  INCOMPLETE: { label: 'Chưa hoàn thành', color: 'bg-red-100 text-red-800' },
};

const FREQUENCIES = {
  NONE: { label: 'Không lặp lại (Lần đầu)', color: 'bg-gray-100 text-gray-500' },
  DAILY: { label: 'Vài lần/ngày', color: 'bg-red-50 text-red-600 border border-red-200' },
  WEEKLY: { label: 'Vài ngày/lần', color: 'bg-orange-50 text-orange-600 border border-orange-200' },
  MONTHLY: { label: 'Vài tháng/lần', color: 'bg-yellow-50 text-yellow-600 border border-yellow-200' },
};

const MOCK_DATA = [
  {
    title: "Máy chủ Dell R740 quá nhiệt tự shutdown",
    project: "Dự án Alpha",
    area: "Phòng Server",
    type: "Phần cứng",
    severity: "CRITICAL",
    priority: "IMMEDIATE",
    frequency: "WEEKLY",
    status: "NEW",
    reporter: "Lê Nhân Viên",
    reporterPhone: "0988777666",
    description: "Máy chủ cảnh báo nhiệt độ cao và tự tắt. Đã xảy ra 2 lần trong tuần này.",
  }
];

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================

const compressImage = (file, maxWidth = 800, quality = 0.6) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); 

    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
};

const getCurrentLocalTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

// ==========================================
// 6. ERROR BOUNDARY & UI COMPONENTS
// ==========================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { console.error("System Error caught by boundary:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 text-center p-4 font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Đã xảy ra sự cố</h2>
            <p className="text-gray-500 text-sm mb-4">Vui lòng tải lại trang để tiếp tục.</p>
            <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition shadow-sm flex items-center justify-center mx-auto gap-2">
              <RefreshCw size={18} /> Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const Badge = ({ children, className }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${className}`}>
    {children}
  </span>
);

const InputField = ({ label, value, onChange, type = "text", required = false, placeholder = "", icon: Icon, action, onKeyDown, disabled = false }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
        {action}
    </div>
    <div className="relative">
        {Icon && <div className="absolute left-3 top-3.5 text-gray-400"><Icon size={18} /></div>}
        {type === 'textarea' ? (
        <textarea 
            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${Icon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
            rows="3"
            value={value}
            onChange={e => !disabled && onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
        />
        ) : (
        <input 
            type={type}
            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${Icon ? 'pl-10' : ''} ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white'}`}
            value={value}
            onChange={e => !disabled && onChange(e.target.value)}
            onKeyDown={onKeyDown} 
            placeholder={placeholder}
            disabled={disabled}
        />
        )}
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false, disabled = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
    <select 
      className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
      value={value}
      onChange={e => !disabled && onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="">-- Chọn --</option>
      {options.map(opt => (
        <option key={opt.value || opt} value={opt.value || opt}>
          {opt.label || opt}
        </option>
      ))}
    </select>
  </div>
);

// ==========================================
// 7. MAIN CONTAINER
// ==========================================

function IncidentTrackerContent() {
  const [appUser, setAppUser] = useState(null); 
  const [view, setView] = useState('login'); 
  const [incidents, setIncidents] = useState([]);
  
  const [projectsConfig, setProjectsConfig] = useState({}); 
  
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [previewData, setPreviewData] = useState(null); 
  
  const [loading, setLoading] = useState(true);
  const [generatingMock, setGeneratingMock] = useState(false);
  const [loginEmail, setLoginEmail] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [formData, setFormData] = useState({});

  // --- MODAL STATES ---
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  
  const [profileFormData, setProfileFormData] = useState({});
  const [passwordFormData, setPasswordFormData] = useState({ current: '', new: '', confirm: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // --- ACTIVITY & TAB STATE ---
  const [activeTab, setActiveTab] = useState('info'); 
  const [activities, setActivities] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isSendingComment, setIsSendingComment] = useState(false);

  // --- CAMERA & UPLOAD STATE ---
  const videoRef = useRef(null);
  const fileInputRef = useRef(null); 
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState(null); 
  const [uploadTarget, setUploadTarget] = useState(null); 
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        await IncidentService.seedUserProfiles();
        await IncidentService.seedProjects(); 

        const profile = await IncidentService.getUserProfile(firebaseUser.email);
        setAppUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          name: profile?.name || firebaseUser.email, 
          phone: profile?.phone || '',
          title: profile?.title || 'Thành viên',
          role: profile?.role || 'USER'
        });
        setView('list');
      } else {
        setAppUser(null);
        setView('login');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!appUser) return;
    
    const unsubIncidents = IncidentService.subscribeToIncidents(
      (data) => {
        setIncidents(data);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching incidents:", error);
        setLoading(false);
      }
    );

    const unsubProjects = IncidentService.subscribeToProjects((data) => {
        setProjectsConfig(data);
    });

    return () => {
        unsubIncidents();
        unsubProjects();
    };
  }, [appUser]);

  // Subscribe to activities when detailed view opens
  useEffect(() => {
    if (view === 'detail' && selectedIncident?.id) {
        setActiveTab('info'); 
        const unsub = IncidentService.subscribeToActivities(selectedIncident.id, (data) => {
            setActivities(data);
        });
        return () => unsub();
    }
  }, [view, selectedIncident]);

  // --- PROFILE HANDLERS ---
  const openProfileModal = () => {
    setProfileFormData({
        name: appUser.name,
        phone: appUser.phone,
        title: appUser.title
    });
    setShowProfileModal(true);
  };

  const handleUpdateProfile = async () => {
    if (!profileFormData.name) {
        alert("Vui lòng nhập tên hiển thị");
        return;
    }
    setActionLoading(true);
    try {
        const success = await IncidentService.updateUserProfile(appUser.email, profileFormData);
        if (success) {
            setAppUser(prev => ({ ...prev, ...profileFormData }));
            alert("Cập nhật thông tin thành công!");
            setShowProfileModal(false);
        } else {
            alert("Không tìm thấy hồ sơ người dùng để cập nhật.");
        }
    } catch (e) {
        console.error("Update profile error:", e);
        alert("Lỗi khi cập nhật hồ sơ: " + e.message);
    } finally {
        setActionLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const { current, new: newPass, confirm } = passwordFormData;
    if (!current || !newPass || !confirm) {
        alert("Vui lòng điền đầy đủ các trường");
        return;
    }
    if (newPass !== confirm) {
        alert("Mật khẩu mới không khớp");
        return;
    }
    if (newPass.length < 6) {
        alert("Mật khẩu mới phải có ít nhất 6 ký tự");
        return;
    }

    setActionLoading(true);
    try {
        const user = auth.currentUser;
        const credential = EmailAuthProvider.credential(user.email, current);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPass);
        alert("Đổi mật khẩu thành công!");
        setShowPasswordModal(false);
        setPasswordFormData({ current: '', new: '', confirm: '' });
    } catch (error) {
        console.error("Password change error:", error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            alert("Mật khẩu cũ không chính xác.");
        } else {
            alert("Lỗi đổi mật khẩu: " + error.message);
        }
    } finally {
        setActionLoading(false);
    }
  };

  // --- COMMENT HANDLER ---
  const handleSendComment = async () => {
    if (!commentText.trim() || !selectedIncident) return;
    setIsSendingComment(true);
    try {
        await IncidentService.addActivity({
            incidentId: selectedIncident.id,
            type: 'COMMENT',
            content: commentText,
            user: { name: appUser.name, uid: appUser.uid, role: appUser.role }
        });
        setCommentText('');
    } catch (error) {
        console.error("Comment error:", error);
        alert("Không thể gửi bình luận");
    } finally {
        setIsSendingComment(false);
    }
  };

  // --- EXISTING HANDLERS ---
  const handleLogin = async () => {
    setLoginError('');
    setIsLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
    } catch (error) {
      setLoginError("Đăng nhập thất bại.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.project || !formData.area) {
      alert("Vui lòng nhập tên sự cố, dự án và khu vực");
      return;
    }
    
    const submissionData = {
        ...formData,
        incidentTime: formData.incidentTime || getCurrentLocalTime()
    };

    try {
      await IncidentService.create(submissionData, appUser);
      setView('list');
      setFormData({});
    } catch (e) {
      console.error("Error creating:", e);
      if (e.code === 'resource-exhausted' || e.message.includes('longer than')) {
        alert("Dữ liệu quá lớn (có thể do quá nhiều ảnh). Vui lòng giảm bớt ảnh.");
      } else {
        alert("Lỗi khi tạo sự cố: " + e.message);
      }
    }
  };

  const handleUpdate = async () => {
    if (!selectedIncident) return;
    try {
        await IncidentService.update(selectedIncident.id, formData, selectedIncident, appUser);
        setView('list');
        setSelectedIncident(null);
        setFormData({});
    } catch (e) {
        console.error("Error updating:", e);
        if (e.code === 'resource-exhausted' || e.message.includes('longer than')) {
            alert("Dữ liệu quá lớn (có thể do quá nhiều ảnh). Vui lòng giảm bớt ảnh.");
        } else {
            alert("Lỗi khi cập nhật.");
        }
    }
  };

  const handleClone = () => {
    if (!selectedIncident) return;
    const clonedData = {
        ...selectedIncident,
        title: `${selectedIncident.title} (Sao chép)`, 
        status: 'NEW', 
        receiver: '',
        receiverPhone: '',
        assignee: '',
        assigneePhone: '',
        resolution: '',
        rootCause: '',
        preliminaryAssessment: '',
        estimatedTime: '',
        processingTime: '', 
        incidentTime: getCurrentLocalTime(), 
        imagesAfter: [], 
        incompleteReason: '',
        reporter: appUser?.name,
        reporterPhone: appUser?.phone,
        createdAt: null, 
        updatedAt: null
    };
    delete clonedData.id;
    setFormData(clonedData);
    setView('create');
  };

  const generateMockData = async () => {
    if (!appUser) return;
    setGeneratingMock(true);
    try {
      await IncidentService.generateMockData(MOCK_DATA, appUser);
    } catch (e) {
      alert("Lỗi khi tạo dữ liệu mẫu.");
    } finally {
      setGeneratingMock(false);
    }
  };

  const openDetail = (incident) => {
    setSelectedIncident(incident);
    setFormData(incident); 
    setView('detail');
  };

  const assignToMe = (field, phoneField) => {
    if (appUser) {
        setFormData(prev => ({
            ...prev,
            [field]: appUser.name, 
            [phoneField]: appUser.phone 
        }));
    }
  };

  // --- CAMERA & UPLOAD LOGIC ---
  const startCamera = async (mode) => {
    setCameraMode(mode);
    setShowCamera(true);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Không thể mở camera. Vui lòng kiểm tra quyền truy cập trên trình duyệt.");
        setShowCamera(false);
    }
  };

  const triggerUpload = (targetField) => {
    setUploadTarget(targetField);
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessingImage(true);
    try {
        const compressedBase64 = await compressImage(file, 800, 0.6);
        const currentImages = formData[uploadTarget] || [];
        if (currentImages.length >= 3) {
            alert("Để đảm bảo hiệu năng, chỉ cho phép tối đa 3 ảnh mỗi mục.");
            setIsProcessingImage(false);
            e.target.value = '';
            return;
        }

        setFormData({ 
            ...formData, 
            [uploadTarget]: [...currentImages, compressedBase64] 
        });
    } catch (error) {
        console.error("Compression error:", error);
        alert("Lỗi khi xử lý ảnh.");
    } finally {
        setIsProcessingImage(false);
        e.target.value = ''; 
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
    setCameraMode(null);
  };

  const captureImage = () => {
    if (!videoRef.current) return;
    
    const canvas = document.createElement('canvas');
    const scale = 800 / videoRef.current.videoWidth; 
    canvas.width = 800;
    canvas.height = videoRef.current.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    const base64Img = canvas.toDataURL('image/jpeg', 0.6);
    
    const targetField = cameraMode === 'before' ? 'imagesBefore' : 'imagesAfter';
    const currentImages = formData[targetField] || [];
    
    if (currentImages.length >= 3) {
        alert("Để đảm bảo hiệu năng, chỉ cho phép tối đa 3 ảnh mỗi mục.");
        stopCamera();
        return;
    }

    setFormData({ 
        ...formData, 
        [targetField]: [...currentImages, base64Img] 
    });
    
    stopCamera();
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (filterProject !== 'ALL' && inc.project !== filterProject) return false;
      if (filterStatus !== 'ALL' && inc.status !== filterStatus) return false;
      return true;
    });
  }, [incidents, filterProject, filterStatus]);

  const stats = useMemo(() => {
    const res = {
        total: incidents.length,
        done: 0,
        critical: 0,
        byProject: {},
        byType: {},
        bySeverity: { CRITICAL: 0, MAJOR: 0, MINOR: 0 },
        byFrequency: { DAILY: 0, WEEKLY: 0, MONTHLY: 0, NONE: 0 },
    };

    incidents.forEach(inc => {
        if (inc.status === 'DONE') res.done++;
        const proj = inc.project || 'Chưa phân loại';
        res.byProject[proj] = (res.byProject[proj] || 0) + 1;
        const type = inc.type || 'Khác';
        res.byType[type] = (res.byType[type] || 0) + 1;
        if (inc.severity && res.bySeverity[inc.severity] !== undefined) {
            res.bySeverity[inc.severity]++;
            if (inc.severity === 'CRITICAL') res.critical++;
        }
        if (inc.frequency && res.byFrequency[inc.frequency] !== undefined) {
            res.byFrequency[inc.frequency]++;
        }
    });
    return res;
  }, [incidents]);

  // --- VIEWS ---

  const renderCameraModal = () => (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <div className="relative w-full h-full flex flex-col">
            <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 w-full p-6 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between">
                <button onClick={stopCamera} className="text-white bg-white/20 p-3 rounded-full backdrop-blur-sm">
                    <X size={24} />
                </button>
                <button onClick={captureImage} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-lg active:scale-95 transition-transform"></button>
                <div className="w-12"></div> 
            </div>
            <div className="absolute top-4 left-0 w-full text-center">
                <span className="bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm">
                    {cameraMode === 'before' ? 'Chụp ảnh hiện trường' : 'Chụp ảnh sau xử lý'}
                </span>
            </div>
        </div>
    </div>
  );

  const renderUserManualModal = () => (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowManualModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b bg-blue-600 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center">
                    <BookOpen className="mr-2"/> Hướng Dẫn Sử Dụng
                </h3>
                <button onClick={() => setShowManualModal(false)} className="p-1 hover:bg-blue-500 rounded-full transition">
                    <X size={20} className="text-white" />
                </button>
            </div>
            
            <div className="flex-grow overflow-y-auto p-6 bg-gray-50 text-gray-800">
                <section className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">1. Hệ Thống Tài Khoản</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200 border-t-4 border-t-red-500">
                            <h3 className="font-bold text-red-600">Quản Lý (Admin)</h3>
                            <p className="text-xs text-gray-500 mt-1">Toàn quyền hệ thống. Chỉnh sửa mọi ticket, quản lý user.</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-blue-200 border-t-4 border-t-blue-500">
                            <h3 className="font-bold text-blue-600">Kỹ Thuật (Tech)</h3>
                            <p className="text-xs text-gray-500 mt-1">Xử lý sự cố. Nhận việc, cập nhật tiến độ, hoàn thành.</p>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-green-200 border-t-4 border-t-green-500">
                            <h3 className="font-bold text-green-600">Nhân Viên (User)</h3>
                            <p className="text-xs text-gray-500 mt-1">Chỉ báo cáo sự cố và theo dõi trạng thái.</p>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Quy Trình Báo Cáo</h2>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                            <h4 className="font-bold mt-2">Tạo Mới</h4>
                            <p className="text-sm text-gray-600">Nhấn nút "Báo cáo mới" trên Dashboard.</p>
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                            <h4 className="font-bold mt-2">Nhập Liệu</h4>
                            <p className="text-sm text-gray-600">Điền Tiêu đề, Dự án, Khu vực và Mô tả.</p>
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                            <h4 className="font-bold mt-2">Hình Ảnh</h4>
                            <p className="text-sm text-gray-600">Chụp/Tải ảnh hiện trường (Tự động nén).</p>
                        </div>
                        <div className="flex-1 bg-white p-4 rounded-lg border border-gray-200 relative">
                            <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                            <h4 className="font-bold mt-2">Gửi</h4>
                            <p className="text-sm text-gray-600">Nhấn "Gửi Báo Cáo" để hoàn tất.</p>
                        </div>
                    </div>
                </section>

                <section className="mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">3. Quyền Hạn Chỉnh Sửa</h2>
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700">
                                <tr>
                                    <th className="p-3">Vai trò</th>
                                    <th className="p-3">Quyền hạn</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b">
                                    <td className="p-3 font-medium">Người Tạo</td>
                                    <td className="p-3">Được chỉnh sửa ticket do chính mình tạo.</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-3 font-medium">Kỹ Thuật Viên</td>
                                    <td className="p-3">Được chỉnh sửa ticket được giao (Assignee).</td>
                                </tr>
                                <tr className="border-b">
                                    <td className="p-3 font-medium">Quản Lý</td>
                                    <td className="p-3">Toàn quyền chỉnh sửa tất cả ticket.</td>
                                </tr>
                                <tr>
                                    <td className="p-3 font-medium text-gray-400">Người Khác</td>
                                    <td className="p-3 text-gray-400">Chỉ xem (Read-only mode).</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">FAQ - Câu Hỏi Thường Gặp</h2>
                    <ul className="space-y-3">
                        <li className="bg-blue-50 p-3 rounded-lg">
                            <span className="font-bold text-blue-800">Q: Tại sao tôi không thấy nút Cập nhật?</span>
                            <br/>
                            <span className="text-sm text-blue-700">A: Bạn đang ở chế độ Chỉ xem (Read-only). Hãy kiểm tra xem bạn có phải là người tạo hoặc người xử lý ticket đó không.</span>
                        </li>
                        <li className="bg-blue-50 p-3 rounded-lg">
                            <span className="font-bold text-blue-800">Q: Làm sao để đổi mật khẩu?</span>
                            <br/>
                            <span className="text-sm text-blue-700">A: Nhấn vào biểu tượng chìa khóa 🔑 trên thanh Header.</span>
                        </li>
                    </ul>
                </section>
            </div>
            
            <div className="p-4 border-t bg-gray-50 text-right">
                <button onClick={() => setShowManualModal(false)} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
                    Đóng
                </button>
            </div>
        </div>
    </div>
  );

  const renderProfileModal = () => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => !actionLoading && setShowProfileModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center">
                <h3 className="font-bold text-gray-800 text-lg flex items-center">
                    <UserCog className="mr-2 text-blue-600"/> Hồ sơ cá nhân
                </h3>
                <button onClick={() => setShowProfileModal(false)} disabled={actionLoading} className="p-1 hover:bg-gray-100 rounded-full transition">
                    <X size={20} className="text-gray-500" />
                </button>
            </div>
            <div className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (Không thể thay đổi)</label>
                    <input type="text" value={appUser?.email} disabled className="w-full p-2.5 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 cursor-not-allowed"/>
                </div>
                <InputField 
                    label="Tên hiển thị" 
                    value={profileFormData.name || ''} 
                    onChange={v => setProfileFormData({...profileFormData, name: v})} 
                    placeholder="Nguyễn Văn A"
                    icon={User}
                />
                <InputField 
                    label="Số điện thoại" 
                    value={profileFormData.phone || ''} 
                    onChange={v => setProfileFormData({...profileFormData, phone: v})} 
                    placeholder="09..."
                    icon={Phone}
                />
                <InputField 
                    label="Chức danh" 
                    value={profileFormData.title || ''} 
                    onChange={v => setProfileFormData({...profileFormData, title: v})} 
                    placeholder="Kỹ thuật viên..."
                    icon={Badge}
                />
                
                <div className="pt-2">
                    <button 
                        onClick={handleUpdateProfile} 
                        disabled={actionLoading}
                        className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition flex items-center justify-center disabled:opacity-50"
                    >
                        {actionLoading ? <Activity className="animate-spin mr-2" size={18}/> : <Save className="mr-2" size={18} />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    </div>
  );

  const renderPasswordModal = () => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => !actionLoading && setShowPasswordModal(false)}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex justify-between items-center bg-red-50 rounded-t-2xl">
                <h3 className="font-bold text-red-800 text-lg flex items-center">
                    <Key className="mr-2"/> Đổi mật khẩu
                </h3>
                <button onClick={() => setShowPasswordModal(false)} disabled={actionLoading} className="p-1 hover:bg-red-100 rounded-full transition">
                    <X size={20} className="text-red-500" />
                </button>
            </div>
            <div className="p-6 space-y-4">
                <p className="text-sm text-gray-500 mb-2">Vui lòng nhập mật khẩu cũ để xác thực trước khi thay đổi.</p>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu hiện tại</label>
                    <input 
                        type="password" 
                        value={passwordFormData.current}
                        onChange={e => setPasswordFormData({...passwordFormData, current: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        placeholder="••••••"
                    />
                </div>
                
                <div className="border-t border-gray-100 pt-4 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                    <input 
                        type="password" 
                        value={passwordFormData.new}
                        onChange={e => setPasswordFormData({...passwordFormData, new: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="••••••"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nhập lại mật khẩu mới</label>
                    <input 
                        type="password" 
                        value={passwordFormData.confirm}
                        onChange={e => setPasswordFormData({...passwordFormData, confirm: e.target.value})}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="••••••"
                    />
                </div>
                
                <div className="pt-2">
                    <button 
                        onClick={handleChangePassword} 
                        disabled={actionLoading}
                        className="w-full bg-red-600 text-white font-medium py-2.5 rounded-lg hover:bg-red-700 transition flex items-center justify-center disabled:opacity-50"
                    >
                        {actionLoading ? <Activity className="animate-spin mr-2" size={18}/> : "Xác nhận đổi mật khẩu"}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );

  const renderImagePreviewModal = () => {
    if (!previewData) return null;
    
    return (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewData(null)}>
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800 text-lg truncate pr-4">{previewData.title}</h3>
                    <button onClick={() => setPreviewData(null)} className="p-2 hover:bg-gray-200 rounded-full transition">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                        {/* Cột Trước */}
                        <div className="flex flex-col">
                            <h4 className="text-sm font-bold text-red-600 uppercase mb-4 flex items-center border-b pb-2">
                                <AlertTriangle size={16} className="mr-2" />
                                Hiện trường (Trước)
                            </h4>
                            {previewData.imagesBefore && previewData.imagesBefore.length > 0 ? (
                                <div className="space-y-4">
                                    {previewData.imagesBefore.map((img, idx) => (
                                        <div key={idx} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                            <img src={img} alt={`Before ${idx}`} className="w-full h-auto object-contain max-h-64 md:max-h-80" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
                                    <Camera size={32} className="mb-2 opacity-20" />
                                    <span className="text-xs">Không có ảnh hiện trường</span>
                                </div>
                            )}
                        </div>

                        {/* Cột Sau */}
                        <div className="flex flex-col">
                            <h4 className="text-sm font-bold text-green-600 uppercase mb-4 flex items-center border-b pb-2">
                                <CheckCircle size={16} className="mr-2" />
                                Kết quả (Sau)
                            </h4>
                            {previewData.imagesAfter && previewData.imagesAfter.length > 0 ? (
                                <div className="space-y-4">
                                    {previewData.imagesAfter.map((img, idx) => (
                                        <div key={idx} className="bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                            <img src={img} alt={`After ${idx}`} className="w-full h-auto object-contain max-h-64 md:max-h-80" />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
                                    <CheckCircle size={32} className="mb-2 opacity-20" />
                                    <span className="text-xs">Chưa có ảnh nghiệm thu</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="p-4 border-t bg-gray-50 text-right">
                    <button onClick={() => setPreviewData(null)} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderStats = () => (
    <div className="pb-20 max-w-7xl mx-auto w-full bg-gray-50 min-h-screen">
        <div className="bg-white border-b sticky top-0 z-20 shadow-sm mb-6">
            <div className="px-4 py-4 flex items-center justify-between">
                <button onClick={() => setView('list')} className="flex items-center text-gray-600 hover:text-blue-600 transition">
                    <ChevronLeft className="mr-1" />
                    <span className="font-medium">Quay lại Dashboard</span>
                </button>
                <h2 className="font-bold text-lg text-gray-800">Thống Kê</h2>
                <div className="w-20"></div>
            </div>
        </div>
        
        <div className="px-4 md:px-6 space-y-6">
            
            {/* 1. Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full mr-4">
                        <Database size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Tổng sự cố</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full mr-4">
                        <AlertOctagon size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Nghiêm trọng</p>
                        <h3 className="text-2xl font-bold text-gray-900">{stats.critical}</h3>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center">
                    <div className="p-3 bg-green-100 text-green-600 rounded-full mr-4">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500 font-medium">Tỷ lệ hoàn thành</p>
                        <h3 className="text-2xl font-bold text-gray-900">
                            {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2. Theo Dự Án */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Layers className="mr-2 text-indigo-500" /> Theo Dự Án
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(stats.byProject).map(([proj, count]) => (
                            <div key={proj}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700 truncate pr-2">{proj}</span>
                                    <span className="font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div 
                                        className="h-2 rounded-full bg-indigo-500"
                                        style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                         {Object.keys(stats.byProject).length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Chưa có dữ liệu</p>}
                    </div>
                </div>

                {/* 3. Theo Loại Sự Cố */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <PieChart className="mr-2 text-teal-500" /> Theo Loại Sự Cố
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(stats.byType).map(([type, count]) => (
                            <div key={type}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{type}</span>
                                    <span className="font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div 
                                        className="h-2 rounded-full bg-teal-500"
                                        style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                         {Object.keys(stats.byType).length === 0 && <p className="text-sm text-gray-400 italic text-center py-4">Chưa có dữ liệu</p>}
                    </div>
                </div>
                
                 {/* 4. Theo Mức Độ */}
                 <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <AlertTriangle className="mr-2 text-orange-500" /> Theo Mức Độ
                    </h3>
                    <div className="flex gap-4 items-end justify-around h-40 pb-4">
                        {Object.entries(stats.bySeverity).map(([sev, count]) => {
                             const config = SEVERITY[sev];
                             const height = stats.total > 0 ? (count / stats.total) * 100 : 0;
                             // Min height 10% for visual
                             const visualHeight = count > 0 ? Math.max(height, 10) : 0; 
                             
                             return (
                                <div key={sev} className="flex flex-col items-center justify-end h-full w-1/3 group">
                                    <div className="text-xs font-bold mb-1 text-gray-600">{count}</div>
                                    <div 
                                        className={`w-full max-w-[40px] rounded-t-lg transition-all duration-500 ${config ? config.color.split(' ')[0] : 'bg-gray-200'}`}
                                        style={{ height: `${visualHeight}%` }}
                                    ></div>
                                    <div className="text-xs text-gray-500 mt-2 font-medium">{config ? config.label : sev}</div>
                                </div>
                             )
                        })}
                    </div>
                </div>

                {/* 5. Theo Tần Suất (Original Logic) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <Activity className="mr-2 text-red-500" /> Tần Suất Lặp Lại
                    </h3>
                    <div className="space-y-4">
                        {Object.entries(stats.byFrequency).map(([key, count]) => (
                            <div key={key}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-gray-700">{FREQUENCIES[key].label}</span>
                                    <span className="font-bold">{count}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                    <div 
                                        className={`h-2.5 rounded-full ${key === 'DAILY' ? 'bg-red-500' : key === 'WEEKLY' ? 'bg-orange-500' : 'bg-yellow-500'}`} 
                                        style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <div className="text-center mb-8">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="text-blue-600 w-8 h-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800">Incident Tracker</h1>
                <p className="text-gray-500 text-sm mt-1">Đăng nhập với Firebase Auth</p>
            </div>
            {loginError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center"><AlertTriangle size={16} className="mr-2"/> {loginError}</div>}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <div className="relative">
                      <div className="absolute left-3 top-3.5 text-gray-400"><Mail size={18} /></div>
                      <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="admin@demo.com" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                    <div className="relative">
                      <div className="absolute left-3 top-3.5 text-gray-400"><Lock size={18} /></div>
                      <input 
                        type="password" 
                        value={loginPassword} 
                        onChange={(e) => setLoginPassword(e.target.value)} 
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="••••••" 
                      />
                    </div>
                </div>
                <button onClick={handleLogin} disabled={isLoggingIn} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex justify-center">
                    {isLoggingIn ? <Activity className="animate-spin" /> : 'Đăng Nhập'}
                </button>
            </div>
            {/* <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-center text-gray-400 mb-4 uppercase font-bold">Tài khoản demo (Pass: 123456)</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-gray-50 p-2 rounded cursor-pointer hover:bg-blue-50" onClick={() => {setLoginEmail('admin@demo.com'); setLoginPassword('123456')}}>
                        <div className="font-bold truncate">admin@</div>
                        <div className="text-gray-500">Quản lý</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded cursor-pointer hover:bg-blue-50" onClick={() => {setLoginEmail('tech@demo.com'); setLoginPassword('123456')}}>
                        <div className="font-bold truncate">tech@</div>
                        <div className="text-gray-500">Kỹ thuật</div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded cursor-pointer hover:bg-blue-50" onClick={() => {setLoginEmail('user@demo.com'); setLoginPassword('123456')}}>
                        <div className="font-bold truncate">user@</div>
                        <div className="text-gray-500">Nhân viên</div>
                    </div>
                </div>
                <p className="text-[10px] text-center text-gray-400 mt-2 italic">*Lưu ý: Bạn cần tạo Authentication Users trên Firebase Console khớp với các email này để đăng nhập thành công.</p>
            </div> */}
        </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="pb-20 max-w-7xl mx-auto w-full">
      <div className="bg-blue-600 text-white p-6 md:p-10 md:rounded-b-3xl rounded-b-3xl shadow-lg mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold flex items-center">
                    Xin chào, {appUser?.name}! 
                    <button onClick={openProfileModal} className="ml-2 bg-blue-500 hover:bg-blue-400 p-1 rounded-full transition" title="Chỉnh sửa thông tin">
                        <Edit3 size={14} className="text-white"/>
                    </button>
                </h1>
                <p className="text-blue-100 text-sm mt-1">{appUser?.title} • {appUser?.email}</p>
            </div>
            <div className="flex items-center mt-4 md:mt-0 gap-3">
                 <button 
                    onClick={() => setShowManualModal(true)} 
                    className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition"
                 >
                    <HelpCircle size={16} className="mr-2"/> Hướng dẫn
                 </button>

                 <button onClick={() => setView('stats')} className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition">
                    <BarChart2 size={16} className="mr-2"/> Thống kê
                 </button>
                 
                 <div className="flex bg-blue-700 rounded-lg p-1">
                     <button onClick={() => setShowPasswordModal(true)} className="p-2 hover:bg-blue-600 rounded text-white transition" title="Đổi mật khẩu">
                        <Key size={18}/>
                     </button>
                     <div className="w-[1px] bg-blue-500 mx-1 my-1"></div>
                     <button onClick={handleLogout} className="p-2 hover:bg-blue-600 rounded text-white transition" title="Đăng xuất">
                        <LogOut size={18}/>
                     </button>
                 </div>
            </div>
        </div>
      </div>

      <div className="px-4 md:px-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-4 py-2 shadow-sm whitespace-nowrap outline-none">
                    <option value="ALL">Tất cả dự án</option>
                    {Object.keys(projectsConfig).map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white border border-gray-200 text-sm rounded-lg px-4 py-2 shadow-sm whitespace-nowrap outline-none">
                    <option value="ALL">Tất cả trạng thái</option>
                    {Object.keys(STATUS).map(k => <option key={k} value={k}>{STATUS[k].label}</option>)}
                </select>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                {/* {incidents.length === 0 && (
                  <button onClick={generateMockData} disabled={generatingMock} className="whitespace-nowrap bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg shadow-sm hover:bg-blue-50 transition flex items-center justify-center gap-2 text-sm font-medium">
                      <Database size={16} /> {generatingMock ? 'Đang tạo...' : 'Tạo dữ liệu mẫu'}
                  </button>
                )} */}
                
                <button 
                    onClick={() => { 
                        setFormData({ 
                            severity: 'MINOR', 
                            priority: 'HIGH_2H', 
                            type: 'Phần cứng', 
                            frequency: 'NONE',
                            incidentTime: getCurrentLocalTime(),
                            reporter: appUser?.name, 
                            reporterPhone: appUser?.phone 
                        }); 
                        setView('create'); 
                    }}
                    className="whitespace-nowrap w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
                >
                    <Plus size={20} /> Báo cáo mới
                </button>
            </div>
        </div>
      </div>

      <div className="px-4 md:px-6">
        {loading ? <p className="text-center text-gray-500 mt-10">Đang tải dữ liệu...</p> : 
         filteredIncidents.length === 0 ? (
           <div className="text-center py-20 text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100 mx-auto max-w-lg">
             <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
             <p className="text-lg">Chưa có sự cố nào.</p>
           </div>
         ) :
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIncidents.map(inc => {
            const severityCfg = SEVERITY[inc.severity] || SEVERITY.MINOR;
            const statusCfg = STATUS[inc.status] || STATUS.NEW;
            const priorityCfg = PRIORITY[inc.priority] || PRIORITY.HIGH_2H;

            return (
                <div key={inc.id} onClick={() => openDetail(inc)} className={`bg-white rounded-xl p-5 shadow-sm border-l-4 ${severityCfg.border} hover:shadow-md transition-all cursor-pointer flex flex-col h-full relative group`}>
                <div className="flex justify-between items-start mb-3">
                    <Badge className={statusCfg.color}>{statusCfg.label}</Badge>
                    <span className={`text-xs font-bold flex items-center bg-gray-50 px-2 py-1 rounded ${priorityCfg.color}`}>
                    <Clock size={12} className="mr-1"/> {priorityCfg.label}
                    </span>
                </div>
                <h3 className="font-bold text-gray-800 mb-2 text-lg line-clamp-2 mt-2">{inc.title}</h3>
                <div className="mb-4 flex-grow space-y-2">
                     <div className="flex flex-wrap gap-2 text-xs text-gray-600 items-center">
                        <span className="bg-gray-100 px-2 py-1 rounded font-semibold">{inc.project}</span>
                        <ChevronLeft size={10} className="text-gray-400 rotate-180" />
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100 flex items-center">
                            <MapPin size={10} className="mr-1"/> {inc.area}
                        </span>
                     </div>
                     <p className="text-sm text-gray-500 line-clamp-2">{inc.description}</p>
                     
                     <div className="flex items-center gap-2 mt-2">
                        {inc.incidentTime && (
                            <div className="text-xs text-gray-500 flex items-center bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                <Calendar size={12} className="mr-1" /> 
                                {formatDateTime(inc.incidentTime)}
                            </div>
                        )}
                        {inc.estimatedTime && (STATUS[inc.status] === STATUS.IN_PROGRESS || STATUS[inc.status] === STATUS.NEW) && (
                            <div className="bg-orange-50 border border-orange-100 px-2 py-1 rounded flex items-center gap-1 text-xs text-orange-800">
                               <Timer size={12} className="flex-shrink-0" />
                               <span>ETA: <strong>{inc.estimatedTime}</strong></span>
                            </div>
                        )}
                     </div>
                </div>
                <div className="flex items-center justify-between border-t pt-4 border-gray-100 mt-auto">
                    <div className="flex items-center text-xs text-gray-500">
                        <User size={14} className="mr-1 text-gray-400"/>
                        <span className="font-medium text-gray-700">{inc.reporter || 'Ẩn danh'}</span>
                    </div>
                    {(inc.imagesBefore?.length > 0 || inc.imagesAfter?.length > 0) && (
                        <button 
                            onClick={(e) => {
                                e.stopPropagation(); // Ngăn sự kiện click lan ra ngoài (để không mở chi tiết)
                                setPreviewData(inc);
                            }}
                            className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100 transition z-10 active:scale-95"
                            title="Bấm để xem nhanh ảnh"
                        >
                            <Camera size={14} className="mr-1" />
                            <span className="font-medium">Xem ảnh</span>
                        </button>
                    )}
                </div>
                </div>
            );
            })}
         </div>
        }
      </div>
    </div>
  );

  const renderForm = (isEdit = false) => {
    // --- PHÂN QUYỀN (ACCESS CONTROL) ---
    // Mặc định là có thể sửa (nếu là tạo mới)
    let canEdit = !isEdit; 

    // Nếu đang Edit, kiểm tra quyền
    if (isEdit && selectedIncident && appUser) {
        const isManager = appUser.role === 'MANAGER';
        const isCreator = selectedIncident.createdBy === appUser.uid;
        const isAssignee = selectedIncident.assignee === appUser.name; 
        
        if (isManager || isCreator || isAssignee) {
            canEdit = true;
        } else {
            canEdit = false;
        }
    }

    const isReadOnly = !canEdit;

    // --- ACTIVITY FEED RENDERER ---
    const renderActivityFeed = () => (
        <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-2">
                <input 
                    type="text" 
                    value={commentText} 
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                    placeholder="Viết bình luận..." 
                    className="flex-grow bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                    onClick={handleSendComment} 
                    disabled={!commentText.trim() || isSendingComment}
                    className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                    <Send size={18} />
                </button>
            </div>

            <div className="space-y-4">
                {activities.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Chưa có hoạt động nào.</p>
                ) : (
                    activities.slice().reverse().map(act => (
                        <div key={act.id} className={`flex gap-3 ${act.type === 'SYSTEM' ? 'items-center opacity-75' : 'items-start'}`}>
                            {act.type === 'SYSTEM' ? (
                                <div className="min-w-[2px] h-full bg-gray-200 mx-4 self-stretch"></div>
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                                    {act.user?.name?.charAt(0) || 'U'}
                                </div>
                            )}
                            
                            <div className={`flex-grow ${act.type === 'SYSTEM' ? 'text-xs text-gray-500 italic' : 'bg-white p-3 rounded-lg border border-gray-100 shadow-sm'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`font-bold ${act.type === 'SYSTEM' ? 'text-gray-600' : 'text-gray-800 text-sm'}`}>
                                        {act.user?.name || 'Hệ thống'}
                                    </span>
                                    <span className="text-[10px] text-gray-400">{formatTimeAgo(act.createdAt)}</span>
                                </div>
                                <p className={`text-sm ${act.type === 'SYSTEM' ? 'text-gray-500' : 'text-gray-700'}`}>
                                    {act.content}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Hidden File Input for Upload Handling */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Top Bar */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
         <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => setView('list')} className="flex items-center text-gray-600 hover:text-blue-600 transition">
                <ChevronLeft className="mr-1" />
                <span className="font-medium">Quay lại</span>
            </button>
            <div className="flex items-center gap-3">
                 <h2 className="font-bold text-lg text-gray-800">{isEdit ? 'Chi Tiết & Xử Lý' : 'Tạo Sự Cố Mới'}</h2>
                 {isReadOnly && (
                     <span className="flex items-center text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200 font-medium">
                         <Shield size={12} className="mr-1"/> Chỉ xem
                     </span>
                 )}
            </div>
            <div className="w-20 text-right">
                {isEdit && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">ID: {selectedIncident?.id?.slice(0,4)}</span>}
            </div>
         </div>
         
         {/* TABS NAVIGATION (Only in Edit Mode) */}
         {isEdit && (
             <div className="max-w-4xl mx-auto px-4 flex border-t">
                 <button 
                    onClick={() => setActiveTab('info')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'info' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                 >
                    Thông tin chi tiết
                 </button>
                 <button 
                    onClick={() => setActiveTab('activity')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition flex items-center justify-center gap-2 ${activeTab === 'activity' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                 >
                    <MessageSquare size={16}/> Thảo luận & Lịch sử
                 </button>
             </div>
         )}
      </div>
      
      {/* Thông báo quyền hạn nếu bị khóa */}
      {isReadOnly && activeTab === 'info' && (
          <div className="max-w-4xl mx-auto px-4 mt-4">
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg flex items-start text-sm">
                  <ShieldAlert size={16} className="mt-0.5 mr-2 flex-shrink-0" />
                  <span>
                      <strong>Chế độ chỉ xem:</strong> Bạn không có quyền chỉnh sửa sự cố này.
                  </span>
              </div>
          </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Render Content based on Tab */}
        {activeTab === 'activity' ? (
            renderActivityFeed()
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-xs">1</span>
                            Thông tin sự cố
                        </h3>
                        <InputField label="Tiêu đề sự cố" value={formData.title || ''} onChange={v => setFormData({...formData, title: v})} required placeholder="VD: Mất kết nối máy chủ tầng 3" disabled={isReadOnly}/>
                        
                        <InputField 
                            label="Thời gian xảy ra/báo cáo" 
                            type="datetime-local"
                            value={formData.incidentTime || ''} 
                            onChange={v => setFormData({...formData, incidentTime: v})} 
                            required 
                            disabled={isReadOnly}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField 
                                label="Dự án" 
                                value={formData.project || ''} 
                                onChange={v => setFormData({...formData, project: v, area: ''})} 
                                options={Object.keys(projectsConfig)} 
                                required 
                                disabled={isReadOnly}
                            />
                            <SelectField 
                                label="Khu vực" 
                                value={formData.area || ''} 
                                onChange={v => setFormData({...formData, area: v})} 
                                options={formData.project ? projectsConfig[formData.project] || [] : []} 
                                required 
                                disabled={!formData.project || isReadOnly} 
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField label="Loại sự cố" value={formData.type || ''} onChange={v => setFormData({...formData, type: v})} options={TYPES} disabled={isReadOnly} />
                            <SelectField label="Tần suất lặp lại" value={formData.frequency || 'NONE'} onChange={v => setFormData({...formData, frequency: v})} options={Object.keys(FREQUENCIES).map(k => ({ value: k, label: FREQUENCIES[k].label }))} disabled={isReadOnly} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <SelectField label="Mức độ" value={formData.severity || ''} onChange={v => setFormData({...formData, severity: v})} options={Object.keys(SEVERITY).map(k => ({ value: k, label: SEVERITY[k].label }))} disabled={isReadOnly} />
                            <SelectField label="Độ ưu tiên" value={formData.priority || ''} onChange={v => setFormData({...formData, priority: v})} options={Object.keys(PRIORITY).map(k => ({ value: k, label: PRIORITY[k].label }))} disabled={isReadOnly} />
                        </div>
                        <InputField label="Mô tả chi tiết" type="textarea" value={formData.description || ''} onChange={v => setFormData({...formData, description: v})} placeholder="Mô tả hiện tượng, vị trí cụ thể..." disabled={isReadOnly} />
                    </div>
                    
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-xs">2</span>
                            Thông tin liên hệ
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Người báo cáo" value={formData.reporter || ''} onChange={v => setFormData({...formData, reporter: v})} placeholder="Tên người báo" icon={User} disabled={isReadOnly} />
                            <InputField label="SĐT Người báo" value={formData.reporterPhone || ''} onChange={v => setFormData({...formData, reporterPhone: v})} placeholder="09xx..." icon={Phone} disabled={isReadOnly} />
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <p className="text-xs font-semibold text-gray-500 mb-3 uppercase">Liên hệ hiện trường (Nếu khác người báo)</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Người liên hệ" value={formData.contactPerson || ''} onChange={v => setFormData({...formData, contactPerson: v})} placeholder="Tên người tại chỗ" icon={User} disabled={isReadOnly} />
                                <InputField label="SĐT Hiện trường" value={formData.contactPhone || ''} onChange={v => setFormData({...formData, contactPhone: v})} placeholder="09xx..." icon={Phone} disabled={isReadOnly} />
                            </div>
                        </div>
                    </div>

                    {isEdit && (
                    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-t-4 ${isReadOnly ? 'border-t-gray-300' : 'border-t-blue-500'}`}>
                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center justify-between">
                            <div className="flex items-center">
                                <span className={`w-6 h-6 rounded-full ${isReadOnly ? 'bg-gray-200 text-gray-500' : 'bg-blue-100 text-blue-600'} flex items-center justify-center mr-2 text-xs`}>3</span>
                                Đánh giá & Kế hoạch xử lý
                            </div>
                            <span className={`text-xs ${isReadOnly ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'} px-2 py-1 rounded`}>Dành cho kỹ thuật</span>
                        </h3>
                        
                        <div className={`${isReadOnly ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-100'} p-4 rounded-lg border mb-4`}>
                            <h4 className={`text-sm font-bold ${isReadOnly ? 'text-gray-600' : 'text-blue-800'} mb-3 flex items-center`}><MessageSquare size={16} className="mr-2"/> Thông tin phản hồi cho khách hàng</h4>
                            <InputField label="Đánh giá sơ bộ" type="textarea" value={formData.preliminaryAssessment || ''} onChange={v => setFormData({...formData, preliminaryAssessment: v})} placeholder="Nhận định ban đầu về lỗi..." disabled={isReadOnly} />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <InputField label="Thời gian dự kiến (ETA)" value={formData.estimatedTime || ''} onChange={v => setFormData({...formData, estimatedTime: v})} placeholder="VD: 14h00 hôm nay" icon={Calendar} disabled={isReadOnly} />
                                
                                <InputField 
                                    label="Kỹ thuật viên phụ trách" 
                                    value={formData.assignee || ''} 
                                    onChange={v => setFormData({...formData, assignee: v})} 
                                    placeholder="Tên kỹ thuật viên" 
                                    icon={User}
                                    disabled={isReadOnly}
                                    action={
                                        !isReadOnly && !formData.assignee && (
                                            <button onClick={() => assignToMe('assignee', 'assigneePhone')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center">
                                                <UserCheck size={12} className="mr-1"/> Tôi nhận việc này
                                            </button>
                                        )
                                    }
                                />
                            </div>
                            <InputField label="SĐT Kỹ thuật viên" value={formData.assigneePhone || ''} onChange={v => setFormData({...formData, assigneePhone: v})} placeholder="Số điện thoại liên hệ kỹ thuật" icon={Phone} disabled={isReadOnly} />
                        </div>

                        <h4 className="text-sm font-bold text-gray-700 mb-3 mt-4">Chi tiết kỹ thuật (Nội bộ)</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField 
                                label="Người tiếp nhận" 
                                value={formData.receiver || ''} 
                                onChange={v => setFormData({...formData, receiver: v})} 
                                placeholder="Người nhận ticket" 
                                icon={User}
                                disabled={isReadOnly}
                                action={
                                    !isReadOnly && !formData.receiver && (
                                        <button onClick={() => assignToMe('receiver', 'receiverPhone')} className="text-xs text-blue-600 hover:underline">
                                            Điền tên tôi
                                        </button>
                                    )
                                }
                            />
                            <InputField 
                                label="Thời gian thực hiện (Xong)" 
                                type="datetime-local"
                                value={formData.processingTime || ''} 
                                onChange={v => setFormData({...formData, processingTime: v})} 
                                disabled={isReadOnly}
                            />
                        </div>

                        <InputField label="Nguyên nhân gốc rễ" type="textarea" value={formData.rootCause || ''} onChange={v => setFormData({...formData, rootCause: v})} placeholder="Tại sao sự cố xảy ra?" disabled={isReadOnly} />
                        <InputField label="Cách xử lý" type="textarea" value={formData.resolution || ''} onChange={v => setFormData({...formData, resolution: v})} placeholder="Các bước đã thực hiện..." disabled={isReadOnly} />

                        <div className="border-t pt-4 mt-4 bg-gray-100 p-4 rounded-lg">
                            <SelectField label="Kết quả xử lý" value={formData.status || 'NEW'} onChange={v => setFormData({...formData, status: v})} options={Object.keys(STATUS).map(k => ({ value: k, label: STATUS[k].label }))} required disabled={isReadOnly} />
                            {formData.status === 'INCOMPLETE' && (
                            <InputField label="Lý do chưa hoàn thành" value={formData.incompleteReason || ''} onChange={v => setFormData({...formData, incompleteReason: v})} required placeholder="Thiếu vật tư, cần vendor hỗ trợ..." disabled={isReadOnly} />
                            )}
                        </div>
                    </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 sticky top-24">
                        <h3 className="font-bold text-gray-800 mb-4">Hành động</h3>
                        
                        {!isReadOnly && (
                            <button onClick={isEdit ? handleUpdate : handleCreate} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-3">
                                <Save size={18} /> {isEdit ? 'Cập Nhật' : 'Gửi Báo Cáo'}
                            </button>
                        )}

                        {isEdit && (
                            <button onClick={handleClone} className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium py-3 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center gap-2 mb-3">
                                <Copy size={18} /> Nhân bản sự cố này
                            </button>
                        )}

                        <button onClick={() => setView('list')} className="w-full bg-white text-gray-600 border border-gray-300 font-medium py-3 rounded-lg hover:bg-gray-50 transition">
                            {isReadOnly ? 'Đóng' : 'Hủy bỏ'}
                        </button>
                    </div>

                    {/* Media Panel */}
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 text-sm uppercase">Hình ảnh đính kèm</h3>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-medium text-gray-500 mb-2">ẢNH HIỆN TRƯỜNG (TRƯỚC)</label>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {formData.imagesBefore?.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={img} alt="Before" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => setFormData({...formData, imagesBefore: formData.imagesBefore.filter((_, i) => i !== idx)})}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {!isReadOnly && (
                                <div className="grid grid-cols-2 gap-2">
                                    <div onClick={() => startCamera('before')} className={`cursor-pointer p-3 border border-dashed rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition bg-white`}>
                                        <Camera className="mb-1 w-6 h-6" />
                                        <span className="text-[10px] font-medium">Chụp ảnh</span>
                                    </div>
                                    <div onClick={() => triggerUpload('imagesBefore')} className={`cursor-pointer p-3 border border-dashed rounded-lg flex flex-col items-center justify-center text-blue-500 hover:bg-blue-50 transition bg-white ${isProcessingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {isProcessingImage ? <Activity className="animate-spin mb-1 w-6 h-6"/> : <Upload className="mb-1 w-6 h-6" />}
                                        <span className="text-[10px] font-medium">Tải ảnh</span>
                                    </div>
                                </div>
                            )}
                            {isReadOnly && formData.imagesBefore?.length === 0 && <p className="text-xs text-gray-400 italic">Không có ảnh</p>}
                        </div>

                        {isEdit && (
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-2">ẢNH KẾT QUẢ (SAU)</label>
                                <div className="flex gap-2 flex-wrap mb-2">
                                    {formData.imagesAfter?.map((img, idx) => (
                                        <div key={idx} className="relative group">
                                            <img src={img} alt="After" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                            {!isReadOnly && (
                                                <button 
                                                    onClick={() => setFormData({...formData, imagesAfter: formData.imagesAfter.filter((_, i) => i !== idx)})}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                
                                {!isReadOnly && (
                                    <div className="grid grid-cols-2 gap-2">
                                        <div onClick={() => startCamera('after')} className="cursor-pointer p-3 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 transition">
                                            <Camera className="mb-1 w-6 h-6" />
                                            <span className="text-[10px] font-medium">Chụp ảnh</span>
                                        </div>
                                        <div onClick={() => triggerUpload('imagesAfter')} className={`cursor-pointer p-3 border border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-blue-500 hover:bg-blue-50 transition ${isProcessingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                                            {isProcessingImage ? <Activity className="animate-spin mb-1 w-6 h-6"/> : <Upload className="mb-1 w-6 h-6" />}
                                            <span className="text-[10px] font-medium">Tải ảnh</span>
                                        </div>
                                    </div>
                                )}
                                {isReadOnly && formData.imagesAfter?.length === 0 && <p className="text-xs text-gray-400 italic">Không có ảnh</p>}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  ); }

  if (!appUser && view !== 'login') return <div className="flex h-screen items-center justify-center bg-gray-50"><Activity className="animate-spin text-blue-500 mr-2"/> Đang khởi tạo hệ thống...</div>;
  if (view === 'login') return renderLogin();

  return (
    <div className="font-sans text-gray-900 bg-gray-100 min-h-screen w-full relative">
      {showCamera && renderCameraModal()}
      {showProfileModal && renderProfileModal()}
      {showPasswordModal && renderPasswordModal()}
      {showManualModal && renderUserManualModal()}
      {previewData && renderImagePreviewModal()}
      {view === 'list' && renderDashboard()}
      {view === 'create' && renderForm(false)}
      {view === 'detail' && renderForm(true)}
      {view === 'stats' && renderStats()}
    </div>
  );
}

// ==========================================
// 8. WRAPPER WITH ERROR BOUNDARY
// ==========================================

export default function IncidentApp() {
  return (
    <ErrorBoundary>
      <IncidentTrackerContent />
    </ErrorBoundary>
  );
}