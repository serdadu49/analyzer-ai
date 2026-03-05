// FIRESTORE SECURITY RULES (deploy di Firebase Console)
// allow read,write: if request.auth != null && request.auth.token.email in ['admin@serdadu.id','strategi@serdadu.id','operator@serdadu.id'];

import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, signOut 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, onSnapshot 
} from 'firebase/firestore';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from 'recharts';

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================

const USER_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCbMBP0UFnWXFTEZPoXUUPK2yIxEn-WTLU",
  authDomain: "serdadu-analyzer.firebaseapp.com",
  projectId: "serdadu-analyzer",
  storageBucket: "serdadu-analyzer.firebasestorage.app",
  messagingSenderId: "709893887600",
  appId: "1:709893887600:web:8bf2b5ffc4b2e5d84bc6b5"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : USER_FIREBASE_CONFIG;
const globalAppId = typeof __app_id !== 'undefined' ? __app_id : 'serdadu-analyzer';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================
// ADMIN SECURITY CONFIG
// ============================
const ADMIN_EMAILS = [
  "admin@serdadu.id",
  "strategi@serdadu.id",
  "operator@serdadu.id"
];


// Data Wilayah Kec. Puger
const DESA_DATA = {
  "Mojomulyo": { tps: 27, dusun: [{name: "DUSUN KALIMALANG", range: [1, 14]}, {name: "DUSUN KRAJAN", range: [15, 27]}] },
  "Mojosari": { tps: 36, dusun: [{name: "DUSUN KRAJAN", range: [1, 18]}, {name: "DUSUN JADUGAN", range: [19, 36]}] },
  "Puger Kulon": { tps: 46, dusun: [{name: "DUSUN KRAJAN I", range: [1, 10]}, {name: "DUSUN GEDANGAN", range: [11, 18]}, {name: "DUSUN KRAJAN II", range: [19, 30]}, {name: "DUSUN MANDARAN I", range: [31, 36]}, {name: "DUSUN KAUMAN", range: [37, 41]}, {name: "DUSUN MANDARAN II", range: [42, 46]}] },
  "Puger wetan": { tps: 32, dusun: [{name: "DUSUN KRAJAN", range: [1, 16]}, {name: "DUSUN MANDARAN", range: [17, 32]}] },
  "Grenden": { tps: 46, dusun: [{name: "DUSUN KARETAN", range: [1, 4]}, {name: "DUSUN KARANGSONO", range: [5, 14]}, {name: "DUSUN KUMITIR", range: [15, 17]}, {name: "DUSUN KRAJAN II", range: [18, 26]}, {name: "DUSUN KRAJAN I", range: [27, 40]}, {name: "DUSUN KAPURAN", range: [41, 46]}] },
  "Kasiyan": { tps: 24, dusun: [{name: "DUSUN KRAJAN", range: [1, 10]}, {name: "DUSU GADUNGAN", range: [11, 24]}] },
  "Kasiyan Timur": { tps: 38, dusun: [{name: "DUSUN KRAJAN I", range: [1, 19]}, {name: "DUSUN KRAJAN II", range: [20, 38]}] },
  "Mlokorejo": { tps: 31, dusun: [{name: "DUSUN KRAJAN BARAT", range: [1, 15]}, {name: "DUSUN KRAJAN TIMUR", range: [16, 23]}, {name: "DUSUN SEMBUNGAN", range: [24, 31]}] },
  "Bagon": { tps: 17, dusun: [{name: "DUSUN KRAJAN", range: [1, 4]}, {name: "DUSUN KEDUNG SUMUR", range: [5, 11]}, {name: "DUSUN SULING", range: [12, 17]}] },
  "Wringintelu": { tps: 19, dusun: [{name: "DUSUN SONOKELING", range: [1, 6]}, {name: "DUSUN KRAJAN", range: [7, 12]}, {name: "DUSUN PAKEM", range: [13, 19]}] },
  "Jambearum": { tps: 23, dusun: [{name: "DUSUN KRAJAN", range: [1, 7]}, {name: "DUSUN DARUNGAN", range: [8, 15]}, {name: "DUSUN KEDUNG SUMUR", range: [16, 23]}] },
  "Wonosari": { tps: 25, dusun: [{name: "DUSUN KRAJAN", range: [1, 11]}, {name: "DUSUN PENITIK", range: [12, 20]}, {name: "DUSUN LENGKONG", range: [21, 25]}] }
};

const DESA_NAMES = Object.keys(DESA_DATA);
const TINGKAT_LIST = ["KAB", "PROV", "RI"];
const TAHUN_LIST = ["2019", "2024"];

const PARTAI_KAB = ["PKB", "GERINDRA", "PDI PERJUANGAN", "GOLKAR", "NASDEM", "PKS", "PAN", "PPP"];
const PARTAI_PROV_RI = ["PKB", "GERINDRA", "PDI PERJUANGAN", "GOLKAR", "NASDEM", "PKS", "PAN", "DEMOKRAT", "PERINDO", "PSI", "PPP"];

