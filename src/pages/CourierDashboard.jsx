import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import {
  Package,
  MapPin,
  Navigation,
  CheckCircle,
  Truck,
  Clock,
  Shield,
  Phone,
  Star,
  Zap,
  Award,
  Signal,
  MessageCircle,
  TrendingUp,
  Wallet,
  ChevronRight,
  Bell,
  User,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getToken } from "../utils/token";

// Fix for Leaflet icons - Ensures markers show up in Vite
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Order status mapping from backend to frontend
const statusMapping = {
  assigned: "Assigned",
  picked_up: "Picked Up",
  in_transit: "In Transit",
  delivered: "Delivered",
};

// Reverse mapping for API calls
const reverseStatusMapping = {
  Assigned: "picked_up",
  "Picked Up": "in_transit",
  "In Transit": "delivered",
};

export default function CourierDashboard() {
  const navigate = useNavigate();
  const [riderData, setRiderData] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [riderLocation, setRiderLocation] = useState(null);

  // Track Rider Location
  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setRiderLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => console.error("Error getting location:", error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // Sync Location to Backend
  useEffect(() => {
     if (!riderLocation) return;
     
     const activeOrder = deliveries.find(d => 
        d.status === "Picked Up" || d.status === "In Transit"
     );

     if (!activeOrder) return;

     const syncLocation = async () => {
        try {
           const token = getToken();
           // Map frontend ID back to backend ID if needed
           const orderId = activeOrder.orderId || activeOrder.id;
           
           await fetch(`/api/courier/orders/${orderId}/location`, {
              method: 'PATCH',
              headers: {
                 'Content-Type': 'application/json',
                 'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                 latitude: riderLocation.lat,
                 longitude: riderLocation.lng,
                 location_description: "En route"
              })
           });
        } catch (err) {
           console.error("Failed to sync location:", err);
        }
     };

     const intervalId = setInterval(syncLocation, 30000); // Sync every 30s
     syncLocation(); // Initial sync

     return () => clearInterval(intervalId);
  }, [riderLocation, deliveries]);

  // Fetch rider profile data
  const fetchRiderData = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRiderData({
          name: data.full_name || "Rider",
          id: `RID-${data.id?.toString().padStart(4, "0") || "0000"}`,
          rating: data.rating || 4.8,
          tripsMonth: data.total_deliveries || 0,
          todayEarnings: data.today_earnings || "0",
          phone: data.phone || "+254 XXX XXX XXX",
          email: data.email,
        });
      }
    } catch (err) {
      console.error("Error fetching rider data:", err);
      // Set default data if fetch fails
      setRiderData({
        name: "Rider",
        id: "RID-0000",
        rating: 4.8,
        tripsMonth: 0,
        todayEarnings: "0",
        phone: "+254 XXX XXX XXX",
      });
    }
  }, []);

  // Fetch assigned orders
  const fetchOrders = useCallback(async () => {
    try {
      const token = getToken();
      const response = await fetch(
        "/api/courier/orders?status=assigned&limit=50",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        const orders = data.orders || [];

        // Transform backend data to frontend format
        const transformedOrders = orders.map((order) => ({
          id: order.tracking_number || order.order_number || order.id,
          customer:
            order.customer?.full_name || order.customer_name || "Customer",
          pickup:
            order.coordinates?.pickup?.lat && order.coordinates?.pickup?.lng
              ? [order.coordinates.pickup.lat, order.coordinates.pickup.lng]
              : order.pickup_lat && order.pickup_lng
                ? [parseFloat(order.pickup_lat), parseFloat(order.pickup_lng)]
                : [-1.286389, 36.817223], // Default to Nairobi CBD
          destination:
            order.coordinates?.destination?.lat &&
            order.coordinates?.destination?.lng
              ? [
                  order.coordinates.destination.lat,
                  order.coordinates.destination.lng,
                ]
              : order.destination_lat && order.destination_lng
                ? [
                    parseFloat(order.destination_lat),
                    parseFloat(order.destination_lng),
                  ]
                : [-1.2647, 36.8021],
          pickupAddr: order.pickup_address || "Pickup Location",
          destAddr: order.destination_address || "Delivery Location",
          status: statusMapping[order.status] || order.status || "Assigned",
          weight: order.weight_category || "Medium",
          customerPhone:
            order.contact_info?.destination_phone ||
            order.customer_phone ||
            "+254 XXX XXX XXX",
          orderId: order.id,
          amount: order.total_price || order.total_amount || "0",
        }));

        setDeliveries(transformedOrders);

        // Set first order as selected if none selected
        if (!selectedOrder && transformedOrders.length > 0) {
          setSelectedOrder(transformedOrders[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    }
  }, [selectedOrder]);

  // Fetch data on mount
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRiderData(), fetchOrders()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRiderData, fetchOrders]);

  // Update status locally and sync with backend
  const handleUpdateStatus = async (id, currentStatus) => {
    const statusMap = {
      Assigned: "Picked Up",
      "Picked Up": "In Transit",
      "In Transit": "Delivered",
    };
    const nextStatus = statusMap[currentStatus];

    if (!nextStatus) return;

    // Find the order
    const order = deliveries.find((d) => d.id === id || d.orderId === id);
    if (!order) return;

    // Optimistic update - update UI immediately
    setDeliveries((prev) =>
      prev.map((d) =>
        d.id === id || d.orderId === id ? { ...d, status: nextStatus } : d,
      ),
    );
    if (
      selectedOrder &&
      (selectedOrder.id === id || selectedOrder.orderId === id)
    ) {
      setSelectedOrder((prev) => ({ ...prev, status: nextStatus }));
    }

    // Sync with backend
    try {
      const token = getToken();
      const backendStatus = reverseStatusMapping[nextStatus];
      if (backendStatus) {
        await fetch(`/api/courier/orders/${order.orderId || id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status: backendStatus,
            notes: `Status updated to ${nextStatus}`,
          }),
        });
      }
    } catch (err) {
      console.error("Error updating order status:", err);
      // Revert on error (could add re-fetch here)
    }
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      `Support, this is Rider ${riderData?.id || "RIDER"}. I need assistance`,
    );
    window.open(`https://wa.me/254700123456?text=${msg}`, "_blank");
  };

  // Loading state
  if (loading) {
    return (
      <div className="h-[calc(100vh-76px)] flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">
            Loading your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // No orders state
  if (!loading && deliveries.length === 0) {
    return (
      <div className="h-[calc(100vh-76px)] bg-[#F8FAFC] flex flex-col lg:flex-row text-slate-900 font-sans">
        {/* Left Sidebar - Profile */}
        <div className="w-full lg:w-[480px] bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden">
          <div className="p-10 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-5">
                <div
                  onClick={() => navigate("/rider/profile")}
                  className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center text-yellow-400 font-black text-3xl shadow-xl cursor-pointer hover:scale-105 transition-transform"
                >
                  {riderData?.name?.[0] || "R"}
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tighter italic">
                    {riderData?.name || "Rider"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-yellow-400 text-[8px] font-black uppercase rounded-md tracking-widest">
                      Elite
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {riderData?.id || "RID-0000"}
                    </p>
                  </div>
                </div>
              </div>
              <button className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-yellow-500 transition-colors">
                <Bell size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-[30px] text-white">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">
                  Today's Revenue
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-yellow-400">
                    KES
                  </span>
                  <span className="text-2xl font-black italic tracking-tighter">
                    {riderData?.todayEarnings || "0"}
                  </span>
                </div>
              </div>
              <div className="bg-yellow-400 p-6 rounded-[30px] text-black">
                <p className="text-[9px] font-black uppercase tracking-widest text-black/50 mb-1">
                  Trip Rating
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black italic tracking-tighter">
                    {riderData?.rating || "0.0"}
                  </span>
                  <div className="flex gap-0.5 text-black">
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-10">
            <div className="text-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Package size={40} className="text-slate-400" />
              </div>
              <h3 className="text-xl font-black mb-2">No Active Deliveries</h3>
              <p className="text-slate-500 mb-6">
                You have no assigned orders at the moment.
              </p>
              <button
                onClick={fetchOrders}
                className="px-6 py-3 bg-slate-900 text-white rounded-full font-medium hover:bg-slate-800 transition-colors"
              >
                Refresh Orders
              </button>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100">
            <button
              onClick={openWhatsApp}
              className="w-full flex items-center justify-between p-4 bg-[#25D366]/10 text-[#25D366] rounded-3xl hover:bg-[#25D366]/20 transition-all group"
            >
              <div className="flex items-center gap-3">
                <MessageCircle size={20} fill="currentColor" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  Secure Rider Support
                </span>
              </div>
              <ChevronRight
                size={16}
                className="group-hover:translate-x-1 transition-transform"
              />
            </button>
          </div>
        </div>

        {/* Right Side - Map */}
        <div className="flex-1 bg-slate-200 relative">
          <MapContainer
            center={riderLocation ? [riderLocation.lat, riderLocation.lng] : [-1.286389, 36.817223]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <Marker 
              position={riderLocation ? [riderLocation.lat, riderLocation.lng] : [-1.286389, 36.817223]} 
              icon={DefaultIcon}
            >
              <Popup>Your Location</Popup>
            </Marker>
          </MapContainer>
          
          {/* Overlay message */}
          <div className="absolute bottom-10 left-10 z-[1000] bg-white/90 backdrop-blur-md p-6 rounded-[35px] shadow-2xl border border-white">
            <div className="flex items-center gap-4">
              <MapPin size={24} className="text-yellow-500" />
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Current Location</p>
                <p className="text-sm font-black italic tracking-tight">Nairobi CBD</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-76px)] bg-[#F8FAFC] flex flex-col lg:flex-row text-slate-900 font-sans selection:bg-yellow-100 overflow-hidden">
      {/* LEFT SIDEBAR: THE COMMAND CENTER */}
      <div className="w-full lg:w-[480px] bg-white border-r border-slate-200 flex flex-col h-full overflow-hidden shadow-2xl z-20">
        {/* TOP PROFILE HEADER */}
        <div className="p-10 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50">
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-5">
              <div
                onClick={() => navigate("/rider/profile")}
                className="w-20 h-20 bg-slate-900 rounded-[30px] flex items-center justify-center text-yellow-400 font-black text-3xl shadow-xl cursor-pointer hover:scale-105 transition-transform"
              >
                {riderData?.name?.[0] || "R"}
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tighter italic">
                  {riderData?.name || "Rider"}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-yellow-400 text-[8px] font-black uppercase rounded-md tracking-widest">
                    Elite
                  </span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {riderData?.id || "RID-0000"}
                  </p>
                </div>
              </div>
            </div>
            <button className="p-3 bg-slate-50 rounded-2xl text-slate-400 hover:text-yellow-500 transition-colors">
              <Bell size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 p-6 rounded-[30px] text-white">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">
                Today's Revenue
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-bold text-yellow-400">
                  KES
                </span>
                <span className="text-2xl font-black italic tracking-tighter">
                  {riderData?.todayEarnings || "0"}
                </span>
              </div>
            </div>
            <div className="bg-yellow-400 p-6 rounded-[30px] text-black">
              <p className="text-[9px] font-black uppercase tracking-widest text-black/50 mb-1">
                Trip Rating
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black italic tracking-tighter">
                  {riderData?.rating || "0.0"}
                </span>
                <div className="flex gap-0.5 text-black">
                  <Star size={12} fill="currentColor" />
                  <Star size={12} fill="currentColor" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ACTIVE MISSIONS LIST */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300 italic">
              Live Operations
            </h3>
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />{" "}
              Tracking Active
            </div>
          </div>

          <AnimatePresence>
            {deliveries.map((order) => (
              <motion.div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`p-8 rounded-[40px] border-2 cursor-pointer transition-all ${
                  selectedOrder?.id === order.id
                    ? "border-slate-900 bg-white shadow-2xl scale-[1.02]"
                    : "border-slate-50 bg-slate-50/50 grayscale opacity-60"
                }`}
              >
                <div className="flex justify-between items-center mb-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Ticket #{order.id}
                  </p>
                  <TrendingUp size={16} className="text-emerald-500" />
                </div>

                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <Package size={20} className="text-slate-900" />
                  </div>
                  <div>
                    <h4 className="font-black text-lg">{order.customer}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">
                      {order.weight}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-400" />
                    <p className="text-xs font-bold text-slate-600 tracking-tight">
                      {order.pickupAddr}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full border-2 border-slate-900" />
                    <p className="text-xs font-bold text-slate-900 tracking-tight">
                      {order.destAddr}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-6 border-t border-slate-100">
          <button
            onClick={openWhatsApp}
            className="w-full flex items-center justify-between p-4 bg-[#25D366]/10 text-[#25D366] rounded-3xl hover:bg-[#25D366]/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <MessageCircle size={20} fill="currentColor" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                Secure Rider Support
              </span>
            </div>
            <ChevronRight
              size={16}
              className="group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>
      </div>

      {/* RIGHT SECTION: THE MAP */}
      <div className="flex-1 flex flex-col relative">
        {/* FLOATING NAVIGATION OVERLAY */}
        <div className="absolute top-10 left-10 z-[1000] flex gap-4 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-md p-6 rounded-[35px] shadow-2xl border border-white pointer-events-auto flex items-center gap-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-yellow-400">
              <Navigation size={22} fill="currentColor" />
            </div>
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Next Objective
              </p>
              <p className="text-sm font-black italic tracking-tight">
                Proceed to {selectedOrder?.destAddr || "Destination"}
              </p>
            </div>
          </div>
        </div>

        {/* MAP CONTAINER */}
        <div className="flex-1 z-0 bg-slate-200">
          {selectedOrder && (
            <MapContainer
              center={selectedOrder.pickup}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
            >
              <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
              <Polyline
                positions={[selectedOrder.pickup, selectedOrder.destination]}
                color="#1e293b"
                weight={3}
                opacity={0.2}
                dashArray="10, 10"
              />
              <Marker position={selectedOrder.pickup} icon={DefaultIcon}>
                <Popup>Pickup Location</Popup>
              </Marker>
              <Marker position={selectedOrder.destination} icon={DefaultIcon}>
                <Popup>Drop-off Location</Popup>
              </Marker>
            </MapContainer>
          )}
        </div>

        {/* BOTTOM ACTION CONTROL */}
        <div className="p-10 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] z-20">
          <div className="flex items-center gap-10">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">
                Recipient
              </span>
              <div className="flex items-center gap-2">
                <User size={16} className="text-yellow-500" />
                <span className="text-xl font-black italic">
                  {selectedOrder?.customer || "N/A"}
                </span>
              </div>
            </div>
            <div className="w-[1px] h-10 bg-slate-100" />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">
                Direct Line
              </span>
              <button className="flex items-center gap-2 font-black text-slate-900 hover:text-yellow-600 transition-colors">
                <Phone size={14} /> {selectedOrder?.customerPhone || "N/A"}
              </button>
            </div>
          </div>

          <div className="flex gap-4 w-full md:w-auto">
            {selectedOrder && selectedOrder.status !== "Delivered" ? (
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "#000" }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  handleUpdateStatus(selectedOrder.id, selectedOrder.status)
                }
                className="flex-1 md:w-80 py-7 bg-slate-900 text-white rounded-[30px] text-xs font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 shadow-2xl transition-all"
              >
                Confirm{" "}
                {selectedOrder.status === "Assigned"
                  ? "Pickup"
                  : selectedOrder.status === "Picked Up"
                    ? "Dispatch"
                    : "Arrival"}
                <Zap
                  size={18}
                  className="text-yellow-400"
                  fill="currentColor"
                />
              </motion.button>
            ) : selectedOrder ? (
              <div className="flex-1 md:w-80 py-7 bg-emerald-500 text-white rounded-[30px] text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl">
                <CheckCircle size={20} /> Delivery Successful
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
