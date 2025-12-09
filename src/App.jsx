import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut,                   
  onAuthStateChanged,
  signInWithCustomToken
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
  Aperture, Upload 
} from 'lucide-react';

// ==========================================
// 1. CONFIGURATION LAYER
// ==========================================

// --- CẤU HÌNH (SANDBOX ENVIRONMENT) ---
// const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
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

  create: async (data, user) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    return await addDoc(collection(db, path), {
      ...data,
      status: 'NEW',
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      imagesBefore: data.imagesBefore || [], 
      imagesAfter: data.imagesAfter || []
    });
  },

  update: async (id, data) => {
    const path = typeof __app_id !== 'undefined' ? `artifacts/${appId}/public/data/incidents` : 'incidents';
    return await updateDoc(doc(db, path, id), {
      ...data,
      updatedAt: serverTimestamp()
    });
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
// 5. HELPER FUNCTIONS (COMPRESSION)
// ==========================================

// Helper function to compress images before storing
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

        // Resize logic
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
        
        // Export as JPEG with reduced quality
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
    };
  });
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

const InputField = ({ label, value, onChange, type = "text", required = false, placeholder = "", icon: Icon, action, onKeyDown }) => (
  <div className="mb-4">
    <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-gray-700">{label} {required && <span className="text-red-500">*</span>}</label>
        {action}
    </div>
    <div className="relative">
        {Icon && <div className="absolute left-3 top-3.5 text-gray-400"><Icon size={18} /></div>}
        {type === 'textarea' ? (
        <textarea 
            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${Icon ? 'pl-10' : ''}`}
            rows="3"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
        />
        ) : (
        <input 
            type={type}
            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition ${Icon ? 'pl-10' : ''}`}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={onKeyDown} 
            placeholder={placeholder}
        />
        )}
    </div>
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false, disabled = false }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-gray-700 mb-1">{label} {required && <span className="text-red-500">*</span>}</label>
    <select 
      className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none ${disabled ? 'bg-gray-100 text-gray-400' : ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
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
  const [loading, setLoading] = useState(true);
  const [generatingMock, setGeneratingMock] = useState(false);
  const [loginEmail, setLoginEmail] = useState(''); 
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [formData, setFormData] = useState({});

  // --- CAMERA & UPLOAD STATE ---
  const videoRef = useRef(null);
  const fileInputRef = useRef(null); 
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState(null); // 'before' | 'after'
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
    try {
      await IncidentService.create(formData, appUser);
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
        await IncidentService.update(selectedIncident.id, formData);
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
        // Compress image to ensure it fits in Firestore document
        // 800px width max, 0.6 quality usually results in < 100KB
        const compressedBase64 = await compressImage(file, 800, 0.6);
        
        const currentImages = formData[uploadTarget] || [];
        // Limit total images to prevent doc size explosion
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
    const scale = 800 / videoRef.current.videoWidth; // Resize to max 800px width
    canvas.width = 800;
    canvas.height = videoRef.current.videoHeight * scale;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    // Compress quality to 0.6
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
    const byFrequency = { DAILY: 0, WEEKLY: 0, MONTHLY: 0 };
    const byArea = {};
    incidents.forEach(inc => {
        if (inc.frequency && inc.frequency !== 'NONE' && byFrequency[inc.frequency] !== undefined) byFrequency[inc.frequency]++;
        if (inc.project && inc.area) {
            const key = `${inc.project} - ${inc.area}`;
            byArea[key] = (byArea[key] || 0) + 1;
        }
    });
    const topAreas = Object.entries(byArea).sort(([,a], [,b]) => b - a).slice(0, 5);
    return { byFrequency, topAreas };
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
            <div className="mt-8 pt-6 border-t border-gray-100">
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
            </div>
        </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="pb-20 max-w-7xl mx-auto w-full">
      <div className="bg-blue-600 text-white p-6 md:p-10 md:rounded-b-3xl rounded-b-3xl shadow-lg mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">Xin chào, {appUser?.name}!</h1>
                <p className="text-blue-100 text-sm mt-1">{appUser?.title} • {appUser?.email}</p>
            </div>
            <div className="flex items-center mt-4 md:mt-0 gap-4">
                 <button onClick={() => setView('stats')} className="bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition">
                    <BarChart2 size={16} className="mr-2"/> Thống kê
                 </button>
                 <button onClick={handleLogout} className="bg-blue-700 hover:bg-blue-800 text-white p-2 rounded-lg flex items-center transition" title="Đăng xuất">
                    <LogOut size={20}/>
                 </button>
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
                     {inc.estimatedTime && (STATUS[inc.status] === STATUS.IN_PROGRESS || STATUS[inc.status] === STATUS.NEW) && (
                        <div className="bg-orange-50 border border-orange-100 p-2 rounded flex items-start gap-2 text-xs text-orange-800">
                           <Clock size={14} className="mt-0.5 flex-shrink-0" />
                           <span>Dự kiến: <strong>{inc.estimatedTime}</strong></span>
                        </div>
                     )}
                </div>
                <div className="flex items-center justify-between border-t pt-4 border-gray-100 mt-auto">
                    <div className="flex items-center text-xs text-gray-500">
                        <User size={14} className="mr-1 text-gray-400"/>
                        <span className="font-medium text-gray-700">{inc.reporter || 'Ẩn danh'}</span>
                    </div>
                    {(inc.imagesBefore?.length > 0 || inc.imagesAfter?.length > 0) && (
                        <div className="flex items-center text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            <Camera size={14} className="mr-1" />
                            <span>Có ảnh</span>
                        </div>
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
        <div className="px-4 md:px-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                    <Activity className="mr-2 text-red-500" /> Tần Suất Lỗi
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
                                    style={{ width: `${incidents.length > 0 ? (count / incidents.length) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );

  const renderForm = (isEdit = false) => (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* Hidden File Input for Upload Handling */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* ... existing code (Top Bar) ... */}
      <div className="bg-white border-b sticky top-0 z-20 shadow-sm">
         <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <button onClick={() => setView('list')} className="flex items-center text-gray-600 hover:text-blue-600 transition">
                <ChevronLeft className="mr-1" />
                <span className="font-medium">Quay lại</span>
            </button>
            <h2 className="font-bold text-lg text-gray-800">{isEdit ? 'Chi Tiết & Xử Lý' : 'Tạo Sự Cố Mới'}</h2>
            <div className="w-20 text-right">
                {isEdit && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">ID: {selectedIncident?.id?.slice(0,4)}</span>}
            </div>
         </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-xs">1</span>
                        Thông tin sự cố
                    </h3>
                    <InputField label="Tiêu đề sự cố" value={formData.title || ''} onChange={v => setFormData({...formData, title: v})} required placeholder="VD: Mất kết nối máy chủ tầng 3"/>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField 
                            label="Dự án" 
                            value={formData.project || ''} 
                            onChange={v => setFormData({...formData, project: v, area: ''})} 
                            options={Object.keys(projectsConfig)} 
                            required 
                        />
                        <SelectField 
                            label="Khu vực" 
                            value={formData.area || ''} 
                            onChange={v => setFormData({...formData, area: v})} 
                            options={formData.project ? projectsConfig[formData.project] || [] : []} 
                            required 
                            disabled={!formData.project} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField label="Loại sự cố" value={formData.type || ''} onChange={v => setFormData({...formData, type: v})} options={TYPES} />
                        <SelectField label="Tần suất lặp lại" value={formData.frequency || 'NONE'} onChange={v => setFormData({...formData, frequency: v})} options={Object.keys(FREQUENCIES).map(k => ({ value: k, label: FREQUENCIES[k].label }))} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <SelectField label="Mức độ" value={formData.severity || ''} onChange={v => setFormData({...formData, severity: v})} options={Object.keys(SEVERITY).map(k => ({ value: k, label: SEVERITY[k].label }))} />
                        <SelectField label="Độ ưu tiên" value={formData.priority || ''} onChange={v => setFormData({...formData, priority: v})} options={Object.keys(PRIORITY).map(k => ({ value: k, label: PRIORITY[k].label }))} />
                    </div>
                    <InputField label="Mô tả chi tiết" type="textarea" value={formData.description || ''} onChange={v => setFormData({...formData, description: v})} placeholder="Mô tả hiện tượng, vị trí cụ thể..." />
                </div>
                
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center">
                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-xs">2</span>
                        Thông tin liên hệ
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField label="Người báo cáo" value={formData.reporter || ''} onChange={v => setFormData({...formData, reporter: v})} placeholder="Tên người báo" icon={User} />
                        <InputField label="SĐT Người báo" value={formData.reporterPhone || ''} onChange={v => setFormData({...formData, reporterPhone: v})} placeholder="09xx..." icon={Phone} />
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase">Liên hệ hiện trường (Nếu khác người báo)</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <InputField label="Người liên hệ" value={formData.contactPerson || ''} onChange={v => setFormData({...formData, contactPerson: v})} placeholder="Tên người tại chỗ" icon={User} />
                            <InputField label="SĐT Hiện trường" value={formData.contactPhone || ''} onChange={v => setFormData({...formData, contactPhone: v})} placeholder="09xx..." icon={Phone} />
                        </div>
                    </div>
                </div>

                {isEdit && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-blue-500">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6 flex items-center justify-between">
                        <div className="flex items-center">
                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-2 text-xs">3</span>
                            Đánh giá & Kế hoạch xử lý
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">Dành cho kỹ thuật</span>
                    </h3>
                    
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                        <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center"><MessageSquare size={16} className="mr-2"/> Thông tin phản hồi cho khách hàng</h4>
                        <InputField label="Đánh giá sơ bộ" type="textarea" value={formData.preliminaryAssessment || ''} onChange={v => setFormData({...formData, preliminaryAssessment: v})} placeholder="Nhận định ban đầu về lỗi..." />
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <InputField label="Thời gian dự kiến (ETA)" value={formData.estimatedTime || ''} onChange={v => setFormData({...formData, estimatedTime: v})} placeholder="VD: 14h00 hôm nay" icon={Calendar} />
                             
                             <InputField 
                                label="Kỹ thuật viên phụ trách" 
                                value={formData.assignee || ''} 
                                onChange={v => setFormData({...formData, assignee: v})} 
                                placeholder="Tên kỹ thuật viên" 
                                icon={User}
                                action={
                                    !formData.assignee && (
                                        <button onClick={() => assignToMe('assignee', 'assigneePhone')} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 flex items-center">
                                            <UserCheck size={12} className="mr-1"/> Tôi nhận việc này
                                        </button>
                                    )
                                }
                            />
                         </div>
                         <InputField label="SĐT Kỹ thuật viên" value={formData.assigneePhone || ''} onChange={v => setFormData({...formData, assigneePhone: v})} placeholder="Số điện thoại liên hệ kỹ thuật" icon={Phone} />
                    </div>

                    <h4 className="text-sm font-bold text-gray-700 mb-3 mt-4">Chi tiết kỹ thuật (Nội bộ)</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InputField 
                            label="Người tiếp nhận" 
                            value={formData.receiver || ''} 
                            onChange={v => setFormData({...formData, receiver: v})} 
                            placeholder="Người nhận ticket" 
                            icon={User}
                            action={
                                !formData.receiver && (
                                    <button onClick={() => assignToMe('receiver', 'receiverPhone')} className="text-xs text-blue-600 hover:underline">
                                        Điền tên tôi
                                    </button>
                                )
                            }
                        />
                    </div>

                    <InputField label="Nguyên nhân gốc rễ" type="textarea" value={formData.rootCause || ''} onChange={v => setFormData({...formData, rootCause: v})} placeholder="Tại sao sự cố xảy ra?" />
                    <InputField label="Cách xử lý" type="textarea" value={formData.resolution || ''} onChange={v => setFormData({...formData, resolution: v})} placeholder="Các bước đã thực hiện..." />

                    <div className="border-t pt-4 mt-4 bg-gray-100 p-4 rounded-lg">
                        <SelectField label="Kết quả xử lý" value={formData.status || 'NEW'} onChange={v => setFormData({...formData, status: v})} options={Object.keys(STATUS).map(k => ({ value: k, label: STATUS[k].label }))} required />
                        {formData.status === 'INCOMPLETE' && (
                        <InputField label="Lý do chưa hoàn thành" value={formData.incompleteReason || ''} onChange={v => setFormData({...formData, incompleteReason: v})} required placeholder="Thiếu vật tư, cần vendor hỗ trợ..." />
                        )}
                    </div>
                </div>
                )}
            </div>

            <div className="space-y-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 sticky top-24">
                    <h3 className="font-bold text-gray-800 mb-4">Hành động</h3>
                    <button onClick={isEdit ? handleUpdate : handleCreate} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-md hover:bg-blue-700 transition flex items-center justify-center gap-2 mb-3">
                        <Save size={18} /> {isEdit ? 'Cập Nhật' : 'Gửi Báo Cáo'}
                    </button>
                    {isEdit && (
                        <button onClick={handleClone} className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium py-3 rounded-lg hover:bg-indigo-100 transition flex items-center justify-center gap-2 mb-3">
                            <Copy size={18} /> Nhân bản sự cố này
                        </button>
                    )}
                    <button onClick={() => setView('list')} className="w-full bg-white text-gray-600 border border-gray-300 font-medium py-3 rounded-lg hover:bg-gray-50 transition">
                        Hủy bỏ
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
                                    <button 
                                        onClick={() => setFormData({...formData, imagesBefore: formData.imagesBefore.filter((_, i) => i !== idx)})}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {/* 2 Buttons: Chụp & Tải */}
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
                    </div>

                    {isEdit && (
                         <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2">ẢNH KẾT QUẢ (SAU)</label>
                            <div className="flex gap-2 flex-wrap mb-2">
                                {formData.imagesAfter?.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={img} alt="After" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                                        <button 
                                            onClick={() => setFormData({...formData, imagesAfter: formData.imagesAfter.filter((_, i) => i !== idx)})}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            {/* 2 Buttons: Chụp & Tải */}
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
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>
    </div>
  );

  if (!appUser && view !== 'login') return <div className="flex h-screen items-center justify-center bg-gray-50"><Activity className="animate-spin text-blue-500 mr-2"/> Đang khởi tạo hệ thống...</div>;
  if (view === 'login') return renderLogin();

  return (
    <div className="font-sans text-gray-900 bg-gray-100 min-h-screen w-full relative">
      {showCamera && renderCameraModal()}
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