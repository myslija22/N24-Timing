/* STREAMING_CHUNK:Imports and Constants Setup */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Flag, AlertTriangle, Clock, Activity, ShieldAlert, WifiOff, 
  Search, ChevronUp, ChevronDown, ChevronRight, TrendingUp, 
  TrendingDown, Minus, Car, Zap, RefreshCw, Power
} from 'lucide-react';

const TRACK_STATUSES = [
  { code: 'GREEN', text: 'Track Clear', color: 'bg-green-600', textColor: 'text-white' },
  { code: 'YELLOW', text: 'Local Yellow', color: 'bg-yellow-500', textColor: 'text-gray-900' },
  { code: 'CODE60', text: 'CODE 60', color: 'bg-purple-600', textColor: 'text-white' }
];

/* STREAMING_CHUNK:Mock Data Generator for Demo Mode */
// Pre-defined base cars for the demo mode
const MOCK_BASE_CARS = [
  { id: '1', class: 'SP 9', number: '1', team: 'Frikadelli Racing Team', car: 'Ferrari 296 GT3', driver: 'Bamber, Catsburg, Pittard, Fernandez Laser' },
  { id: '911', class: 'SP 9', number: '911', team: 'Manthey EMA', car: 'Porsche 911 GT3 R', driver: 'Estre, Güven, Preining, Ten Voorde' },
  { id: '3', class: 'SP 9', number: '3', team: 'Mercedes-AMG Team Bilstein', car: 'Mercedes-AMG GT3', driver: 'Maini, Bird, Owega, Beretta' },
  { id: '98', class: 'SP 9', number: '98', team: 'ROWE RACING', car: 'BMW M4 GT3', driver: 'Marciello, Martin, Wittmann, Farfus' },
  { id: '20', class: 'SP-PRO', number: '20', team: 'Scherer Sport PHX', car: 'Audi R8 LMS GT3', driver: 'Schramm, Berhorst, Winkelhock' },
  { id: '188', class: 'SP 10', number: '188', team: 'PROsport-Racing', car: 'Aston Martin Vantage GT4', driver: 'Böckmann, Müller, Rindone' },
  { id: '333', class: 'TCR', number: '333', team: 'Hyundai Motorsport N', car: 'Hyundai Elantra TCR', driver: 'Basseng, Lauck, Michelisz' },
  { id: '120', class: 'Cup 2', number: '120', team: 'KKrämer Racing', car: 'Porsche 911 GT3 Cup', driver: 'Krämer, Brück, Kranz' },
  { id: '80', class: 'SP-X', number: '80', team: 'Glickenhaus Racing', car: 'SCG 004c', driver: 'Mutsch, Mailleux, Arnold, Ledogar' },
  { id: '50', class: 'V2T', number: '50', team: 'Adrenalin Motorsport', car: 'BMW 330i', driver: 'Kruse, Griessner, Rink' },
];

