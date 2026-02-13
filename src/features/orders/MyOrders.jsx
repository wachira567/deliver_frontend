import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation2, XCircle, ArrowRight, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { getMyOrders, cancelOrder } from "../../api/orders";
import { initiatePayment, pollPaymentStatus, validatePhoneNumber, simulatePayment } from "../../api/payments";

const STATUS_STYLES = {
  PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500", label: "Pending" },
  PAID: { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500", label: "Paid" },
  ASSIGNED: { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500", label: "Assigned" },
  PICKED_UP: { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500", label: "Picked Up" },
  IN_TRANSIT: { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500", label: "In Transit" },
  DELIVERED: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500", label: "Delivered" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500", label: "Cancelled" },
};

const DEFAULT_STYLE = { bg: "bg-gray-100", text: "text-gray-800", dot: "bg-gray-500", label: "Unknown" };

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || DEFAULT_STYLE;
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${style.bg}`}>
      <span className={`w-2 h-2 rounded-full animate-pulse ${style.dot}`} />
      <span className={`text-[10px] font-black uppercase tracking-widest ${style.text}`}>{style.label}</span>
    </div>
  );
}

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [payingId, setPayingId] = useState(null);
  const [payPhone, setPayPhone] = useState("");
  const [payError, setPayError] = useState("");
  const [payStatus, setPayStatus] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getMyOrders();
      setOrders(Array.isArray(data) ? data : data.orders || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm("Are you sure you want to cancel this order?")) return;
    setCancellingId(orderId);
    try {
      await cancelOrder(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o)));
    } catch (err) {
      alert(err.message || "Failed to cancel order");
    } finally {
      setCancellingId(null);
    }
  };

  const handlePayNow = async (orderId) => {
    const { valid, phone, error } = validatePhoneNumber(payPhone);
    if (!valid) {
      setPayError(error);
      return;
    }

    setPayError("");
    setPayStatus("Initiating payment...");

    try {
      await initiatePayment(orderId, phone);
      setPayStatus("Check your phone for M-Pesa prompt...");

      const result = await pollPaymentStatus(orderId);
      setPayStatus(`Payment successful! Receipt: ${result.mpesa_receipt_number || "confirmed"}`);
      setPayingId(null);
      setPayPhone("");
      setPayStatus("");
      fetchOrders();
    } catch (err) {
      setPayError(err.message || "Payment failed");
      setPayStatus("");
    }
  };

  const isActiveOrder = (status) => ["ASSIGNED", "PICKED_UP", "IN_TRANSIT"].includes(status);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <Loader2 size={48} className="text-yellow-500 animate-spin mx-auto mb-4" />
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto px-8 py-20 min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-end mb-16">
        <h1 className="text-8xl font-black tracking-tighter italic">
          Fleet<span className="text-yellow-500">.</span>
        </h1>
        <button
          onClick={fetchOrders}
          className="px-6 py-3 border-2 border-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400 hover:border-black hover:text-black transition-all flex items-center gap-2"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </motion.div>

      <div className="grid gap-10">
        <AnimatePresence mode="popLayout">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, x: 100, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: "circOut" }}
              className="flex bg-gray-50 rounded-[50px] overflow-hidden border border-transparent hover:border-black hover:bg-white hover:shadow-[0_40px_80px_-15px_rgba(0,0,0,0.1)] transition-all duration-500 group"
            >
              {/* IMAGE SECTION */}
              <div className="w-1/3 bg-zinc-200 h-72 overflow-hidden relative">
                <img
                  src="https://images.pexels.com/photos/13033926/pexels-photo-13033926.jpeg"
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-110"
                  alt="Logistics"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              </div>

              {/* CONTENT SECTION */}
              <div className="p-10 flex-1 flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                      Ref: #DEL-{order.id}
                    </span>
                    <h2 className="text-3xl font-black tracking-tighter uppercase mt-2 italic flex items-center gap-3">
                      {order.pickup_address || order.pickup_location}
                      <ArrowRight size={20} className="text-yellow-500 group-hover:translate-x-2 transition-transform" />
                      {order.delivery_address || order.destination}
                    </h2>
                  </div>
                  <div className="text-right space-y-2">
                    <span className="text-2xl font-black text-black italic block">KES {order.total_price || order.price || "---"}</span>
                    <StatusBadge status={order.status} />
                  </div>
                </div>

                {/* Pay Now inline form */}
                {payingId === order.id && (
                  <div className="mt-4 bg-white p-6 rounded-[30px] border border-gray-100 space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">M-Pesa Phone Number</label>
                    <div className="flex gap-3">
                      <input
                        type="tel"
                        placeholder="254XXXXXXXXX"
                        value={payPhone}
                        onChange={(e) => { setPayPhone(e.target.value); setPayError(""); }}
                        className={`flex-1 bg-gray-50 px-5 py-3 rounded-full outline-none font-bold text-sm ${payError ? "ring-2 ring-red-400" : ""}`}
                      />
                      <button
                        onClick={() => handlePayNow(order.id)}
                        disabled={!!payStatus}
                        className="px-8 py-3 bg-[#2fbb1c] text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-black transition-all disabled:opacity-50"
                      >
                        {payStatus || "Pay"}
                      </button>
                      <button
                        onClick={() => { setPayingId(null); setPayPhone(""); setPayError(""); setPayStatus(""); }}
                        className="px-4 py-3 text-gray-400 hover:text-red-500 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                    {payError && <p className="text-red-500 text-xs font-bold ml-4">{payError}</p>}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-4">
                  {/* Track button - for active orders */}
                  {isActiveOrder(order.status) && (
                    <Link
                      to={`/orders/${order.id}`}
                      className="px-10 py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-yellow-500 hover:text-black transition-all active:scale-95 shadow-lg flex items-center gap-2"
                    >
                      <Navigation2 size={14} fill="currentColor" /> Track Journey
                    </Link>
                  )}

                  {/* Pay Now button - for pending/unpaid orders */}
                  {order.status === "PENDING" && payingId !== order.id && (
                    <div className="flex gap-2">
                       <button
                        onClick={() => { setPayingId(order.id); setPayError(""); setPayStatus(""); }}
                        className="px-8 py-5 bg-[#2fbb1c] text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-black transition-all active:scale-95 shadow-lg flex items-center gap-2"
                      >
                        <CreditCard size={14} /> Pay Now
                      </button>
                      
                      {/* DEV ONLY: Simulate Payment Button */}
                      <button
                        onClick={async (e) => {
                           e.stopPropagation();
                           if(!window.confirm("Simulate successful payment for this order? (Dev Only)")) return;
                           try {
                             await simulatePayment(order.id);
                             alert("Order simulated as PAID!");
                             fetchOrders();
                           } catch(err) {
                             alert("Simulation failed: " + err.message);
                           }
                        }}
                        className="px-4 py-5 bg-gray-800 text-white text-[9px] font-black uppercase tracking-wider rounded-full hover:bg-gray-600 transition-all active:scale-95 shadow-lg flex items-center gap-1"
                        title="Bypass M-Pesa (Dev Only)"
                      >
                         ⚡ Dev Pay
                      </button>
                    </div>
                  )}

                  {/* View details - for completed/paid */}
                  {(order.status === "PAID" || order.status === "DELIVERED") && (
                    <Link
                      to={`/orders/${order.id}`}
                      className="px-10 py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-yellow-500 hover:text-black transition-all active:scale-95 shadow-lg flex items-center gap-2"
                    >
                      <Navigation2 size={14} fill="currentColor" /> View Details
                    </Link>
                  )}

                  {/* Cancel button - for pending orders */}
                  {order.status === "PENDING" && (
                    <button
                      onClick={() => handleCancel(order.id)}
                      disabled={cancellingId === order.id}
                      className="px-8 py-5 border-2 border-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-full hover:bg-red-500 hover:text-white hover:border-red-500 transition-all active:scale-90 flex items-center gap-2 disabled:opacity-50"
                    >
                      {cancellingId === order.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <XCircle size={14} />
                      )}
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {orders.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-gray-300 font-black uppercase tracking-widest">Your fleet is empty</p>
            <Link to="/orders/new" className="text-yellow-600 font-black uppercase text-xs mt-4 block underline">
              Start a new shipment
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
