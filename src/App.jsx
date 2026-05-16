import React, { useState, useEffect } from 'react';
import { Flag, AlertTriangle, Clock, Activity, ShieldAlert, WifiOff } from 'lucide-react';

const TRACK_STATUSES = [
  { code: 'GREEN', text: 'Track Clear', color: 'bg-green-600', textColor: 'text-white' },
  { code: 'YELLOW', text: 'Local Yellow', color: 'bg-yellow-500', textColor: 'text-gray-900' },
  { code: 'CODE60', text: 'CODE 60', color: 'bg-purple-600', textColor: 'text-white' }
];

export default function App() {
  const [cars, setCars] = useState([]);
  const [trackStatus, setTrackStatus] = useState(TRACK_STATUSES[0]);
  const [filterClass, setFilterClass] = useState('ALL');
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);

  // --- DATA TRANSLATOR ---
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

  // --- WEBSOCKET CONNECTION ---
  useEffect(() => {
    // Dynamically connect to the same host that is serving the website (e.g. Render URL)
    // If it's loaded via https, it uses wss. If http (like localhost), it uses ws.
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    // In local Vite dev mode (port 5173/5174), point to the standalone proxy at 8080 manually
    const isDev = window.location.port.includes('517');
    const finalWsUrl = isDev ? 'ws://localhost:8080' : wsUrl;

    const ws = new WebSocket(finalWsUrl);

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);

    ws.onmessage = (event) => {
      try {
        const liveData = JSON.parse(event.data);
        
        // Use proxy structured format if formatted, else assume direct N24 structure
        if (liveData.cars) {
          setCars(liveData.cars);
          if (liveData.trackStatus) setTrackStatus(liveData.trackStatus);
        } else {
          // Direct fallback
          const formattedCars = transformN24Data(liveData);
          if (formattedCars.length > 0) setCars(formattedCars);
        }
        
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Error parsing WebSocket data:", err);
      }
    };

    return () => ws.close();
  }, []);

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

  const filteredCars = filterClass === 'ALL' ? cars : cars.filter(c => c.class === filterClass);
  const classes = ['ALL', ...new Set(cars.map(c => c.class).filter(Boolean))].sort();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-red-500 selection:text-white pb-12">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex flex-col md:flex-row justify-between items-center shadow-md gap-4">
        <div className="flex items-center gap-3">
          <Activity className="text-red-500 w-8 h-8" />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase">N24 Live Timing</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <p className="text-xs text-gray-400 font-mono">
                {isConnected ? 'LIVE DATA CONNECTED' : 'WEBSOCKET DISCONNECTED'}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-6 bg-gray-950 px-4 py-2 rounded-lg border border-gray-800">
          <div className="flex flex-col items-center">
            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">Local Time</span>
            <span className="text-xl font-mono font-bold text-white">
              {lastUpdated.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>
      </header>

      {!isConnected && (
        <div className="bg-red-900 text-white px-6 py-3 flex items-center justify-center gap-2">
          <WifiOff className="w-5 h-5" />
          <span className="font-bold">Waiting for WebSocket... Make sure your proxy or connection is running.</span>
        </div>
      )}

      <div className={`w-full py-4 px-6 flex items-center justify-center gap-3 shadow-lg transition-colors duration-500 ${trackStatus.color} ${trackStatus.textColor}`}>
        {trackStatus.code === 'GREEN' && <Flag className="w-8 h-8" />}
        {trackStatus.code === 'YELLOW' && <AlertTriangle className="w-8 h-8 animate-pulse" />}
        {trackStatus.code === 'CODE60' && <ShieldAlert className="w-8 h-8 animate-bounce" />}
        <span className="text-3xl font-black uppercase tracking-widest">{trackStatus.text}</span>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-start md:items-center mt-4 gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Filter Class:</span>
          <div className="flex flex-wrap gap-2">
            {classes.map(cls => (
              <button
                key={cls}
                onClick={() => setFilterClass(cls)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  filterClass === cls 
                    ? 'bg-white text-black shadow-lg scale-105' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-500 whitespace-nowrap">
          <Clock className="w-4 h-4" />
          Data Frames Rx: {cars.length > 0 ? 'Active' : 'Waiting...'}
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 overflow-x-auto">
        <div className="inline-block min-w-full align-middle">
          <div className="overflow-hidden shadow-2xl rounded-xl border border-gray-800">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-900">
                <tr>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-12">Pos</th>
                  <th scope="col" className="px-3 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider w-16">Class</th>
                  <th scope="col" className="px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider w-16">#</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Team / Car</th>
                  <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Driver</th>
                  <th scope="col" className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Gap</th>
                  <th scope="col" className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Last Lap</th>
                  <th scope="col" className="px-4 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Best Lap</th>
                  <th scope="col" className="px-4 py-4 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">Pits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 bg-gray-950">
                {filteredCars.map((car, idx) => (
                  <tr 
                    key={car.id} 
                    className={`hover:bg-gray-800 transition-colors ${idx % 2 === 0 ? 'bg-gray-950' : 'bg-[#111827]'}`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-white">{car.pos}</span>
                      </div>
                    </td>
                    
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getClassBadge(car.class)}`}>
                          {car.class}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">P{car.classPos}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className="inline-flex items-center justify-center w-10 h-8 bg-white text-black font-black text-lg rounded shadow-sm border-2 border-gray-300">
                        {car.number}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white truncate max-w-[250px]">{car.team}</span>
                        <span className="text-xs text-gray-500 truncate max-w-[250px]">{car.car}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-300">{car.driver}</span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex flex-col">
                        <span className="text-sm font-mono font-bold text-white">{car.gap}</span>
                        <span className="text-xs font-mono text-gray-500">{car.interval}</span>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className={`text-sm font-mono font-bold ${car.status === 'Pit' ? 'text-red-500 animate-pulse' : 'text-yellow-400'}`}>
                        {car.status === 'Pit' ? 'IN PIT' : car.lastLap}
                      </span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <span className="text-sm font-mono font-medium text-gray-400">{car.bestLap}</span>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className="text-sm font-mono text-gray-500">{car.pits}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {cars.length === 0 && (
               <div className="p-12 text-center text-gray-500 font-mono">
                 No timing data received yet...
               </div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
}