/* STREAMING_CHUNK:Main Component & State Initialization */
export default function App() {
  const [cars, setCars] = useState([]);
  const [trackStatus, setTrackStatus] = useState(TRACK_STATUSES[0]);
  const [filterClass, setFilterClass] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  // Connection & Demo states
  const [isConnected, setIsConnected] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  // Interactive UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCarId, setExpandedCarId] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'pos', direction: 'asc' });
  
  // Refs for tracking changes
  const prevPositionsRef = useRef({});
  const positionTrendsRef = useRef({}); // Tracks if they moved up or down

  /* STREAMING_CHUNK:Data Transformation Logic */
  const transformN24Data = (rawData) => {
    if (!rawData || !rawData.RESULT) return [];

    return rawData.RESULT.map((car) => {
      const inPit = car.S9TIME === 'PIT' || car.S8TIME === 'PIT';
      return {
        id: car.STNR,
        pos: parseInt(car.POSITION) || 0,
        classPos: parseInt(car.CLASSRANK) || 0,
        number: car.STNR,
        class: car.CLASSNAME,
        team: car.TEAM || 'Unknown',
        car: car.CAR || 'Unknown',
        driver: car.NAME || 'Unknown',
        gap: car.GAP?.replace('----', '') || '-', 
        interval: car.INT || '-',
        lastLap: car.LASTLAPTIME || '-',
        bestLap: car.FASTESTLAP || '-',
        pits: parseInt(car.PITSTOPCOUNT) || 0,
        status: inPit ? 'Pit' : 'Track'
      };
    });
  };

  /* STREAMING_CHUNK:Position Trend Calculator */
  // Calculates and stores if a car moved up or down compared to last known position
  const updatePositionTrends = (newCars) => {
    const newTrends = { ...positionTrendsRef.current };
    
    newCars.forEach(car => {
      const prevPos = prevPositionsRef.current[car.id];
      if (prevPos !== undefined) {
        if (car.pos < prevPos) newTrends[car.id] = 'UP';
        else if (car.pos > prevPos) newTrends[car.id] = 'DOWN';
        // If same, keep existing trend for a bit or clear it (we'll keep it for visual stability)
      }
      prevPositionsRef.current[car.id] = car.pos;
    });
    
    positionTrendsRef.current = newTrends;
    return newCars;
  };

  /* STREAMING_CHUNK:WebSocket and Demo Effects */
  useEffect(() => {
    let ws = null;
    let demoInterval = null;

    if (isDemoMode) {
      // --- DEMO MODE LOGIC ---
      setIsConnected(true);
      let currentMockPos = MOCK_BASE_CARS.map((c, i) => ({ ...c, pos: i + 1, pits: Math.floor(Math.random() * 5) }));
      
      demoInterval = setInterval(() => {
        // Randomly shuffle a couple of positions and generate times
        const newData = [...currentMockPos].map(car => {
          const isPit = Math.random() > 0.95;
          const minSec = 8 + Math.floor(Math.random() * 2);
          const sec = Math.floor(Math.random() * 60).toString().padStart(2, '0');
          const ms = Math.floor(Math.random() * 999).toString().padStart(3, '0');
          const lapTime = `${minSec}:${sec}.${ms}`;
          
          return {
            ...car,
            classPos: Math.ceil(car.pos / 2), // Fake class pos
            gap: car.pos === 1 ? '-' : `+${(car.pos * 1.5).toFixed(1)}s`,
            interval: car.pos === 1 ? '-' : `+${(Math.random() * 2).toFixed(3)}s`,
            lastLap: isPit ? 'IN PIT' : lapTime,
            bestLap: `8:12.${Math.floor(Math.random() * 999)}`,
            status: isPit ? 'Pit' : 'Track',
            pits: isPit ? car.pits + 1 : car.pits
          };
        });

        // Occasionally swap positions
        if (Math.random() > 0.7) {
          const idx1 = Math.floor(Math.random() * newData.length);
          const idx2 = Math.floor(Math.random() * newData.length);
          const tempPos = newData[idx1].pos;
          newData[idx1].pos = newData[idx2].pos;
          newData[idx2].pos = tempPos;
        }

        newData.sort((a, b) => a.pos - b.pos);
        currentMockPos = newData;
        
        setCars(updatePositionTrends(newData));
        setLastUpdated(new Date());
        
        // Randomly change track status
        if (Math.random() > 0.9) {
          setTrackStatus(TRACK_STATUSES[Math.floor(Math.random() * TRACK_STATUSES.length)]);
        }
      }, 2000);

    } else {
      // --- REAL WEBSOCKET LOGIC ---
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const isDev = window.location.port.includes('517');
      const finalWsUrl = isDev ? 'ws://localhost:8080' : wsUrl;

      ws = new WebSocket(finalWsUrl);

      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);

      ws.onmessage = (event) => {
        try {
          const liveData = JSON.parse(event.data);
          let processedCars = [];
          
          if (liveData.cars) {
            processedCars = liveData.cars;
            if (liveData.trackStatus) setTrackStatus(liveData.trackStatus);
          } else {
            processedCars = transformN24Data(liveData);
          }
          
          if (processedCars.length > 0) {
            setCars(updatePositionTrends(processedCars));
          }
          setLastUpdated(new Date());
        } catch (err) {
          console.error("Error parsing WebSocket data:", err);
        }
      };
    }

    return () => {
      if (ws) ws.close();
      if (demoInterval) clearInterval(demoInterval);
    };
  }, [isDemoMode]);

  /* STREAMING_CHUNK:Sorting and Filtering Logic */
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const processedData = useMemo(() => {
    // 1. Filter by Class
    let result = filterClass === 'ALL' ? cars : cars.filter(c => c.class === filterClass);

    // 2. Filter by Search Query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.team.toLowerCase().includes(lowerQuery) ||
        c.driver.toLowerCase().includes(lowerQuery) ||
        c.number.toString().includes(lowerQuery)
      );
    }

    // 3. Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle numbers vs strings
      if (sortConfig.key === 'pos' || sortConfig.key === 'pits' || sortConfig.key === 'classPos') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [cars, filterClass, searchQuery, sortConfig]);

  const classes = ['ALL', ...new Set(cars.map(c => c.class).filter(Boolean))].sort();

  /* STREAMING_CHUNK:UI Helper Functions */
  const getClassBadge = (className) => {
    if (!className) return 'bg-gray-600 text-white';
    if (className.includes('SP 9') || className.includes('SP-PRO')) return 'bg-red-600 text-white';
    if (className.includes('Cup 2') || className.includes('Cup 3')) return 'bg-orange-500 text-white';
    if (className.includes('TCR')) return 'bg-blue-600 text-white';
    if (className.includes('SP 10') || className.includes('GT4')) return 'bg-emerald-600 text-white';
    if (className.includes('SP-X')) return 'bg-gray-800 text-white border border-gray-500';
    if (className.includes('VT2') || className.includes('V6') || className.includes('V5')) return 'bg-purple-700 text-white';
    if (className.includes('BMW')) return 'bg-blue-800 text-white';
    return 'bg-gray-600 text-white';
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <Minus className="w-3 h-3 text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp className="w-3 h-3 text-white" /> 
      : <ChevronDown className="w-3 h-3 text-white" />;
  };

  const renderTrendIcon = (id) => {
    const trend = positionTrendsRef.current[id];
    if (trend === 'UP') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'DOWN') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-700" />;
  };

  /* STREAMING_CHUNK:Main Rendering - Header */
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-gray-100 font-sans selection:bg-red-500 selection:text-white pb-12">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#111116]/90 backdrop-blur-md border-b border-gray-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Activity className="text-red-600 w-10 h-10 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]" />
            <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-2">
              N24 Live <span className="text-red-500">Timing</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase">
                {isConnected ? (isDemoMode ? 'SIMULATION ACTIVE' : 'LIVE FEED SECURE') : 'LINK LOST'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search team, driver, car #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-700 rounded-lg leading-5 bg-[#1a1a24] text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-all"
            />
          </div>

          {/* Demo Toggle */}
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
              isDemoMode 
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/50 hover:bg-purple-600/30' 
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
            }`}
          >
            <Zap className={`w-4 h-4 ${isDemoMode ? 'fill-purple-400' : ''}`} />
            {isDemoMode ? 'Demo On' : 'Demo Off'}
          </button>

          {/* Clock */}
          <div className="hidden md:flex flex-col items-end bg-[#1a1a24] px-4 py-1.5 rounded-lg border border-gray-800">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Local Time</span>
            <span className="text-lg font-mono font-bold text-white">
              {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {/* STREAMING_CHUNK:Main Rendering - Status & Filters */}
      {!isConnected && !isDemoMode && (
        <div className="bg-red-900/90 backdrop-blur text-white px-6 py-4 flex items-center justify-center gap-3 border-b border-red-500">
          <WifiOff className="w-5 h-5 animate-pulse" />
          <span className="font-bold tracking-wide">Awaiting Telemetry Link... Ensure WebSocket Server is active or enable Demo Mode.</span>
        </div>
      )}

      {/* Track Status Bar */}
      <div className={`w-full py-3 px-6 flex items-center justify-center gap-4 shadow-[inset_0_-10px_20px_rgba(0,0,0,0.2)] transition-colors duration-700 border-b border-white/10 ${trackStatus.color} ${trackStatus.textColor}`}>
        {trackStatus.code === 'GREEN' && <Flag className="w-8 h-8 drop-shadow-md" />}
        {trackStatus.code === 'YELLOW' && <AlertTriangle className="w-8 h-8 animate-pulse drop-shadow-md" />}
        {trackStatus.code === 'CODE60' && <ShieldAlert className="w-8 h-8 animate-bounce drop-shadow-md" />}
        <span className="text-2xl font-black uppercase tracking-[0.2em] drop-shadow-md">{trackStatus.text}</span>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
            <Car className="w-4 h-4" /> Class Filtering
          </span>
          <div className="flex flex-wrap gap-2">
            {classes.map(cls => (
              <button
                key={cls}
                onClick={() => setFilterClass(cls)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 ${
                  filterClass === cls 
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)] scale-105' 
                    : 'bg-[#1a1a24] text-gray-400 border border-gray-800 hover:border-gray-600 hover:text-white'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-xs text-gray-500 bg-[#1a1a24] px-4 py-2 rounded-full border border-gray-800">
          <RefreshCw className={`w-4 h-4 ${isConnected ? 'animate-spin-slow' : ''}`} />
          <span className="font-mono">Active Frames: {processedData.length}</span>
        </div>
      </div>

      {/* STREAMING_CHUNK:Main Rendering - Interactive Table */}
      <div className="max-w-[1600px] mx-auto px-4 overflow-x-auto pb-20">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-2xl rounded-xl border border-gray-800/60 bg-[#111116]">
            <table className="min-w-full divide-y divide-gray-800/60 relative">
              <thead className="bg-[#1a1a24] sticky top-0 z-10 shadow-md">
                <tr>
                  {[
                    { key: 'pos', label: 'Pos', align: 'left' },
                    { key: 'class', label: 'Class', align: 'left' },
                    { key: 'number', label: '#', align: 'center' },
                    { key: 'team', label: 'Team / Car', align: 'left' },
                    { key: 'driver', label: 'Drivers', align: 'left' },
                    { key: 'gap', label: 'Gap', align: 'right' },
                    { key: 'lastLap', label: 'Last Lap', align: 'right' },
                    { key: 'bestLap', label: 'Best Lap', align: 'right' },
                    { key: 'pits', label: 'Pits', align: 'center' },
                  ].map((col) => (
                    <th 
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      scope="col" 
                      className={`px-4 py-4 text-${col.align} text-[10px] font-black text-gray-400 uppercase tracking-widest cursor-pointer group hover:bg-gray-800/50 transition-colors select-none`}
                    >
                      <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : col.align === 'center' ? 'justify-center' : 'justify-start'}`}>
                        {col.label}
                        <SortIcon columnKey={col.key} />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/40">
                {processedData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-6 py-24 text-center">
                       <div className="flex flex-col items-center justify-center gap-4 text-gray-500">
                          <Activity className="w-12 h-12 animate-pulse" />
                          <p className="font-mono text-lg tracking-widest uppercase">No Active Telemetry</p>
                       </div>
                    </td>
                  </tr>
                ) : (
                  processedData.map((car, idx) => {
                    const isExpanded = expandedCarId === car.id;
                    const isPit = car.status === 'Pit';
                    
                    return (
                      <React.Fragment key={car.id}>
                        <tr 
                          onClick={() => setExpandedCarId(isExpanded ? null : car.id)}
                          className={`
                            group cursor-pointer transition-all duration-200
                            ${idx % 2 === 0 ? 'bg-[#0a0a0c]' : 'bg-[#111116]'}
                            hover:bg-[#1a1a24] 
                            ${isExpanded ? 'ring-1 ring-inset ring-gray-700 bg-[#15151e]' : ''}
                          `}
                        >
                          {/* POS */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {renderTrendIcon(car.id)}
                              <span className={`text-xl font-black tabular-nums ${isExpanded ? 'text-white' : 'text-gray-200'}`}>
                                {car.pos}
                              </span>
                            </div>
                          </td>
                          
                          {/* CLASS */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${getClassBadge(car.class)} shadow-sm`}>
                                {car.class}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono font-bold">P{car.classPos}</span>
                            </div>
                          </td>
                          
                          {/* NUMBER */}
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="inline-flex items-center justify-center w-11 h-8 bg-white text-black font-black text-lg rounded shadow-[inset_0_0_5px_rgba(0,0,0,0.5)] border-2 border-gray-300">
                              {car.number}
                            </div>
                          </td>
                          
                          {/* TEAM / CAR */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-100 truncate max-w-[280px] group-hover:text-white transition-colors">{car.team}</span>
                              <span className="text-xs text-gray-500 truncate max-w-[280px]">{car.car}</span>
                            </div>
                          </td>
                          
                          {/* DRIVER */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs font-medium text-gray-400 truncate max-w-[250px] block group-hover:text-gray-300">{car.driver}</span>
                          </td>
                          
                          {/* GAP */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex flex-col">
                              <span className="text-sm font-mono font-bold text-gray-200 tabular-nums">{car.gap}</span>
                              <span className="text-[10px] font-mono text-gray-600 tabular-nums">{car.interval}</span>
                            </div>
                          </td>
                          
                          {/* LAST LAP */}
                          <td className="px-4 py-3 whitespace-nowrap text-right relative">
                            {isPit && <div className="absolute inset-0 bg-red-900/10 animate-pulse"></div>}
                            <span className={`text-sm font-mono font-bold tabular-nums relative z-10 ${isPit ? 'text-red-500' : 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.3)]'}`}>
                              {isPit ? 'IN PIT' : car.lastLap}
                            </span>
                          </td>
                          
                          {/* BEST LAP */}
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="text-sm font-mono font-medium text-gray-500 tabular-nums">{car.bestLap}</span>
                          </td>
                          
                          {/* PITS */}
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-sm font-mono font-bold text-gray-400">{car.pits}</span>
                              <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-white' : 'opacity-0 group-hover:opacity-100'}`} />
                            </div>
                          </td>
                        </tr>

                        {/* STREAMING_CHUNK:Expandable Telemetry Row */}
                        {isExpanded && (
                          <tr className="bg-[#15151e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.3)]">
                            <td colSpan="9" className="p-0 border-b-2 border-gray-700">
                              <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
                                {/* Focus Panel 1: Team Info */}
                                <div className="bg-[#0a0a0c] p-4 rounded-lg border border-gray-800/50 flex items-start gap-4">
                                  <div className="w-16 h-16 rounded bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center border border-gray-600 shadow-inner shrink-0">
                                    <Car className="w-8 h-8 text-gray-500" />
                                  </div>
                                  <div>
                                    <h4 className="text-white font-black text-lg leading-tight">{car.team}</h4>
                                    <p className="text-gray-400 text-sm mt-1">{car.car}</p>
                                    <div className="mt-3 flex flex-wrap gap-1">
                                      {car.driver.split(',').map((d, i) => (
                                        <span key={i} className="text-[10px] bg-gray-800 px-2 py-1 rounded text-gray-300 uppercase tracking-wide">
                                          {d.trim()}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                {/* Focus Panel 2: Telemetry Mock */}
                                <div className="bg-[#0a0a0c] p-4 rounded-lg border border-gray-800/50 flex flex-col justify-center">
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Sector 1</span>
                                    <span className="text-sm font-mono text-gray-300">{(Math.random() * 2 + 2).toFixed(3)}</span>
                                  </div>
                                  <div className="w-full bg-gray-800 rounded-full h-1.5 mb-4">
                                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.random() * 40 + 40}%` }}></div>
                                  </div>
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-gray-500 uppercase">Sector 2</span>
                                    <span className="text-sm font-mono text-purple-400">{(Math.random() * 2 + 1).toFixed(3)} <Zap className="inline w-3 h-3" /></span>
                                  </div>
                                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${Math.random() * 40 + 60}%` }}></div>
                                  </div>
                                </div>

                                {/* Focus Panel 3: Status Mock */}
                                <div className="bg-[#0a0a0c] p-4 rounded-lg border border-gray-800/50 flex flex-col items-center justify-center">
                                   <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 shadow-lg ${isPit ? 'bg-red-900/50 text-red-500 border-2 border-red-500 animate-pulse' : 'bg-green-900/30 text-green-500 border-2 border-green-800'}`}>
                                      {isPit ? <Power className="w-8 h-8" /> : <Activity className="w-8 h-8" />}
                                   </div>
                                   <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                                      {isPit ? 'Service Active' : 'On Track'}
                                   </span>
                                   <span className="text-[10px] text-gray-600 mt-1">Stint Lap: {Math.floor(Math.random() * 12) + 1}</span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
    </div>
  );
}