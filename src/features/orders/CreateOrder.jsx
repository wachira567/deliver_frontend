import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { createOrder } from "../../api/orders";
import {
  initiatePayment,
  pollPaymentStatus,
  validatePhoneNumber,
} from "../../api/payments";
import {
  X,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import LocationPicker from "../../components/maps/LocationPicker";

const STEP_LABELS = {
  idle: null,
  creating: "Creating order...",
  initiating: "Initiating payment...",
  polling: "Waiting for M-Pesa confirmation...",
  success: null,
  error: null,
};

const WEIGHT_OPTIONS = {
  LIGHT: { label: "Light", kg: 3, price: 0 },
  MEDIUM: { label: "Medium", kg: 12, price: 0 },
  HEAVY: { label: "Heavy", kg: 35, price: 0 },
};

export default function CreateOrder() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [weight, setWeight] = useState("LIGHT");
  const [pickup, setPickup] = useState({ lat: null, lng: null, address: "" });
  const [dropoff, setDropoff] = useState({ lat: null, lng: null, address: "" });
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const vehicles = {
    LIGHT: "https://images.pexels.com/photos/4391469/pexels-photo-4391469.jpeg",
    MEDIUM:
      "https://images.pexels.com/photos/13033926/pexels-photo-13033926.jpeg",
    HEAVY:
      "https://images.pexels.com/photos/29057942/pexels-photo-29057942.jpeg",
  };

  useEffect(() => {
    if (user?.phone) {
      const cleaned = user.phone.replace(/[^0-9]/g, "");
      setPhoneNumber(cleaned);
    }
  }, [user]);

  const handlePhoneChange = (value) => {
    setPhoneNumber(value);
    setPhoneError("");

    if (value.length > 0) {
      const { valid, error } = validatePhoneNumber(value);
      if (!valid) setPhoneError(error);
    }
  };

  const [currentOrderId, setCurrentOrderId] = useState(null);

  const checkStatus = async () => {
    if (!currentOrderId) return;
    try {
      setStep("polling");
      setErrorMessage("");
      const paymentResult = await pollPaymentStatus(currentOrderId);
      
      setStep("success");
      setStatusMessage(
        `Payment successful! Receipt: ${
          paymentResult.mpesa_receipt_number || "confirmed"
        }`
      );
      setTimeout(() => navigate("/orders"), 2500);
    } catch (err) {
      setStep("error");
      setErrorMessage(err.message || "Payment check failed.");
    }
  };

  const handleSubmit = async () => {
    if (!pickup.lat || !pickup.address) {
        setErrorMessage("Please select a pickup location.");
        return;
    }

    if (!dropoff.lat || !dropoff.address) {
        setErrorMessage("Please select a drop-off location.");
        return;
    }

    const { valid, phone, error } = validatePhoneNumber(phoneNumber);
    if (!valid) {
        setPhoneError(error);
        return;
    }

    try {
        setStep("creating");
        setErrorMessage("");

        const selectedWeight = WEIGHT_OPTIONS[weight];
        
        let orderId = currentOrderId;

        if (!orderId) {
            const result = await createOrder({
                pickup_address: pickup.address,
                pickup_lat: pickup.lat,
                pickup_lng: pickup.lng,
                destination_address: dropoff.address,
                destination_lat: dropoff.lat,
                destination_lng: dropoff.lng,
                weight_kg: selectedWeight.kg,
                parcel_description: description || `${selectedWeight.label} shipment`,
            });
            orderId = result.order?.id || result.id;
            setCurrentOrderId(orderId);
        }

        setStep("initiating");
        await initiatePayment(orderId, phone);

        setStep("polling");
        const paymentResult = await pollPaymentStatus(orderId);

        setStep("success");
        toast.success(`Payment successful! Receipt: ${paymentResult.mpesa_receipt_number || "confirmed"}`);
        setTimeout(() => navigate("/orders"), 2500);
    } catch (err) {
        setStep("error");
        // toast.error(err.message || "Something went wrong."); // Optional: Don't toast if we show error UI
        setErrorMessage(err.message || "Something went wrong.");
    }
  };
  
  // Dev Pay Function
  const handleDevPay = async () => {
      if(!currentOrderId) return;
      if(!window.confirm("Simulate successful payment? (Dev Only)")) return;
      
      try {
          const { simulatePayment } = await import("../../api/payments");
          await simulatePayment(currentOrderId);
          toast.success("Order simulated as PAID!");
          navigate("/orders");
      } catch(e) {
          toast.error("Simulation failed");
      }
  };


  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  const [distance, setDistance] = useState(0);
  const [deliveryFee, setDeliveryFee] = useState(0);

  useEffect(() => {
    if (pickup.lat && pickup.lng && dropoff.lat && dropoff.lng) {
      const dist = calculateDistance(
        pickup.lat,
        pickup.lng,
        dropoff.lat,
        dropoff.lng
      );
      setDistance(dist.toFixed(2));
      setDeliveryFee(Math.ceil(dist * 1)); // 1 KES per km
    } else {
      setDistance(0);
      setDeliveryFee(0);
    }
  }, [pickup, dropoff]);

  const isProcessing = !["idle", "success", "error"].includes(step);
  const basePrice = WEIGHT_OPTIONS[weight].price;
  const displayPrice = basePrice + deliveryFee;

  return (
    <div className="min-h-screen bg-white text-black pb-32">
      <div className="max-w-[1400px] mx-auto px-8 pt-16">
        <header className="mb-20">
          <h1 className="text-6xl font-black tracking-tight mb-4">
            Are you ready to ship?
          </h1>
          <p className="text-gray-400 text-sm">
            Billing to: {user?.phone || user?.email}
          </p>
        </header>

        <div className="grid lg:grid-cols-12 gap-20">
          {/* LEFT SIDE */}
          <div className="lg:col-span-8 space-y-12">
            <h3 className="text-sm font-bold uppercase text-gray-400">
              Fleet Selection
            </h3>

            <div className="grid gap-10">
              {Object.keys(WEIGHT_OPTIONS).map((cat) => (
                <div
                  key={cat}
                  onClick={() => setWeight(cat)}
                  className={`relative h-[350px] rounded-3xl overflow-hidden cursor-pointer transition-all duration-500 ${
                    weight === cat
                      ? "ring-4 ring-yellow-500"
                      : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={vehicles[cat]}
                    alt={cat}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute bottom-6 left-6 text-white">
                    <h2 className="text-3xl font-black">{cat} PRIORITY</h2>
                    <p className="text-sm">Up to {WEIGHT_OPTIONS[cat].kg}kg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT SIDE */}
          <div className="lg:col-span-4">
            <div className="bg-gray-50 p-8 rounded-3xl shadow-lg">
              <h3 className="text-xl font-bold mb-6">Shipment Summary</h3>

              <LocationPicker
                label="Pickup"
                value={pickup}
                onChange={setPickup}
              />

              <LocationPicker
                label="Dropoff"
                value={dropoff}
                onChange={setDropoff}
              />

              <input
                type="text"
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-4 p-3 rounded-lg border"
              />

              <div className="mt-4">
                 <label className="text-xs font-bold text-gray-500 mb-1 block">
                    M-Pesa Number for STK Push
                 </label>
                  <input
                    type="tel"
                    placeholder="2547XXXXXXXX"
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    className="w-full p-3 rounded-lg border"
                  />
              </div>


              {phoneError && (
                <p className="text-red-500 text-sm mt-2">{phoneError}</p>
              )}

              <div className="mt-6 space-y-2 border-t pt-4">
                 <div className="flex justify-between text-sm text-gray-500">
                    <span>Distance</span>
                    <span>{distance} km</span>
                 </div>
                 <div className="flex justify-between text-sm text-gray-500">
                    <span>Base Fare</span>
                    <span>KES {basePrice}</span>
                 </div>
                 <div className="flex justify-between text-sm text-gray-500">
                    <span>Distance Fee (1 KES/km)</span>
                    <span>KES {deliveryFee}</span>
                 </div>
                 <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total</span>
                    <span>KES {displayPrice}</span>
                 </div>
              </div>

              <button
                onClick={handleSubmit}
                disabled={isProcessing}
                className="w-full mt-6 bg-green-600 text-white py-3 rounded-xl disabled:opacity-50"
              >
                {isProcessing ? "Processing..." : "Complete Order"}
              </button>

              {step === "success" && (
                <p className="text-green-600 mt-4 text-sm">{statusMessage}</p>
              )}

              {step === "error" && (
                <div className="mt-4">
                    <p className="text-red-600 text-sm mb-2">{errorMessage}</p>
                    {currentOrderId && (
                        <div className="flex flex-col gap-2">
                        <button 
                            onClick={checkStatus}
                            className="text-sm text-green-600 underline font-semibold"
                        >
                            I have paid, check status again
                        </button>
                        
                        {/* Simulation Button */}
                        <button 
                            onClick={handleDevPay}
                             className="text-xs text-gray-500 hover:text-black underline flex items-center justify-center gap-1 mt-2"
                        >
                            ⚡ Sandbox Stuck? Simulate Pay
                        </button>
                        </div>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