const PARTAI_COLORS = {
  "PKB": "#10b981", "GERINDRA": "#b91c1c", "PDI PERJUANGAN": "#dc2626",
  "GOLKAR": "#facc15", "NASDEM": "#1d4ed8", "PKS": "#f97316",
  "PAN": "#38bdf8", "PPP": "#059669", "DEMOKRAT": "#1e3a8a",
  "PERINDO": "#2563eb", "PSI": "#ec4899"
};

// Utilities
const getCollectionPath = (colName) => {
  return typeof __app_id !== 'undefined' 
    ? `artifacts/${globalAppId}/public/data/${colName}` 
    : colName; 
};

const getPartaiList = (tingkat) => tingkat === 'KAB' ? PARTAI_KAB : PARTAI_PROV_RI;

// ==========================================
// 2. COMPONENTS: ICONS (Inline SVG)
// ==========================================
const Icons = {
  Dashboard: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Table: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  Form: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Download: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Logout: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
};


// ==========================================
// 3. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [user, setUser] = useState(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [errorLogin, setErrorLogin] = useState('');

  // Global App State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filterTahun, setFilterTahun] = useState('2024');
  const [filterTingkat, setFilterTingkat] = useState('KAB');
  const [filterDesa, setFilterDesa] = useState('Mojomulyo');

  // Data State
  const [tpsDataRaw, setTpsDataRaw] = useState({});
  const [villageDataRaw, setVillageDataRaw] = useState({});
  const [isSyncing, setIsSyncing] = useState(false);

  // --- FIREBASE AUTH & INIT ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u && ADMIN_EMAILS.includes(u.email)) {
        setIsAdminLoggedIn(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- FIREBASE DATA SYNC ---
  useEffect(() => {
    if (!user) return;

    // Fetch TPS Data
    const tpsRef = collection(db, getCollectionPath('tps_data_v1'));
    const unsubTps = onSnapshot(tpsRef, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data().data || {};
      });
      setTpsDataRaw(data);
    }, (err) => console.error("TPS Sync Error", err));

    // Fetch Village Meta Data
    const villageRef = collection(db, getCollectionPath('village_meta_v1'));
    const unsubVillage = onSnapshot(villageRef, (snapshot) => {
      const data = {};
      snapshot.forEach(doc => {
        data[doc.id] = doc.data();
      });
      setVillageDataRaw(data);
    }, (err) => console.error("Village Sync Error", err));

    return () => {
      unsubTps();
      unsubVillage();
    };
  }, [user]);

  // --- AGGREGATION HOOK ---
  // Ditempatkan di sini (sebelum `if (!isAdminLoggedIn)`) untuk menghindari pelanggaran Rules of Hooks
  const aggregatedStats = useMemo(() => {
    let stats = {};
    TAHUN_LIST.forEach(tahun => {
      stats[tahun] = {};
      TINGKAT_LIST.forEach(tingkat => {
        stats[tahun][tingkat] = { totalSuara: {}, totalKeseluruhan: 0 };
        const partaiList = getPartaiList(tingkat);
        partaiList.forEach(p => stats[tahun][tingkat].totalSuara[p] = 0);

        DESA_NAMES.forEach(desa => {
          const id = `${tahun}_${tingkat}_${desa}`;
          const tData = tpsDataRaw[id] || {};
          Object.values(tData).forEach(tpsVotes => {
            partaiList.forEach(p => {
              const v = parseInt(tpsVotes[p]) || 0;
              stats[tahun][tingkat].totalSuara[p] += v;
              stats[tahun][tingkat].totalKeseluruhan += v;
            });
          });
        });
      });
    });
    return stats;
  }, [tpsDataRaw]);

  // --- AUTH LOGIC ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    try {
      const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPin);
      if (ADMIN_EMAILS.includes(cred.user.email)) {
        setIsAdminLoggedIn(true);
        setErrorLogin('');
      } else {
        setErrorLogin('Email tidak memiliki akses admin');
        await signOut(auth);
      }
    } catch (err) {
      console.error(err);
      setErrorLogin('Login Firebase gagal');
    }
  };

  if (!isAdminLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">SERDADU</h1>
            <p className="text-slate-500 font-semibold tracking-widest text-sm mt-1">ANALYZER SYSTEM</p>
          </div>
          <form onSubmit={handleAdminLogin}>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Admin Email</label>
              <input 
                type="email"
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Masukkan Email Admin"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              <label className="block text-sm font-medium text-slate-700 mb-2 mt-4">Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Masukkan PIN"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
              />
              {errorLogin && <p className="text-red-500 text-sm mt-2">{errorLogin}</p>}
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors">
              LOGIN SYSTEM
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-slate-400">
            Secure connection established. V2.0 Enterprise
          </div>
        </div>
      </div>
    );
  }

  // --- PREPARE CURRENT VIEW DATA ---
  const currentTpsDataId = `${filterTahun}_${filterTingkat}_${filterDesa}`;
  const currentTpsData = tpsDataRaw[currentTpsDataId] || {};
  const currentVillageMetaId = `${filterTahun}_${filterTingkat}_${filterDesa}`;
  const currentVillageMeta = villageDataRaw[currentVillageMetaId] || { dpt: 0, sah: 0, tidakSah: 0 };

  // --- SAVE HANDLERS ---
  const handleSaveTpsData = async (desa, tpsIndex, partai, value) => {
    if (!user) return;
    setIsSyncing(true);
    const docId = `${filterTahun}_${filterTingkat}_${desa}`;
    const currentData = tpsDataRaw[docId] || {};
    
    // Deep copy to mutate
    const newData = JSON.parse(JSON.stringify(currentData));
    if (!newData[tpsIndex]) newData[tpsIndex] = {};
    newData[tpsIndex][partai] = value === '' ? 0 : parseInt(value);

    try {
      await setDoc(doc(db, getCollectionPath('tps_data_v1'), docId), { data: newData }, { merge: true });
    } catch (err) {
      console.error("Save failed", err);
    }
    setIsSyncing(false);
  };

  const handleSaveVillageMeta = async (field, value) => {
    if (!user) return;
    setIsSyncing(true);
    const docId = currentVillageMetaId;
    try {
      await setDoc(doc(db, getCollectionPath('village_meta_v1'), docId), { [field]: parseInt(value) || 0 }, { merge: true });
    } catch (err) {
      console.error("Save meta failed", err);
    }
    setIsSyncing(false);
  };

  const exportToExcel = () => {
    const partaiList = getPartaiList(filterTingkat);
    let csvContent = `DATA SERDADU ANALYZER\nTahun,${filterTahun}\nTingkat,${filterTingkat}\nDesa,${filterDesa}\n\n`;
    
    // Headers
    csvContent += `Partai,` + Array.from({length: DESA_DATA[filterDesa].tps}, (_, i) => `TPS ${i+1}`).join(',') + `\n`;
    
    // Data Rows
    partaiList.forEach(partai => {
      let row = `${partai},`;
      const rowData = [];
      for(let i=1; i<=DESA_DATA[filterDesa].tps; i++) {
        rowData.push(currentTpsData[i]?.[partai] || 0);
      }
      row += rowData.join(',') + `\n`;
      csvContent += row;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data_${filterTingkat}_${filterDesa}_${filterTahun}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-20 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-black text-white tracking-tight">SERDADU</h1>
          <p className="text-blue-400 text-xs font-bold tracking-widest mt-1">ANALYZER</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', name: 'Dashboard Analisa', icon: Icons.Dashboard },
            { id: 'matrix', name: 'Input Matrix TPS', icon: Icons.Table },
            { id: 'desa', name: 'Input Rekap Desa', icon: Icons.Form },
             { id: 'ai', name: 'AI Strategi 3.0', icon: Icons.Dashboard },
            { id: 'prediksi', name: 'AI Prediksi TPS', icon: Icons.Dashboard },
            { id: 'heatmap', name: 'Heatmap Politik', icon: Icons.Dashboard },
            
            
            { id: 'kpu', name: 'Auto Scraping KPU', icon: Icons.Dashboard },
            { id: 'heatmap_desa', name: 'Heatmap Seluruh Desa', icon: Icons.Dashboard },
            { id: 'pdip_ai', name: 'AI Strategi PDIP', icon: Icons.Dashboard },
            { id: 'intelijen', name: 'Dashboard Intelijen', icon: Icons.Dashboard },

            { id: 'peta', name: 'Peta Kekuatan', icon: Icons.Dashboard },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon />
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={async () => {
              await signOut(auth);
              setIsAdminLoggedIn(false);
            }} className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors w-full px-4 py-2">
            <Icons.Logout /> <span>Logout Admin</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* HEADER FILTERS */}
        <header className="bg-white shadow-sm border-b border-slate-200 p-4 z-10 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase">Tahun</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {TAHUN_LIST.map(thn => (
                    <button key={thn} onClick={() => setFilterTahun(thn)} className={`px-4 py-1 text-sm font-semibold rounded-md transition-all ${filterTahun === thn ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      {thn}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col">
                <label className="text-xs font-bold text-slate-500 uppercase">Tingkat</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {TINGKAT_LIST.map(tgkt => (
                    <button key={tgkt} onClick={() => setFilterTingkat(tgkt)} className={`px-4 py-1 text-sm font-semibold rounded-md transition-all ${filterTingkat === tgkt ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}>
                      {tgkt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(activeTab === 'matrix' || activeTab === 'desa') && (
              <div className="flex items-center space-x-4">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-slate-500 uppercase">Desa Kec. Puger</label>
                  <select 
                    value={filterDesa} 
                    onChange={(e) => setFilterDesa(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-48 p-2"
                  >
                    {DESA_NAMES.map(desa => <option key={desa} value={desa}>{desa}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end h-full pt-4">
                   <button onClick={exportToExcel} className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                     <Icons.Download /> <span>Export Excel</span>
                   </button>
                </div>
              </div>
            )}
            
            {isSyncing && <div className="text-xs text-blue-500 font-bold animate-pulse">Syncing to Cloud...</div>}
          </div>
        </header>

        {/* DYNAMIC VIEW */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6 relative">
          {activeTab === 'dashboard' && <DashboardView aggregatedStats={aggregatedStats} tingkat={filterTingkat} partaiList={getPartaiList(filterTingkat)} />}
          {activeTab === 'matrix' && (
            <MatrixInputView 
              desa={filterDesa} 
              tingkat={filterTingkat}
              tahun={filterTahun}
              partaiList={getPartaiList(filterTingkat)} 
              desaConfig={DESA_DATA[filterDesa]}
              data={currentTpsData}
              onSave={handleSaveTpsData}
            />
          )}
          
{activeTab === 'prediksi' && (
  <PrediksiTPSView tpsDataRaw={tpsDataRaw} desa={filterDesa} tingkat={filterTingkat} tahun={filterTahun} />
)}
{activeTab === 'heatmap' && (
  <HeatmapPolitikView tpsDataRaw={tpsDataRaw} desa={filterDesa} />
)}

{activeTab === 'kpu' && (
  <KPUScrapeView />
)}
{activeTab === 'heatmap_desa' && (
  <HeatmapDesaView aggregatedStats={aggregatedStats} />
)}
{activeTab === 'pdip_ai' && (
  <PDIPStrategyView aggregatedStats={aggregatedStats} />
)}
{activeTab === 'intelijen' && (
  <IntelijenDashboardView aggregatedStats={aggregatedStats} />
)}

 // Prepare data for 2019 vs 2024 comparison
const chartData = useMemo(() => {
  return partaiList.map(partai => {
    const v2019 = aggregatedStats['2019'][tingkat].totalSuara[partai] || 0;
    const v2024 = aggregatedStats['2024'][tingkat].totalSuara[partai] || 0;

    return {
      name: partai,
      'Suara 2019': v2019,
      'Suara 2024': v2024,
      kenaikan: v2024 - v2019,
      persentase:
        v2019 === 0
          ? v2024 > 0
            ? 100
            : 0
          : ((v2024 - v2019) / v2019 * 100).toFixed(1)
    };
  });
}, [aggregatedStats, tingkat, partaiList]);

  return (
    <div className="space-y-6 fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Dashboard Analitik: {tingkat}</h2>
          <p className="text-slate-500 text-sm mt-1">Komparasi Perolehan Suara Partai Kec. Puger (2019 vs 2024)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-bold text-slate-700 mb-6">Grafik Komparasi</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#64748b'}} interval={0} angle={-30} textAnchor="end" />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="Suara 2019" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Suara 2024" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Analysis Table */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <h3 className="text-lg font-bold text-slate-700 mb-4">Analisa Tren</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
            <div className="space-y-3">
              {chartData.sort((a,b) => b.kenaikan - a.kenaikan).map((data, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: PARTAI_COLORS[data.name] || '#ccc'}}></div>
                    <div>
                      <div className="text-sm font-bold text-slate-800">{data.name}</div>
                      <div className="text-xs text-slate-500">{data['Suara 2024'].toLocaleString()} suara</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${data.kenaikan > 0 ? 'text-emerald-600' : data.kenaikan < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {data.kenaikan > 0 ? '+' : ''}{data.kenaikan.toLocaleString()}
                    </div>
                    <div className={`text-xs ${data.kenaikan > 0 ? 'text-emerald-500' : data.kenaikan < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {data.kenaikan > 0 ? '▲' : data.kenaikan < 0 ? '▼' : '-'} {data.persentase}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------
// Matrix Input View with Reusable Rows
// ------------------------------------------

function MatrixInputView({ desa, tingkat, tahun, partaiList, desaConfig, data, onSave }) {
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteData, setPasteData] = useState('');

  // Find dusun boundaries to draw thick borders
  const boundaryColumns = useMemo(() => {
    const borders = new Set();
    desaConfig.dusun.forEach(d => {
      borders.add(d.range[1]); // The last TPS of each dusun gets a right border
    });
    return borders;
  }, [desaConfig]);

  const handlePasteProcess = () => {
    // Basic Excel TSV parser
    const rows = pasteData.trim().split('\n');
    rows.forEach((row, rowIdx) => {
      if(rowIdx >= partaiList.length) return; // Ignore extra rows
      const partai = partaiList[rowIdx];
      const cols = row.split('\t');
      
      cols.forEach((val, colIdx) => {
        const tpsNum = colIdx + 1;
        if(tpsNum <= desaConfig.tps) {
          const parsedVal = parseInt(val.replace(/\D/g, ''));
          if(!isNaN(parsedVal)) {
            onSave(desa, tpsNum, partai, parsedVal);
          }
        }
      });
    });
    setShowPasteModal(false);
    setPasteData('');
  };

  return (
    <div className="flex flex-col h-full absolute inset-0 p-6 fade-in">
      <div className="flex justify-between items-end mb-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Matrix Hasil TPS</h2>
          <p className="text-slate-500 text-sm mt-1">{desa} - {tingkat} ({tahun}) | Total {desaConfig.tps} TPS</p>
        </div>
        <button 
          onClick={() => setShowPasteModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          Paste dari Excel
        </button>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
        <div className="overflow-auto flex-1 custom-scrollbar absolute inset-0">
          <table className="w-full text-sm text-left border-collapse min-w-max">
            <thead className="text-xs text-slate-700 uppercase bg-slate-100 sticky top-0 z-20 shadow-sm">
              {/* Dusun Header Row */}
              <tr>
                <th className="px-4 py-3 border-r-2 border-slate-300 bg-slate-200 sticky left-0 z-30 min-w-[150px]">PARTAI</th>
                {desaConfig.dusun.map((d, idx) => (
                  <th 
                    key={idx} 
                    colSpan={d.range[1] - d.range[0] + 1} 
                    className="px-2 py-2 text-center border-r-4 border-slate-800 border-b border-slate-300 font-black tracking-wider text-slate-800 bg-slate-100"
                  >
                    {d.name}
                  </th>
                ))}
              </tr>
              {/* TPS Header Row */}
              <tr>
                <th className="px-4 py-2 border-r-2 border-slate-300 bg-slate-200 sticky left-0 z-30 shadow-sm"></th>
                {Array.from({length: desaConfig.tps}, (_, i) => i + 1).map(tpsNum => (
                  <th 
                    key={tpsNum} 
                    className={`px-2 py-2 text-center border-b border-slate-300 bg-slate-50
                      ${boundaryColumns.has(tpsNum) ? 'border-r-4 border-slate-800' : 'border-r border-slate-200'}
                    `}
                  >
                    TPS {tpsNum}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {partaiList.map((partai, pIdx) => (
                <TpsMatrixRow 
                  key={partai}
                  partai={partai}
                  tpsCount={desaConfig.tps}
                  rowData={data}
                  boundaryColumns={boundaryColumns}
                  desa={desa}
                  onSave={onSave}
                  isEven={pIdx % 2 === 0}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PASTE MODAL */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Input Massal (Paste dari Excel)</h3>
            <p className="text-sm text-slate-500 mb-4">
              Copy baris data dari Excel (Hanya Angka). Pastikan urutan baris partai sesuai dengan format di layar ini.<br/>
              Kolom = TPS 1 hingga {desaConfig.tps}.
            </p>
            <textarea 
              className="w-full h-48 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm whitespace-pre"
              placeholder="Paste data excel di sini..."
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
            ></textarea>
            <div className="flex justify-end space-x-3 mt-4">
              <button onClick={() => setShowPasteModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Batal</button>
              <button onClick={handlePasteProcess} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Proses Data</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Optimized Row Component to prevent full table re-render on single keystroke
const TpsMatrixRow = memo(({ partai, tpsCount, rowData, boundaryColumns, desa, onSave, isEven }) => {
  return (
    <tr className={`${isEven ? 'bg-white' : 'bg-slate-50'} hover:bg-blue-50/50 transition-colors`}>
      <td className="px-4 py-2 border-r-2 border-slate-300 font-bold sticky left-0 z-10 bg-inherit whitespace-nowrap shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full" style={{backgroundColor: PARTAI_COLORS[partai] || '#000'}}></div>
          <span>{partai}</span>
        </div>
      </td>
      {Array.from({length: tpsCount}, (_, i) => i + 1).map(tpsNum => (
        <td 
          key={tpsNum} 
          className={`p-1
            ${boundaryColumns.has(tpsNum) ? 'border-r-4 border-slate-800' : 'border-r border-slate-200'}
            border-b border-slate-200
          `}
        >
          <DebouncedInput 
            initialValue={rowData[tpsNum]?.[partai] || ''}
            onChange={(val) => onSave(desa, tpsNum, partai, val)}
          />
        </td>
      ))}
    </tr>
  );
});

// Debounced Input to prevent extreme lag
function DebouncedInput({ initialValue, onChange }) {
  const [value, setValue] = useState(initialValue);
  
  // Sync if external data changes (e.g. paste or snapshot)
  useEffect(() => {
    setValue(initialValue === 0 ? '' : initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    if(value !== initialValue) {
      onChange(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur(); // Trigger save on enter
    }
  };

  return (
    <input 
      type="number" 
      min="0"
      className="w-14 text-center p-1.5 text-sm bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded outline-none transition-all hide-arrows"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

// ------------------------------------------
// Desa Input View (Summary Form)
// ------------------------------------------

function DesaInputView({ desa, tingkat, tahun, partaiList, tpsData, metaData, onSaveMeta }) {
  // Aggregate totals from current TPS Data
  const aggregatedTotals = useMemo(() => {
    let totals = {};
    let grandTotal = 0;
    partaiList.forEach(p => totals[p] = 0);
    
    Object.values(tpsData).forEach(tpsVotes => {
      partaiList.forEach(p => {
        const val = parseInt(tpsVotes[p]) || 0;
        totals[p] += val;
        grandTotal += val;
      });
    });
    return { partai: totals, grandTotal };
  }, [tpsData, partaiList]);

  // Total Suara (Otomatis: Sah + Tidak Sah)
  const calculatedTotalSuara = (metaData.sah || 0) + (metaData.tidakSah || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 fade-in pb-10">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-6 border-b pb-4">
          Rekapitulasi Manual Desa {desa} - {tingkat} ({tahun})
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 block">Jumlah DPT</label>
            <input 
              type="number" 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
              value={metaData.dpt || ''}
              onChange={(e) => onSaveMeta('dpt', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 block">Suara Sah (Manual)</label>
            <input 
              type="number" 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold text-emerald-600"
              value={metaData.sah || ''}
              onChange={(e) => onSaveMeta('sah', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 block">Suara Tidak Sah (Manual)</label>
            <input 
              type="number" 
              className="w-full p-3 bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold text-red-600"
              value={metaData.tidakSah || ''}
              onChange={(e) => onSaveMeta('tidakSah', e.target.value)}
            />
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-800">Total Suara (Auto: Sah + Tidak Sah)</div>
            <div className="text-xs text-blue-600 mt-1">Sistem menjumlahkan input manual di atas.</div>
          </div>
          <div className="text-3xl font-black text-blue-700">{calculatedTotalSuara.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>Perolehan Partai (Auto Sum dari Matrix TPS)</span>
          <span className="text-sm font-normal text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            Total Valid: {aggregatedTotals.grandTotal.toLocaleString()}
          </span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {partaiList.map(partai => (
            <div key={partai} className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex flex-col items-center text-center">
               <div className="w-10 h-1 rounded-full mb-3" style={{backgroundColor: PARTAI_COLORS[partai] || '#ccc'}}></div>
               <div className="text-xs font-bold text-slate-500 mb-1">{partai}</div>
               <div className="text-2xl font-black text-slate-800">{aggregatedTotals.partai[partai].toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


// ==========================================
// SERDADU ANALYZER 3.0 - AI STRATEGY VIEW
// ==========================================
function AIStrategyView({ aggregatedStats, tingkat, desa }) {
  const analysis = Object.entries(aggregatedStats['2024'][tingkat].totalSuara)
    .map(([partai, suara]) => ({ partai, suara }))
    .sort((a,b)=>b.suara-a.suara);

  const top = analysis[0];
  const swing = analysis[1];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">AI Strategi Politik Desa {desa}</h2>
        <p className="text-slate-500">Analisis otomatis kekuatan partai dan rekomendasi strategi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white p-6 rounded-xl border">
          <h3 className="font-bold mb-2">Partai Terkuat</h3>
          <div className="text-3xl font-black text-red-600">{top.partai}</div>
          <div className="text-sm text-slate-500">{top.suara.toLocaleString()} suara</div>
        </div>

        <div className="bg-white p-6 rounded-xl border">
          <h3 className="font-bold mb-2">Swing Competitor</h3>
          <div className="text-3xl font-black text-blue-600">{swing.partai}</div>
          <div className="text-sm text-slate-500">{swing.suara.toLocaleString()} suara</div>
        </div>

        <div className="bg-white p-6 rounded-xl border">
          <h3 className="font-bold mb-2">Prediksi Pemenang</h3>
          <div className="text-3xl font-black">{top.partai}</div>
          <div className="text-sm text-slate-500">Prediksi berdasarkan tren suara 2024</div>
        </div>

      </div>

      <div className="bg-white p-6 rounded-xl border">
        <h3 className="font-bold mb-4">Rekomendasi Strategi AI</h3>

        <ul className="space-y-2 text-sm text-slate-700">
          <li>• Fokus kampanye di TPS dengan selisih suara tipis.</li>
          <li>• Perkuat struktur anak ranting di dusun dengan partisipasi rendah.</li>
          <li>• Maksimalkan pemilih tetap (DPT) yang belum hadir.</li>
          <li>• Gunakan tokoh lokal untuk meningkatkan elektabilitas.</li>
        </ul>
      </div>
    </div>
  );
}




// ==========================================
// SERDADU ANALYZER 4.0 MODULES
// ==========================================

function PrediksiTPSView({ tpsDataRaw, desa, tingkat, tahun }) {
  const id = `${tahun}_${tingkat}_${desa}`;
  const data = tpsDataRaw[id] || {};
  const tpsCount = Object.keys(data).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">AI Prediksi Per TPS</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(data).map(([tps, votes]) => {
          const sorted = Object.entries(votes).sort((a,b)=>b[1]-a[1]);
          const top = sorted[0];
          return (
            <div key={tps} className="p-4 border rounded-xl bg-white">
              <div className="text-xs text-slate-500">TPS {tps}</div>
              <div className="text-lg font-bold">{top?.[0]}</div>
              <div className="text-xs text-slate-500">{top?.[1]} suara</div>
            </div>
          )
        })}
      </div>
    </div>
  );
}

function HeatmapPolitikView({ tpsDataRaw, desa }) {
  const keys = Object.keys(tpsDataRaw).filter(k=>k.includes(desa));
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Heatmap Politik Desa {desa}</h2>
      <p className="text-slate-500 text-sm">Visualisasi TPS kuat vs lemah berdasarkan perolehan suara.</p>
      <div className="grid grid-cols-5 gap-2 mt-6">
        {keys.map((k,i)=>(
          <div key={i} className="p-6 border rounded-lg bg-white text-xs">
            {k}
          </div>
        ))}
      </div>
    </div>
  )
}

function SimulasiCalegView({ aggregatedStats, tingkat }) {
  const data = aggregatedStats['2024'][tingkat].totalSuara;
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Simulasi Kemenangan Caleg</h2>
      {sorted.map(([p,v],i)=>(
        <div key={i} className="flex justify-between p-4 bg-white border rounded-lg">
          <div>{p}</div>
          <div>{v} suara</div>
        </div>
      ))}
    </div>
  )
}

function PetaKekuatanView({ aggregatedStats }) {
  const desa = Object.keys(aggregatedStats['2024']['KAB'].totalSuara);
  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Peta Kekuatan Politik Kecamatan</h2>
      <p className="text-sm text-slate-500">Distribusi kekuatan partai di seluruh desa.</p>
      <div className="grid grid-cols-3 gap-4 mt-6">
        {desa.map((d,i)=>(
          <div key={i} className="p-6 border rounded-xl bg-white">
            {d}
          </div>
        ))}
      </div>
    </div>
  )
}



// ------------------------------------------
// Embedded CSS directly inside component to satisfy Single-File Rule perfectly
// ------------------------------------------
const style = document.createElement('style');
style.textContent = `
  .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  .hide-arrows::-webkit-outer-spin-button, .hide-arrows::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .hide-arrows { -moz-appearance: textfield; }
  .fade-in { animation: fadeIn 0.3s ease-in-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
`;
document.head.appendChild(style);

// ==========================================
// SERDADU ANALYZER 6.0 MODULES
// ==========================================

function KPUScrapeView(){

 const [url,setUrl] = React.useState("")
 const [data,setData] = React.useState("")

 const scrape = async () => {

  try{
   const res = await fetch(url)
   const text = await res.text()
   setData(text.substring(0,2000))
  }catch(e){
   setData("Scraping gagal. Biasanya karena CORS dari website KPU.")
  }

 }

 return(
 <div className="space-y-4">
  <h2 className="text-2xl font-bold">Auto Scraping Website KPU</h2>

  <input
   className="border p-2 w-full"
   placeholder="Masukkan URL website KPU"
   value={url}
   onChange={e=>setUrl(e.target.value)}
  />

  <button
   onClick={scrape}
   className="bg-blue-600 text-white px-4 py-2 rounded"
  >
   Scrape Data
  </button>

  <pre className="bg-white p-4 border rounded text-xs overflow-auto">
   {data}
  </pre>
 </div>
 )
}


function HeatmapDesaView({aggregatedStats}){

 const desaList = Object.keys(aggregatedStats["2024"]["KAB"].totalSuara)

 return(
 <div>
 <h2 className="text-2xl font-bold mb-6">Heatmap Politik Seluruh Desa</h2>

 <div className="grid grid-cols-3 gap-4">

 {desaList.map((d,i)=>{

   const value = aggregatedStats["2024"]["KAB"].totalSuara[d] || 0

   const color =
     value > 5000 ? "bg-red-600"
     : value > 2000 ? "bg-orange-500"
     : "bg-green-500"

   return(
    <div key={i} className={`p-6 text-white rounded-xl ${color}`}>
     {d}
     <div className="text-xs opacity-80">
       indeks kekuatan
     </div>
    </div>
   )

 })}

 </div>
 </div>
 )
}


function PDIPStrategyView({aggregatedStats}){

 const v2019 = aggregatedStats["2019"]["KAB"].totalSuara["PDI PERJUANGAN"] || 0
 const v2024 = aggregatedStats["2024"]["KAB"].totalSuara["PDI PERJUANGAN"] || 0

 const growth = v2024 - v2019

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold text-red-600">
 AI Strategi Khusus PDI Perjuangan
 </h2>

 <div className="bg-white p-6 rounded-xl border">

 <p>Suara 2019 : {v2019}</p>
 <p>Suara 2024 : {v2024}</p>
 <p className="font-bold mt-2">Trend : {growth}</p>

 </div>

 <div className="bg-white p-6 rounded-xl border">

 <h3 className="font-bold mb-4">Rekomendasi AI</h3>

 <ul className="list-disc ml-6 space-y-2">

 <li>Fokus TPS dengan suara PDIP dibawah rata-rata</li>
 <li>Aktifkan mesin partai ranting</li>
 <li>Mobilisasi pemilih nelayan & petani</li>
 <li>Perkuat saksi TPS</li>

 </ul>

 </div>

 </div>

 )

}


function IntelijenDashboardView({aggregatedStats}){

 const data = aggregatedStats["2024"]["KAB"].totalSuara

 const ranking = Object.entries(data)
  .sort((a,b)=>b[1]-a[1])

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold">
 Dashboard Intelijen Politik
 </h2>

 <div className="bg-white rounded-xl border">

 {ranking.map(([p,v],i)=>(

  <div
   key={i}
   className="flex justify-between p-4 border-b"
  >

   <div className="font-bold">
     {i+1}. {p}
   </div>

   <div>
     {v.toLocaleString()} suara
   </div>

  </div>

 ))}

 </div>

 </div>

 )

}



// ==========================================
// SERDADU ANALYZER 7.0 MODULE
// Tambahan tanpa merubah sistem lama
// ==========================================

// ==========================================
// DETEKSI TPS RAWAN KALAH
// ==========================================

export function DeteksiTPSRawan({tpsData}){

 if(!tpsData) return null

 const rawan = Object.entries(tpsData)
  .filter(([tps,data])=>{
    const pdip = data["PDI-P"] || 0
    const max = Math.max(...Object.values(data))
    return pdip < max
  })

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold text-red-700">
 Deteksi TPS Rawan Kalah
 </h2>

 <div className="bg-white border rounded-xl">

 {rawan.map(([tps,data],i)=>{

   const pdip = data["PDI-P"] || 0
   const leader = Object.entries(data).sort((a,b)=>b[1]-a[1])[0]

   return(

   <div key={i} className="flex justify-between border-b p-4">

    <div className="font-semibold">
     TPS {tps}
    </div>

    <div>
     PDIP : {pdip}
    </div>

    <div className="text-red-600">
     Unggul : {leader[0]}
    </div>

   </div>

   )

 })}

 </div>

 </div>

 )

}



// ==========================================
// POLITICAL WAR ROOM DASHBOARD
// ==========================================

export function PoliticalWarRoom({desaStats}){

 if(!desaStats) return null

 const ranking = Object.entries(desaStats)
  .sort((a,b)=>b[1]-a[1])

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold text-black">
 Political War Room Dashboard
 </h2>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

 {ranking.map(([desa, suara],i)=>{

  let color = "bg-gray-200"

  if(suara > 3000) color="bg-green-300"
  else if(suara > 1500) color="bg-yellow-300"
  else color="bg-red-300"

  return(

  <div key={i} className={`p-6 rounded-xl ${color}`}>
  
   <div className="text-lg font-bold">
    {desa}
   </div>

   <div className="text-3xl font-bold mt-2">
    {suara}
   </div>

   <div className="text-sm mt-2">
    Status kekuatan politik
   </div>

  </div>

  )

 })}

 </div>

 </div>

 )

}


// ==========================================
// EXPORT VERSION TAG
// ==========================================

export const SERDADU_VERSION = "7.0 POLITICAL WAR ROOM"



// ==========================================
// SERDADU ANALYZER 8.0 MODULE
// Penambahan fitur tanpa merubah modul lama
// ==========================================


// ==========================================
// SWING VOTER DETECTOR AI
// ==========================================
export function SwingVoterDetector({data}){

 if(!data) return null

 const swing = Object.entries(data).filter(([tps,val])=>{
   const values = Object.values(val)
   const max = Math.max(...values)
   const min = Math.min(...values)
   return (max - min) < 50
 })

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold text-purple-700">
 Deteksi Swing Voters
 </h2>

 <div className="bg-white border rounded-xl">

 {swing.map(([tps,val],i)=>{

  return(

  <div key={i} className="flex justify-between p-4 border-b">

   <div className="font-semibold">
   TPS {tps}
   </div>

   <div className="text-sm text-gray-600">
   Persaingan ketat antar partai
   </div>

  </div>

  )

 })}

 </div>

 </div>

 )

}



// ==========================================
// AI STRATEGI KAMPANYE OTOMATIS PER DESA
// ==========================================
export function AIStrategiDesa({desaStats}){

 if(!desaStats) return null

 const strategi = Object.entries(desaStats).map(([desa,val])=>{

   let rekomendasi = "Perkuat struktur ranting"

   if(val < 1000) rekomendasi = "Prioritas kampanye intensif"
   else if(val < 2000) rekomendasi = "Tambahkan relawan TPS"
   else rekomendasi = "Pertahankan basis kuat"

   return {desa,val,rekomendasi}

 })

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold text-red-700">
 AI Strategi Kampanye Desa
 </h2>

 <div className="grid md:grid-cols-2 gap-4">

 {strategi.map((s,i)=>(

  <div key={i} className="p-5 border rounded-xl bg-white">

   <div className="font-bold text-lg">
   {s.desa}
   </div>

   <div className="text-2xl font-bold mt-1">
   {s.val}
   </div>

   <div className="text-sm text-gray-600 mt-2">
   {s.rekomendasi}
   </div>

  </div>

 ))}

 </div>

 </div>

 )

}



// ==========================================
// DASHBOARD INTELIJEN POLITIK
// ==========================================
export function PoliticalIntelDashboard({kecamatanData}){

 if(!kecamatanData) return null

 const total = Object.values(kecamatanData).reduce((a,b)=>a+b,0)

 return(

 <div className="space-y-6">

 <h2 className="text-2xl font-bold">
 Dashboard Intelijen Politik
 </h2>

 <div className="grid md:grid-cols-4 gap-4">

 <div className="p-6 bg-red-100 rounded-xl">
 <div className="text-sm">Total Suara</div>
 <div className="text-3xl font-bold">{total}</div>
 </div>

 <div className="p-6 bg-green-100 rounded-xl">
 <div className="text-sm">Desa Dipantau</div>
 <div className="text-3xl font-bold">
 {Object.keys(kecamatanData).length}
 </div>
 </div>

 <div className="p-6 bg-yellow-100 rounded-xl">
 <div className="text-sm">Status</div>
 <div className="text-xl font-bold">
 Monitoring Aktif
 </div>
 </div>

 <div className="p-6 bg-blue-100 rounded-xl">
 <div className="text-sm">Mode</div>
 <div className="text-xl font-bold">
 War Room
 </div>
 </div>

 </div>

 </div>

 )

}



// ==========================================
// VERSION TAG
// ==========================================
export const SERDADU_VERSION_8 = "8.0 INTEL POLITICAL ENGINE"

