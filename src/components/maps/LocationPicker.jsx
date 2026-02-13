import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { Search, MapPin, X, Loader2, Maximize2 } from "lucide-react";

// ... (previous helper components)

function DraggableMarker({ position, onMove }) {
  return position ? (
    <Marker
      position={position}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onMove({ lat, lng });
        },
      }}
    />
  ) : null;
}

function ClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

function FlyTo({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { duration: 1 });
  }, [position, map]);
  return null;
}

export default function LocationPicker({ label, placeholder, value, onChange }) {
  const [query, setQuery] = useState(value?.address || "");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState(
    value?.lat ? [value.lat, value.lng] : null
  );
  const debounceRef = useRef(null);

  // Sync external value changes
  useEffect(() => {
    if (value?.address && value.address !== query) setQuery(value.address);
    if (value?.lat) setPosition([value.lat, value.lng]);
  }, [value?.address, value?.lat, value?.lng]);

  const searchAddress = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 3) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=ke&limit=5`,
          { headers: { "User-Agent": "DeliverooApp/1.0" } }
        );
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const address = item.display_name;

    setQuery(address);
    setPosition([lat, lng]);
    setResults([]);
    setShowMap(true);
    onChange({ lat, lng, address });
  };

  const handleMapClick = async (coords) => {
    setPosition([coords.lat, coords.lng]);

    // Reverse geocode
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}`,
        { headers: { "User-Agent": "DeliverooApp/1.0" } }
      );
      const data = await res.json();
      const address = data.display_name || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      setQuery(address);
      onChange({ lat: coords.lat, lng: coords.lng, address });
    } catch {
      const address = `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
      setQuery(address);
      onChange({ lat: coords.lat, lng: coords.lng, address });
    }
  };

  const handleMarkerDrag = (coords) => handleMapClick(coords);

  const clearSelection = () => {
    setQuery("");
    setPosition(null);
    setResults([]);
    onChange({ lat: null, lng: null, address: "" });
  };

  return (
    <div className="relative group">
      <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-yellow-500 rounded-full opacity-0 group-focus-within:opacity-100 transition-all" />
      <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-2 block">
        {label}
      </label>

      {/* Search input */}
      <div className="relative">
        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          type="text"
          placeholder={placeholder}
          value={query}
          className="w-full bg-white p-6 pl-12 pr-20 rounded-[25px] outline-none font-bold text-sm shadow-sm focus:shadow-xl transition-all placeholder:text-gray-200"
          onChange={(e) => searchAddress(e.target.value)}
          onFocus={() => { if (position) setShowMap(true); }}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && <Loader2 size={16} className="text-gray-300 animate-spin" />}
          {query && (
            <button onClick={clearSelection} className="p-2 text-gray-300 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          )}
          <button
            onClick={() => setShowMap(!showMap)}
            className={`p-2 rounded-full transition-colors ${showMap ? "text-yellow-600 bg-yellow-50" : "text-gray-300 hover:text-gray-500"}`}
            title="Toggle map"
          >
            <MapPin size={16} />
          </button>
        </div>
      </div>

      {/* Search results dropdown */}
      {results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-[20px] shadow-2xl border border-gray-100 overflow-hidden">
          {results.map((item, i) => (
            <button
              key={i}
              onClick={() => selectResult(item)}
              className="w-full text-left px-5 py-4 hover:bg-yellow-50 transition-colors border-b border-gray-50 last:border-0 flex items-start gap-3"
            >
              <MapPin size={14} className="text-yellow-500 mt-1 shrink-0" />
              <span className="text-sm font-medium text-gray-700 line-clamp-2">{item.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      {showMap && (
        <>
           {/* Normal Map */}
          <div className="mt-3 rounded-[20px] overflow-hidden border border-gray-100 shadow-sm relative group/map" style={{ height: 220 }}>
            <MapContainer
              center={position || [-1.2864, 36.8172]}
              zoom={position ? 15 : 12}
              className="h-full w-full"
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <ClickHandler onClick={handleMapClick} />
              <DraggableMarker position={position} onMove={handleMarkerDrag} />
              <FlyTo position={position} />
            </MapContainer>
            
            {/* Expand Button */}
            <button 
                type="button"
                onClick={() => setExpanded(true)}
                className="absolute top-2 right-2 bg-white p-2 rounded-lg shadow-md z-[400] text-gray-500 hover:text-black hover:bg-yellow-50 transition-all opacity-0 group-hover/map:opacity-100"
                title="Expand Map"
            >
                <Maximize2 size={18} />
            </button>
          </div>

          {/* Expanded Map Modal */}
          {expanded && (
             <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                 <div className="bg-white w-full h-full max-w-6xl max-h-[90vh] rounded-[30px] overflow-hidden relative shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="px-8 py-4 border-b flex justify-between items-center bg-white z-[1000]">
                        <h3 className="font-bold text-lg">Select Location</h3>
                        <button 
                            onClick={() => setExpanded(false)}
                            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition"
                        >
                            <X size={24} />
                        </button>
                    </div>
                    
                    {/* Full Map */}
                    <div className="flex-1 relative">
                        <MapContainer
                        center={position || [-1.2864, 36.8172]}
                        zoom={position ? 16 : 13}
                        className="h-full w-full"
                        >
                        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                        <ClickHandler onClick={handleMapClick} />
                        <DraggableMarker position={position} onMove={handleMarkerDrag} />
                        <FlyTo position={position} />
                        </MapContainer>
                        
                         {/* Floating Address Bar */}
                         <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full shadow-xl z-[1000] font-medium text-sm flex items-center gap-2">
                            <MapPin size={16} className="text-yellow-500" />
                            {query || "Click map to select location"}
                            <button 
                                onClick={() => setExpanded(false)}
                                className="ml-4 bg-black text-white px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-yellow-500 hover:text-black transition"
                            >
                                Confirm
                            </button>
                         </div>
                    </div>
                 </div>
             </div>
          )}
        </>
      )}

      {/* Coordinates display */}
      {position && (
        <p className="text-[10px] text-gray-300 font-bold mt-2 ml-4">
          {position[0].toFixed(4)}, {position[1].toFixed(4)}
        </p>
      )}
    </div>
  );
}
