import { get, post } from "./fetchWrapper";

export function initiatePayment(orderId, phoneNumber) {
  return post(`/payments/orders/${orderId}/pay`, {
    phone_number: phoneNumber,
  });
}

export function checkPaymentStatus(orderId) {
  return get(`/payments/status/${orderId}`);
}

export function queryTransaction(checkoutRequestId) {
  return get(`/payments/query/${checkoutRequestId}`);
}

export function simulatePayment(orderId) {
  return post(`/payments/simulate-order/${orderId}`, {});
}

export function pollPaymentStatus(orderId, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;

      try {
        const data = await checkPaymentStatus(orderId);
        const payment = data.payment;

        if (payment?.payment_status === "PAID") {
          clearInterval(interval);
          resolve(payment);
        } else if (
          payment?.payment_status === "FAILED" ||
          payment?.payment_status === "CANCELLED"
        ) {
          clearInterval(interval);
          reject(new Error(payment?.failure_reason || "Payment failed or was cancelled"));
        } else if (payment?.checkout_request_id && attempts % 5 === 0) {
          // Every 5th attempt (10 seconds), query M-Pesa directly
          // This handles cases where the callback callback failed or is prohibited
          try {
             const queryResult = await queryTransaction(payment.checkout_request_id);
             if (queryResult?.payment?.payment_status === "PAID") {
                clearInterval(interval);
                resolve(queryResult.payment);
             }
          } catch (e) { 
             console.warn("Manual query failed:", e);
          }
        } 
        
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(
            new Error("Payment is processing. Check My Orders in a few minutes")
          );
        }
      } catch (err) {
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(
            new Error("Payment is processing. Check My Orders in a few minutes")
          );
        }
      }
    }, 2000);
  });
}

export function validatePhoneNumber(phone) {
  const cleaned = phone.replace(/[\s\-+]/g, "");
  if (!/^254\d{9}$/.test(cleaned)) {
    return { valid: false, error: "Phone must be in format 254XXXXXXXXX (12 digits starting with 254)" };
  }
  return { valid: true, phone: cleaned };
}
