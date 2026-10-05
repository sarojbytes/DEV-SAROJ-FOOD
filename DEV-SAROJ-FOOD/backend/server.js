const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("DEV/SAROJ FOOD Backend is running 🚀");
});

app.post("/create-order", async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: "Invalid amount"
            });
        }

        const orderId = "devsaroj_" + Date.now();

        const response = await fetch(
            "https://sandbox.cashfree.com/pg/orders",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-client-id": process.env.CASHFREE_APP_ID,
                    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
                    "x-api-version": "2025-01-01"
                },
                body: JSON.stringify({
                    order_amount: Number(amount),
                    order_currency: "INR",
                    order_id: orderId,
                    customer_details: {
                        customer_id: "devsaroj_customer",
                        customer_phone: "9999999999"
                    },
                    order_meta: {
                        return_url:
"https://sarojbytes.github.io/DEV-SAROJ-FOOD/DEV-SAROJ-FOOD/?order_id={order_id}"
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.log("Cashfree Error:", data);

            return res.status(response.status).json(data);
        }

        res.json({
            success: true,
            orderId: data.order_id,
            paymentSessionId: data.payment_session_id
        });

    } catch (error) {
        console.error("Server Error:", error);

        res.status(500).json({
            error: "Something went wrong",
            message: error.message
        });
    }
});
app.get("/payment-status/:orderId", async (req, res) => {
    try {
        const orderId = req.params.orderId;

        // 1. Get actual order details from Cashfree
        const orderResponse = await fetch(
            `https://sandbox.cashfree.com/pg/orders/${orderId}`,
            {
                method: "GET",
                headers: {
                    "x-client-id": process.env.CASHFREE_APP_ID,
                    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
                    "x-api-version": "2025-01-01",
                    "Accept": "application/json"
                }
            }
        );

        const orderData = await orderResponse.json();

        if (!orderResponse.ok) {
            console.log("Order Status Error:", orderData);

            return res.status(orderResponse.status).json({
                success: false,
                status: "ERROR",
                message: "Unable to verify order."
            });
        }

        // 2. Get payment details
        const paymentResponse = await fetch(
            `https://sandbox.cashfree.com/pg/orders/${orderId}/payments`,
            {
                method: "GET",
                headers: {
                    "x-client-id": process.env.CASHFREE_APP_ID,
                    "x-client-secret": process.env.CASHFREE_SECRET_KEY,
                    "x-api-version": "2025-01-01",
                    "Accept": "application/json"
                }
            }
        );

        const payments = await paymentResponse.json();

        if (!paymentResponse.ok) {
            console.log("Payment Status Error:", payments);

            return res.status(paymentResponse.status).json({
                success: false,
                status: "ERROR",
                message: "Unable to verify payment."
            });
        }

        // 3. Find successful payment
        const successPayment = payments.find(
            payment => payment.payment_status === "SUCCESS"
        );

        // 4. Only accept payment when BOTH order and payment are successful
        if (
            orderData.order_status === "PAID" &&
            successPayment
        ) {
            return res.json({
                success: true,
                status: "SUCCESS",
                orderId: orderId,
                amount: Number(orderData.order_amount),
                currency: orderData.order_currency,
                paymentId: successPayment.cf_payment_id
            });
        }

        // 5. Check pending payment
        const pendingPayment = payments.find(
            payment =>
                payment.payment_status === "PENDING" ||
                payment.payment_status === "NOT_ATTEMPTED"
        );

        if (
            orderData.order_status === "ACTIVE" ||
            pendingPayment
        ) {
            return res.json({
                success: false,
                status: "PENDING",
                orderId: orderId
            });
        }

        // 6. Everything else = failed/not completed
        return res.json({
            success: false,
            status: "FAILED",
            orderId: orderId
        });

    } catch (error) {
        console.error("Payment Verification Error:", error);

        return res.status(500).json({
            success: false,
            status: "ERROR",
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});