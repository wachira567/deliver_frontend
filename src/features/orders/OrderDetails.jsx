import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from "react-leaflet";
import { motion } from "framer-motion";
import {
  Phone,
  ArrowLeft,
  Navigation,
  MessageSquare,
  Share2,
} from "lucide-react";
import L from "leaflet";
import { getOrderById } from "../../api/orders";

export default function OrderDetails() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await getOrderById(id);
        setOrder(data.order || data);
      } catch (err) {
        console.error("Error loading order:", err);

        // Fallback demo data
        setOrder({
          id: id || "8842",
          tracking_number: `DLV${id || "8842"}`,
          pickup_address: "Westlands, Nairobi",
          destination_address: "Kilimani, Nairobi",
          status: "PENDING",
          pickup_lat: -1.2675,
          pickup_lng: 36.8083,
          destination_lat: -1.2921,
          destination_lng: 36.785,
          rider: {
            name: "Alex Mwangi",
            bike: "Honda 150cc",
            phone: "254712345678",
            pos: [-1.28, 36.82],
          },
          route: [
            [-1.2675, 36.8083],
            [-1.28, 36.82],
            [-1.2921, 36.785],
          ],
          weight_kg: 2,
          distance_km: 6,
          total_price: 450,
          created_at: new Date().toISOString(),
        });
      }
    };

    loadData();

    // Poll for live location updates every 15 seconds if order is active
    const interval = setInterval(() => {
        if(id) loadData();
    }, 15000);

    return () => clearInterval(interval);
  }, [id]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("Tracking link copied to clipboard!");
  };

  if (!order) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <div className="w-16 h-16 border-8 border-yellow-500 border-t-transparent rounded-full animate-spin mb-6"></div>
        <p className="font-black uppercase tracking-[0.5em] text-sm text-gray-400">
          Loading...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col lg:flex-row h-[calc(100vh-70px)] bg-white overflow-hidden"
    >
      {/* LEFT SIDE - MAP */}
      <div className="flex-1 relative border-r border-gray-100">
        <MapContainer
          center={order?.rider?.pos || [-1.2921, 36.8219]}
          zoom={14}
          className="h-full w-full grayscale-[0.8] contrast-[1.2]"
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

          {order?.route && (
            <Polyline
              positions={order.route}
              pathOptions={{ color: "black", weight: 4, dashArray: "10, 10" }}
            />
          )}

          {order?.rider?.pos && (
            <Marker position={order.rider.pos}>
              <Popup>
                Courier:
                <br />
                {order?.rider?.name}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {/* COMMUNICATION HUB */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-10 left-10 z-[1000] bg-white/90 backdrop-blur-2xl p-6 rounded-[40px] shadow-[0_40px_80px_-15px_rgba(0,0,0,0.15)] border border-white flex items-center gap-6 min-w-[450px]"
        >
          {/* Avatar */}
          <div className="w-16 h-16 bg-yellow-500 rounded-full border-4 border-white overflow-hidden shadow-xl relative">
            <img
              src="https://images.unsplash.com/photo-1653463207246-1dc03899dfe0?w=500&auto=format&fit=crop&q=60"
              alt="rider"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
          </div>

          {/* Rider Info */}
          <div className="flex-1">
            <h4 className="font-black text-xl tracking-tighter uppercase">
              {order?.rider?.name || "Courier"}
            </h4>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest">
              <Navigation size={14} className="text-yellow-600" />
              {order?.rider?.bike || "Motorbike"}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <a
              href={`https://wa.me/${order?.rider?.phone || ""}`}
              target="_blank"
              rel="noreferrer"
              className="w-12 h-12 bg-[#25D366] text-white rounded-full flex items-center justify-center hover:scale-110 transition-all shadow-lg"
            >
              <MessageSquare size={20} />
            </a>

            <a
              href={`tel:${order?.rider?.phone || ""}`}
              className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:bg-yellow-500 transition-all shadow-lg hover:scale-110"
            >
              <Phone size={20} />
            </a>
          </div>
        </motion.div>
      </div>

      {/* RIGHT SIDE - DETAILS PANEL */}
      <aside className="w-full lg:w-[500px] p-12 flex flex-col justify-between border-l border-gray-100 bg-white overflow-y-auto">
        <div>
          {/* Top Nav */}
          <div className="flex justify-between items-center mb-10">
            <Link
              to="/orders"
              className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-yellow-500 transition-all shadow-lg shadow-black/10"
            >
              <ArrowLeft size={16} /> Back to Fleet
            </Link>

            <button
              onClick={handleShare}
              className="text-gray-400 hover:text-black transition-colors p-2"
            >
              <Share2 size={22} />
            </button>
          </div>

          {/* Addresses */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">
                Pickup
              </p>
              <p className="font-medium">{order?.pickup_address || "N/A"}</p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">
                Destination
              </p>
              <p className="font-medium">
                {order?.destination_address || "N/A"}
              </p>
            </div>
          </div>

          {/* Order Details */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Order Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Weight</p>
                <p className="font-medium">{order?.weight_kg || "N/A"} kg</p>
              </div>

              <div>
                <p className="text-gray-500">Distance</p>
                <p className="font-medium">{order?.distance_km || "N/A"} km</p>
              </div>

              <div>
                <p className="text-gray-500">Price</p>
                <p className="font-medium">KES {order?.total_price || "N/A"}</p>
              </div>

              <div>
                <p className="text-gray-500">Created</p>
                <p className="font-medium">
                  {order?.created_at
                    ? new Date(order.created_at).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Section */}
        {order?.status === "DELIVERED" && (
          <div className="bg-white rounded-xl shadow-lg p-8 mt-10">
            <h3 className="text-lg font-semibold mb-4">Rate Your Delivery</h3>

            <div className="flex gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="text-2xl transition-colors"
                >
                  {(hoverRating || rating) >= star ? "⭐" : "☆"}
                </button>
              ))}
            </div>

            <textarea
              placeholder="Leave a comment..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full border rounded-lg p-3 mb-4 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
              rows={3}
            />

            <button className="bg-yellow-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-yellow-600 transition">
              Submit Review
            </button>
          </div>
        )}
      </aside>
    </motion.div>
  );
}
