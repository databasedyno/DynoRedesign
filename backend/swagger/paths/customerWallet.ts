/**
 * Merchant-facing customer wallet (store credit) adjustments — x-api-key auth.
 * Aliases of the legacy /api/admin/customers/{customerId}/credit|debit routes.
 */
const walletAdjustBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["amount", "description"],
        properties: {
          amount: { type: "number", example: 25, description: "Positive amount in the wallet currency (USD)" },
          description: { type: "string", example: "Refund for order #12345", description: "Reason shown in the ledger" },
        },
      },
    },
  },
};

const walletAdjustResponse = (verb: "credited" | "debited") => ({
  200: {
    description: `Wallet ${verb}`,
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            message: { type: "string", example: `Wallet ${verb} successfully` },
            data: {
              type: "object",
              properties: {
                customer_id: { type: "string", example: "123" },
                previous_balance: { type: "string", example: "100.00" },
                [verb === "credited" ? "amount_credited" : "amount_debited"]: { type: "string", example: "25.00" },
                new_balance: { type: "string", example: verb === "credited" ? "125.00" : "75.00" },
                currency: { type: "string", example: "USD" },
              },
            },
          },
        },
      },
    },
  },
  400: { description: "Invalid amount / missing description / insufficient balance" },
  403: { description: "Customer belongs to another brand" },
  404: { description: "Customer or wallet not found" },
});

const customerIdParam = {
  name: "customerId",
  in: "path",
  required: true,
  schema: { type: "integer" },
  description: "Numeric customer_id (from Create Customer / the Customers page)",
};

export const customerWalletPaths = {
  "/api/user/customers/{customerId}/credit": {
    post: {
      tags: ["Direct API - Merchant Integration"],
      summary: "Credit a customer's wallet balance",
      description:
        "Add store credit to a customer's USD wallet — refunds, rewards, promos or programmatic top-ups. Writes a CREDIT row to the customer's ledger. Also available in-app under Customers → customer → Balance.",
      security: [{ ApiKeyAuth: [] }],
      parameters: [customerIdParam],
      requestBody: walletAdjustBody,
      responses: walletAdjustResponse("credited"),
    },
  },
  "/api/user/customers/{customerId}/debit": {
    post: {
      tags: ["Direct API - Merchant Integration"],
      summary: "Debit a customer's wallet balance",
      description:
        "Deduct store credit from a customer's USD wallet (service fees, adjustments). Fails with 400 when the balance is insufficient. Writes a DEBIT row to the ledger.",
      security: [{ ApiKeyAuth: [] }],
      parameters: [customerIdParam],
      requestBody: walletAdjustBody,
      responses: walletAdjustResponse("debited"),
    },
  },
};
