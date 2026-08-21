/**
 * Diagnostics Controller - Binance Testing Endpoints
 * Add these endpoints to test Binance integration from Railway deployment
 */

import express from "express";
import * as binanceService from "../services/binanceService";
import { getTunnelStatus } from "../services/sshTunnelManager";
import { dynoPayEmailTemplate } from "../helper/sendEmail";
import { baseEmailTemplate, infoBox, dataRow, statusBadge, p, otpBlock } from "../utils/emailTemplate";
import adminAuthMiddleware from "../middleware/adminAuthMiddleware";
import { enqueueWebhook } from "../services/webhookQueue";
import { sweepExpiredPaymentLinks } from "../services/paymentExpirySweeper";
import { webhookLogs } from "../utils/loggers";
import tatumHttp from "../utils/tatumHttp";

const router = express.Router();

/**
 * GET /diagnostics/tunnel-status
 * SSH SOCKS5 tunnel health and diagnostics (admin only)
 */
router.get("/tunnel-status", adminAuthMiddleware, (_req: express.Request, res: express.Response) => {
  const status = getTunnelStatus();
  const proxyState = binanceService.getProxyState();
  res.status(200).json({
    success: true,
    tunnel: status,
    binanceProxy: proxyState,
  });
});

/**
 * POST /diagnostics/sweep-expired-payments
 * Manually run the payment.expired sweeper (admin only).
 * Exists because the cron is leader-gated, so previews/secondaries never fire it.
 * Body: { lookback_minutes?: number, limit?: number }
 */
router.post("/sweep-expired-payments", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const result = await sweepExpiredPaymentLinks({
      lookbackMinutes: req.body?.lookback_minutes ? Number(req.body.lookback_minutes) : undefined,
      limit: req.body?.limit ? Number(req.body.limit) : undefined,
    });
    res.status(200).json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

/**
 * GET /diagnostics/email-preview
 * Preview all email template styles in a gallery
 */
router.get("/email-preview", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const template = req.query.template as string || 'payment';
  
  const templates: Record<string, () => string> = {
    payment: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Great news! Your company <strong>Acme Corp</strong> has received a payment.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount', `<strong>0.05 BTC</strong>`)}
          ${dataRow('Status', statusBadge('Received', 'success'))}
          ${dataRow('Date', `14 Feb 2026 at 10:30 AM`)}
          ${dataRow('Transaction ID', `<span style="font-size: 12px; font-family: monospace;">TX-00482</span>`, true)}
        </table>
      `, '#22c55e')}
      ${p(`The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard.`)}`;
      return baseEmailTemplate("Payment Received", content, { showButton: true, buttonText: "View Transaction", buttonLink: "#" });
    },
    otp: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Here's your one-time login code for Dynopay:`)}
      ${otpBlock('847291')}
      ${p(`This code expires in 10 minutes. If you didn't request this code, please secure your account immediately.`)}`;
      return baseEmailTemplate("Your Login Code", content);
    },
    security: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`We detected unusual activity on your Dynopay account.`)}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Alert Details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Type', 'New Login from Unknown Device')}
          ${dataRow('Date', '14 Feb 2026 at 3:45 PM')}
          ${dataRow('IP Address', '192.168.1.100', true)}
        </table>
      `, '#ef4444')}
      ${p(`<strong>Was this you?</strong><br />If you recognize this activity, you can ignore this message.`)}
      ${p(`<strong>Didn't perform this action?</strong><br />Please change your password immediately and contact support.`)}`;
      return baseEmailTemplate("Security Alert", content, { showButton: true, buttonText: "Secure My Account", buttonLink: "#" });
    },
    welcome: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Welcome to Dynopay! We're excited to have you on board.`)}
      ${p(`Dynopay makes accepting crypto payments simple, secure, and fast.`)}
      ${infoBox(`
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Here's what you can do next:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">1. Complete your company profile</td></tr>
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">2. Add your payout wallet</td></tr>
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">3. Start accepting payments</td></tr>
        </table>
      `)}`;
      return baseEmailTemplate("Welcome to Dynopay", content, { showButton: true, buttonText: "Get Started", buttonLink: "#" });
    },
    admin: () => {
      const content = `${p(`Hey Admin,`)}
      ${p(`Platform fee received from <strong>Acme Corp</strong>.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Platform Fee', `<strong>$15.00 USDT</strong>`)}
          ${dataRow('Status', statusBadge('Processed', 'success'))}
          ${dataRow('Merchant Net', '$985.00 USDT')}
          ${dataRow('Total Processed', '$1,000.00 USDT')}
          ${dataRow('Company', 'Acme Corp')}
          ${dataRow('Transaction ID', `<span style="font-size: 12px; font-family: monospace;">TX-00482</span>`, true)}
        </table>
      `, '#22c55e')}
      ${p(`The fee has been credited to the admin USDT wallet.`)}`;
      return baseEmailTemplate("Platform Fee Received", content);
    },
  };

  const names = Object.keys(templates);
  const nav = names.map(n => `<a href="?template=${n}" style="display:inline-block;padding:8px 16px;margin:4px;background:${n === template ? '#0d1f5c' : '#e5e7eb'};color:${n === template ? '#fff' : '#374151'};border-radius:6px;text-decoration:none;font-size:13px;font-family:sans-serif;">${n}</a>`).join('');
  
  const html = (templates[template] || templates.payment)();
  res.setHeader("Content-Type", "text/html");
  res.send(`<div style="background:#f3f4f6;padding:16px;text-align:center;">${nav}</div>${html}`);
});

/**
 * GET /diagnostics/binance-ping
 * Test basic Binance connectivity (public endpoint, no auth)
 */
router.get("/binance-ping", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    await binanceService.ping();
    res.status(200).json({
      success: true,
      message: "Binance API is reachable from Railway",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: "Cannot reach Binance API",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /diagnostics/binance-time
 * Get Binance server time (public endpoint)
 */
router.get("/binance-time", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const serverTime = await binanceService.getServerTime();
    res.status(200).json({
      success: true,
      serverTime: serverTime,
      serverDate: new Date(serverTime).toISOString(),
      message: "Binance API accessible from Railway"
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /diagnostics/binance-account
 * Test authenticated Binance endpoint (requires API key)
 */
router.get("/binance-account", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const accountInfo: any = await binanceService.getAccountInfo();
    res.status(200).json({
      success: true,
      accountType: accountInfo.accountType || 'SPOT',
      canTrade: accountInfo.canTrade || false,
      canWithdraw: accountInfo.canWithdraw || false,
      canDeposit: accountInfo.canDeposit || false,
      balanceCount: accountInfo.balances?.length || 0,
      message: "Binance authenticated API working"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Binance API authentication failed"
    });
  }
});

/**
 * GET /diagnostics/binance-quote
 * Test spot price quote (non-executing, safe for testing)
 */
router.get("/binance-quote", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const fromAsset = req.query.from as string || "BTC";
    const toAsset = req.query.to as string || "USDT";
    const amount = parseFloat(req.query.amount as string || "0.001");

    // Use spot price quote instead of Convert API (Convert requires special Binance approval)
    const quote = await binanceService.getSpotQuote(fromAsset, toAsset, amount);
    
    res.status(200).json({
      success: true,
      quote: {
        symbol: quote.symbol,
        fromAsset: quote.fromAsset,
        toAsset: quote.toAsset,
        fromAmount: quote.fromAmount,
        estimatedToAmount: quote.estimatedToAmount,
        price: quote.price,
      },
      method: "spot_market_price",
      message: "Binance Spot quote retrieved successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Binance Spot quote failed"
    });
  }
});

/**
 * GET /diagnostics/binance-exchange-info
 * Get trading pair info (min quantity, step size)
 */
router.get("/binance-exchange-info", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const symbol = req.query.symbol as string || "BTCUSDT";
    const info = await binanceService.getExchangeInfo(symbol);
    res.status(200).json({ success: true, ...info });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /diagnostics/binance-info
 * Get Binance connection info
 */
router.get("/binance-info", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  const hasApiKey = !!process.env.BINANCE_API_KEY;
  const hasApiSecret = !!process.env.BINANCE_API_SECRET;
  
  res.status(200).json({
    success: true,
    binanceConfigured: hasApiKey && hasApiSecret,
    apiKeyPresent: hasApiKey,
    apiSecretPresent: hasApiSecret,
    baseUrl: process.env.BINANCE_BASE_URL || "https://api.binance.com",
    railwayEnvironment: !!process.env.RAILWAY_ENVIRONMENT,
    nodeEnv: process.env.NODE_ENV
  });
});

/**
 * GET /diagnostics/binance-balances
 * List all non-zero balances in the Binance account
 */
router.get("/binance-balances", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const account: any = await binanceService.getAccountInfo();
    const nonZero = account.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toFixed(8),
      }));
    res.status(200).json({ success: true, balances: nonZero, count: nonZero.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /diagnostics/binance-sell
 * Execute a market sell order for testing. Body: { asset: "POL", amount: 10.5 }
 * Sells to USDT via spot market order.
 */
router.post("/binance-sell", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { asset, amount } = req.body;
    if (!asset || !amount) {
      return res.status(400).json({ success: false, error: "Provide 'asset' and 'amount' in request body" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be a positive number" });
    }

    // Check balance first
    const balance = await binanceService.getAssetBalance(asset.toUpperCase());
    if (balance.free < numAmount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${asset} balance. Available: ${balance.free}, Requested: ${numAmount}`,
      });
    }

    // Execute spot market sell
    const result = await binanceService.convertViaSpotTrade(asset, "USDT", numAmount);

    res.status(200).json({
      success: true,
      order: {
        orderId: result.orderId,
        fromAsset: result.fromAsset,
        toAsset: result.toAsset,
        fromAmount: result.fromAmount,
        toAmount: result.toAmount,
        avgPrice: result.avgPrice,
        status: result.status,
      },
      message: `Sold ${result.fromAmount} ${result.fromAsset} → ${result.toAmount} USDT @ avg price ${result.avgPrice}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /diagnostics/binance-orderbook
 * Get order book depth for a trading pair
 */
router.get("/binance-orderbook", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const symbol = (req.query.symbol as string) || "BTCUSDT";
    const limit = parseInt(req.query.limit as string) || 5;
    const data = await binanceService.getOrderBookDepth(symbol, limit);
    res.status(200).json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /diagnostics/conversion-email-preview
 * Preview the auto-conversion payout email template with sample data
 * Query params: ?volatile=true for volatile market version, default is stable
 */
router.get("/conversion-email-preview", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const isVolatile = req.query.volatile === "true";

  // Sample data for preview
  const sampleData = {
    sourceCurrency: "BTC",
    sourceAmount: "0.00150000",
    sourceAmountUsd: "101.82",
    targetCurrency: "USDT",
    payoutAmount: "100.45",
    conversionRate: "67880.40",
    priceAtConversion: 67880.40,
    currentPrice: isVolatile ? 66200.00 : 68100.50,
    priceMovementPct: isVolatile ? -2.47 : -0.12,
    marketState: isVolatile ? "VOLATILE" : "STABLE",
    feeTierUsed: isVolatile ? "fast" : "slow",
    transactionId: "TXN-2026-00847",
    conversionId: "142",
    withdrawalTxHash: "0x7a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  };

  const priceAtConversion = sampleData.priceAtConversion;
  const currentPrice = sampleData.currentPrice;
  const priceMovementPct = sampleData.priceMovementPct;
  const marketState = sampleData.marketState;
  const feeTierUsed = sampleData.feeTierUsed;
  const priceDiffSinceConversion = ((currentPrice - priceAtConversion) / priceAtConversion) * 100;
  const priceDroppedSinceConversion = priceDiffSinceConversion < -0.1;
  const savedAmount = priceDroppedSinceConversion
    ? Math.abs(priceDiffSinceConversion / 100) * parseFloat(sampleData.payoutAmount)
    : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const volatilityVisual = isVolatile ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 24px 0;">
      <tr>
        <td style="padding: 16px 20px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; font-weight: 600; color: #991b1b; font-family: 'Inter', Arial, sans-serif; padding-bottom: 10px;">
                MARKET VOLATILITY AT TIME OF CONVERSION
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fecaca; border-radius: 4px; height: 10px;">
                  <tr>
                    <td style="width: ${Math.min(100, Math.abs(priceMovementPct) * 20)}%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 4px; height: 10px;">&nbsp;</td>
                    <td style="height: 10px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #7f1d1d; font-family: 'Inter', Arial, sans-serif; padding-top: 6px;">
                BTC moved <strong>${Math.abs(priceMovementPct).toFixed(2)}%</strong> during conversion window &mdash; fast-tracked with priority fees
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  const savingsBlock = priceDroppedSinceConversion ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; border-left: 4px solid #22c55e; text-align: center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; font-weight: 600; color: #166534; font-family: 'Inter', Arial, sans-serif; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                Auto-Conversion Protected You
              </td>
            </tr>
            <tr>
              <td style="font-size: 28px; font-weight: 700; color: #15803d; font-family: 'Inter', Arial, sans-serif; padding: 8px 0;">
                ~$${savedAmount.toFixed(2)} saved
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #166534; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
                BTC has dropped <strong>${Math.abs(priceDiffSinceConversion).toFixed(2)}%</strong> since your conversion<br/>
                <span style="color: #6b7280;">Converted at $${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &mdash; Now $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  const priceUpBlock = !priceDroppedSinceConversion && Math.abs(priceDiffSinceConversion) > 0.1 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 16px 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6;">
          <p style="margin: 0; font-size: 13px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
            BTC is currently at <strong>$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            (+${priceDiffSinceConversion.toFixed(2)}% since conversion).
            Your payout was locked in at <strong>$${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for price certainty.
          </p>
        </td>
      </tr>
    </table>` : '';

  const htmlContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">
      Your crypto payment has been auto-converted and the payout has been sent to your wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="padding: 0 4px 12px 0; width: 50%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
            <tr><td style="padding: 16px; text-align: center;">
              <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Received</p>
              <p style="font-size: 22px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${sampleData.sourceAmount} BTC</p>
              <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">~$${sampleData.sourceAmountUsd} USD</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 0 12px 4px; width: 50%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px;">
            <tr><td style="padding: 16px; text-align: center;">
              <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Payout</p>
              <p style="font-size: 22px; font-weight: 700; color: #15803d; margin: 0; font-family: 'Inter', Arial, sans-serif;">${sampleData.payoutAmount} USDT</p>
              <p style="font-size: 12px; color: #166534; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">Sent to your wallet</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    ${volatilityVisual}
    ${savingsBlock}
    ${priceUpBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Conversion Rate</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">1 BTC = 67,880.40 USDT</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Market State</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: ${isVolatile ? '#fef3c7' : '#dcfce7'}; color: ${isVolatile ? '#92400e' : '#166534'}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${marketState}</span></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Withdrawal TX</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">0x7a3f8b...d8e9f0</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Conversion ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">#142</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">
      Auto-conversion ensures you receive stablecoins, protecting your revenue from crypto price swings. View your full transaction history in your Dynopay dashboard.
    </p>`;

  const html = dynoPayEmailTemplate("Alex", htmlContent, "Payout Complete");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

/**
 * GET /diagnostics/weekly-conversion-email-preview
 * Preview the weekly conversion summary email with sample data
 */
router.get("/weekly-conversion-email-preview", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  const sampleData = {
    periodStart: "2026-02-05",
    periodEnd: "2026-02-12",
    totalConversions: 12,
    totalSourceUsd: 4250.00,
    totalPayoutUsd: 4182.35,
    totalSavedUsd: 47.82,
    totalVolatileConversions: 5,
    avgPriceMovementPct: -1.28,
    cryptoBreakdown: [
      { currency: "BTC", count: 5, totalAmount: "0.06250000", totalPayoutUsd: 2845.20, avgMovementPct: -1.85 },
      { currency: "ETH", count: 4, totalAmount: "1.42000000", totalPayoutUsd: 985.60, avgMovementPct: -0.92 },
      { currency: "SOL", count: 2, totalAmount: "4.35000000", totalPayoutUsd: 285.55, avgMovementPct: -0.45 },
      { currency: "XRP", count: 1, totalAmount: "47.80000000", totalPayoutUsd: 66.00, avgMovementPct: 0.12 },
    ],
    dailyVolume: [
      { day: "2026-02-06", label: "Thu", payoutUsd: 420 },
      { day: "2026-02-07", label: "Fri", payoutUsd: 850 },
      { day: "2026-02-08", label: "Sat", payoutUsd: 0 },
      { day: "2026-02-09", label: "Sun", payoutUsd: 120 },
      { day: "2026-02-10", label: "Mon", payoutUsd: 1580 },
      { day: "2026-02-11", label: "Tue", payoutUsd: 910 },
      { day: "2026-02-12", label: "Wed", payoutUsd: 302 },
    ],
  };

  const maxDailyVolume = Math.max(...sampleData.dailyVolume.map(d => d.payoutUsd), 1);

  const chartRows = sampleData.dailyVolume.map(d => {
    const barWidth = Math.max(2, Math.round((d.payoutUsd / maxDailyVolume) * 100));
    const hasActivity = d.payoutUsd > 0;
    return `
      <tr>
        <td style="padding: 4px 8px 4px 0; font-size: 12px; color: #6b7280; font-family: 'Inter', Arial, sans-serif; white-space: nowrap; width: 40px;">${d.label}</td>
        <td style="padding: 4px 0; width: 100%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 3px; height: 18px;">
            <tr>
              <td style="width: ${barWidth}%; background: ${hasActivity ? 'linear-gradient(90deg, #1034a6, #3b82f6)' : 'transparent'}; border-radius: 3px; height: 18px;">&nbsp;</td>
              <td style="height: 18px;">&nbsp;</td>
            </tr>
          </table>
        </td>
        <td style="padding: 4px 0 4px 8px; font-size: 12px; color: ${hasActivity ? '#1a1a2e' : '#9ca3af'}; font-family: 'Inter', Arial, sans-serif; white-space: nowrap; text-align: right; width: 60px; font-weight: ${hasActivity ? '600' : '400'};">${hasActivity ? '$' + d.payoutUsd : '-'}</td>
      </tr>`;
  }).join('');

  const breakdownRows = sampleData.cryptoBreakdown.map(c => {
    const movementColor = c.avgMovementPct < -1 ? '#dc2626' : c.avgMovementPct < 0 ? '#f59e0b' : '#22c55e';
    const movementSign = c.avgMovementPct >= 0 ? '+' : '';
    return `
      <tr>
        <td style="padding: 10px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${c.currency}</td>
        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: center; border-bottom: 1px solid #f3f4f6;">${c.count}</td>
        <td style="padding: 10px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">$${c.totalPayoutUsd.toFixed(2)}</td>
        <td style="padding: 10px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">
          <span style="color: ${movementColor}; font-size: 13px; font-weight: 500;">${movementSign}${c.avgMovementPct.toFixed(2)}%</span>
        </td>
      </tr>`;
  }).join('');

  const htmlContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">
      Here's your weekly auto-conversion report for <strong style="color: #1a1a2e;">Acme Payments Inc.</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="padding: 0 4px 8px 0; width: 33%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">12</p>
              <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Conversions</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 4px 8px 4px; width: 34%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #15803d; margin: 0; font-family: 'Inter', Arial, sans-serif;">$4182</p>
              <p style="font-size: 11px; color: #166534; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Total Payout</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 0 8px 4px; width: 33%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #dc2626; margin: 0; font-family: 'Inter', Arial, sans-serif;">-1.3%</p>
              <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Avg Movement</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; text-align: center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size: 13px; font-weight: 600; color: #166534; font-family: 'Inter', Arial, sans-serif; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Total Protected This Week</td></tr>
            <tr><td style="font-size: 32px; font-weight: 700; color: #15803d; font-family: 'Inter', Arial, sans-serif; padding: 8px 0;">~$47.82</td></tr>
            <tr><td style="font-size: 13px; color: #166534; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">saved by converting before further price drops<br/><span style="color: #6b7280;">5 of 12 conversions occurred during volatile markets</span></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #1a1a2e; font-family: 'Inter', Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Daily Conversion Volume</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${chartRows}
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #1a1a2e; font-family: 'Inter', Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Breakdown by Crypto</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Asset</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: center; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Count</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Payout</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Avg Move</td>
          </tr>
          ${breakdownRows}
        </table>
      </td></tr>
    </table>
    <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">
      Report period: Feb 5, 2026 to Feb 12, 2026. Auto-conversion protects your revenue from crypto price volatility by instantly converting to stablecoins.
    </p>`;

  const html = dynoPayEmailTemplate("Alex", htmlContent, "Weekly Conversion Report");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

// ─── STUCK PAYMENT RECOVERY ──────────────────────────────────────────────────

import tatumApi from "../apis/tatumApi";
import { getRedisItem, setRedisItem, setRedisTTL, setRedisItemWithTTL } from "../utils/redisInstance";
import { userWalletModel } from "../models";
import { merchantTempAddressModel, merchantPoolTransactionModel } from "../models/merchantPoolModels";
import { fundGasIfNeeded } from "../services/merchantPool/merchantPoolSweep";
import { calculateDynamicTRC20Fee } from "../services/tronEnergyService";
import { getAdminWalletAddress } from "../utils/adminUtils";
import { cronLogger } from "../utils/loggers";

/**
 * POST /diagnostics/replay-webhook
 * Re-enqueues a crypto webhook into BullMQ for reprocessing.
 * Requires admin auth.
 * Body: {
 *   address: string,        // Crypto address that received the payment
 *   amount: string,         // Amount received (e.g. "0.006256")
 *   txId: string,           // On-chain transaction ID
 *   asset: string,          // Currency (e.g. "BTC", "ETH", "USDT")
 *   company_id?: number,    // Optional: Company ID
 *   user_id?: number,       // Optional: User ID
 *   address_id?: number,    // Optional: Address ID
 *   clear_processed?: boolean // Optional: Clear the processed-tx key first (default: true)
 * }
 */
router.post("/replay-webhook", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const { address, amount, txId, asset, company_id, user_id, address_id, clear_processed } = req.body;

  if (!address || !amount || !txId || !asset) {
    return res.status(400).json({ error: "address, amount, txId, and asset are required" });
  }

  try {
    // Optionally clear the processed-tx key so the webhook processor doesn't skip it
    const shouldClear = clear_processed !== false; // default true
    if (shouldClear) {
      const { redis } = require("../utils/redisInstance");
      const processedKey = `processed-tx-${txId}`;
      const existed = await redis.del(processedKey);
      webhookLogs.info(`[ReplayWebhook] Cleared processed-tx key for ${txId} (existed: ${!!existed})`);
    }

    // Build the webhook payload matching Tatum format
    const webhookPayload = {
      address,
      amount: String(amount),
      txId,
      asset,
      blockNumber: 0,
      type: "native",
    };

    // Enqueue into BullMQ
    await enqueueWebhook(
      {
        payload: webhookPayload,
        queryParams: {
          company_id: company_id ? Number(company_id) : undefined,
          user_id: user_id ? Number(user_id) : undefined,
          address_id: address_id ? Number(address_id) : undefined,
        },
        source: "admin-replay",
        receivedAt: new Date().toISOString(),
      },
      { jobId: `replay-${txId}-${Date.now()}` }
    );

    webhookLogs.info(`[ReplayWebhook] ✅ Replayed webhook for tx ${txId} (${amount} ${asset} → ${address})`);

    return res.status(200).json({
      success: true,
      message: `Webhook replayed for tx ${txId}`,
      details: {
        address,
        amount,
        txId,
        asset,
        company_id,
        processedKeyCleared: shouldClear,
      },
    });
  } catch (err) {
    webhookLogs.error(`[ReplayWebhook] Failed to replay webhook for tx ${txId}: ${(err as Error).message}`);
    return res.status(500).json({
      error: "Failed to replay webhook",
      message: (err as Error).message,
    });
  }
});



/**
 * POST /diagnostics/recover-stuck-payment
 * Re-triggers settlement for a payment stuck due to OUT_OF_ENERGY or similar failures.
 * Requires admin auth. Body: { payment_id: string } OR { temp_address: string }
 * 
 * Also accepts optional overrides:
 *   merchant_wallet: string  — override destination wallet
 *   merchant_amount: number  — override amount to send
 * 
 * Flow:
 * 1. Looks up the temp address record in merchantTempAddressModel
 * 2. Checks on-chain balance
 * 3. Re-funds gas if needed (energy-aware)
 * 4. Re-triggers the transfer to merchant wallet
 */
router.post("/recover-stuck-payment", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const { payment_id, temp_address, merchant_wallet: overrideMerchantWallet, merchant_amount: overrideMerchantAmount } = req.body;
  
  if (!payment_id && !temp_address) {
    return res.status(400).json({ error: "payment_id or temp_address is required" });
  }

  const steps: { step: string; status: string; details?: unknown }[] = [];

  try {
    // Step 1: Find the merchant temp address record
    let tempAddrRecord: any = null;
    
    if (temp_address) {
      tempAddrRecord = await merchantTempAddressModel.findOne({
        where: { wallet_address: temp_address },
      });
    }
    
    if (!tempAddrRecord && payment_id) {
      tempAddrRecord = await merchantTempAddressModel.findOne({
        where: { current_payment_id: payment_id },
      });
    }
    
    if (!tempAddrRecord) {
      return res.status(404).json({ 
        error: "Temp address not found for this payment",
        payment_id,
        temp_address,
      });
    }
    
    const tempData = tempAddrRecord.dataValues;
    const tempAddress = tempData.wallet_address;
    const currency = tempData.wallet_type;
    const ownerUserId = tempData.owner_user_id;
    
    steps.push({ step: "find_temp_address", status: "ok", details: {
      temp_address_id: tempData.temp_address_id,
      wallet_address: tempAddress,
      wallet_type: currency,
      status: tempData.status,
      current_payment_id: tempData.current_payment_id,
      admin_fee_balance: tempData.admin_fee_balance,
      owner_user_id: ownerUserId,
    }});

    // Step 2: Look up the pool transaction record to get merchant_amount
    let poolTx: any = null;
    if (payment_id) {
      poolTx = await merchantPoolTransactionModel.findOne({
        where: { payment_reference: payment_id },
      });
    }
    if (!poolTx && tempData.current_payment_id) {
      poolTx = await merchantPoolTransactionModel.findOne({
        where: { payment_reference: tempData.current_payment_id },
      });
    }
    if (!poolTx) {
      poolTx = await merchantPoolTransactionModel.findOne({
        where: { temp_address_id: tempData.temp_address_id },
        order: [['created_at', 'DESC']],
      });
    }
    
    steps.push({ step: "find_pool_transaction", status: poolTx ? "ok" : "not_found", details: poolTx ? {
      pool_tx_id: poolTx.dataValues.pool_tx_id,
      payment_reference: poolTx.dataValues.payment_reference,
      merchant_amount: poolTx.dataValues.merchant_amount,
      admin_fee_amount: poolTx.dataValues.admin_fee_amount,
      payment_amount: poolTx.dataValues.payment_amount,
      status: poolTx.dataValues.status,
    } : null });

    // Step 3: Find the merchant destination wallet
    let merchantWallet = overrideMerchantWallet || null;
    
    if (!merchantWallet && ownerUserId) {
      const merchantWalletRecord = await userWalletModel.findOne({
        where: { user_id: ownerUserId, wallet_type: currency },
      });
      merchantWallet = merchantWalletRecord?.dataValues?.wallet_address || null;
    }
    
    const adminWallet = getAdminWalletAddress(currency);
    
    if (!merchantWallet && !adminWallet) {
      return res.status(400).json({ 
        error: "No destination wallet found (neither merchant nor admin)",
        steps,
      });
    }
    
    steps.push({ step: "find_merchant_wallet", status: merchantWallet ? "ok" : "fallback_admin", details: {
      merchant_wallet: merchantWallet,
      admin_wallet: adminWallet,
      source: overrideMerchantWallet ? "override" : "db_lookup",
    }});

    // Step 4: Check on-chain balance of temp address
    const isTRC20 = currency?.includes("TRC20");
    const isERC20Token = currency?.includes("ERC20") || currency?.includes("POLYGON");
    const gasToken = isTRC20 ? "TRX" : isERC20Token ? "ETH" : currency;
    
    let tokenBalance = 0;
    let gasBalance = 0;
    
    try {
      const gasBalanceResult = await tatumApi.getAddressBalance(tempAddress, gasToken);
      gasBalance = Number(gasBalanceResult?.balance ?? 0);
      
      if (isTRC20 || isERC20Token) {
        const tokenBalanceResult = await tatumApi.getAddressBalance(tempAddress, currency);
        tokenBalance = Number(tokenBalanceResult?.balance ?? 0);
      } else {
        tokenBalance = gasBalance;
      }
    } catch (balErr) {
      steps.push({ step: "check_balance_tatum", status: "error", details: String(balErr) });
    }

    // TronGrid fallback: Tatum balance API can return stale/0 for TRC20 tokens.
    // Verify directly against the TRON node when Tatum reports 0.
    if (isTRC20 && tokenBalance <= 0) {
      try {
        const tronRes = await tatumHttp.get(
          `https://api.trongrid.io/v1/accounts/${tempAddress}`,
          { timeout: 10000 }
        );
        const acctData = tronRes.data?.data?.[0];
        if (acctData) {
          gasBalance = (acctData.balance || 0) / 1e6;
          const trc20Tokens = acctData.trc20 || [];
          const usdtContract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
          for (const tokenObj of trc20Tokens) {
            if (tokenObj[usdtContract]) {
              tokenBalance = parseInt(tokenObj[usdtContract], 10) / 1e6;
            }
          }
          steps.push({ step: "check_balance_trongrid_fallback", status: "ok", details: {
            token_balance: `${tokenBalance} ${currency}`,
            gas_balance: `${gasBalance} TRX`,
            source: "TronGrid direct (Tatum returned 0)",
          }});
        }
      } catch (tronErr) {
        steps.push({ step: "check_balance_trongrid_fallback", status: "error", details: String(tronErr) });
      }
    }

    // Ethplorer fallback: Same as TronGrid but for ERC20 tokens.
    // Root cause (2026-07-08): Tatum SDK's erc20GetBalance was returning 0 for addresses
    // that verifiably held tokens on-chain, silently losing customer payments.
    if (isERC20Token && tokenBalance <= 0) {
      try {
        const isPolygon = currency?.includes("POLYGON");
        if (isPolygon) {
          // For Polygon, use Tatum v3 REST directly (Ethplorer is Ethereum only)
          const headers = { "x-api-key": process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "" };
          const contract = currency === "USDT-POLYGON"
            ? (process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F")
            : undefined;
          const [tokenRes, gasRes] = await Promise.all([
            tatumHttp.get(`https://api.tatum.io/v3/polygon/account/balance/erc20/${tempAddress}`, {
              headers, params: { contractAddress: contract }, timeout: 15000,
            }).catch(() => ({ data: { balance: "0" } })),
            tatumHttp.get(`https://api.tatum.io/v3/polygon/account/balance/${tempAddress}`, {
              headers, timeout: 15000,
            }).catch(() => ({ data: { balance: "0" } })),
          ]);
          tokenBalance = Number(tokenRes.data?.balance || 0) / 1e6;
          gasBalance = Number(gasRes.data?.balance || 0);
        } else {
          // Ethplorer freekey — reliable, matches on-chain reality
          const ethRes = await tatumHttp.get(
            `https://api.ethplorer.io/getAddressInfo/${tempAddress}?apiKey=freekey`,
            { timeout: 15000 }
          );
          const ethBalance = ethRes.data?.ETH?.balance || 0;
          gasBalance = Number(ethBalance);
          // Map currency → known contract
          const contractMap: Record<string, string | undefined> = {
            "USDT-ERC20": (process.env.ETH_CONTRACT || "0xdac17f958d2ee523a2206206994597c13d831ec7").toLowerCase(),
            "USDC-ERC20": (process.env.USDC_CONTRACT || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48").toLowerCase(),
            "RLUSD-ERC20": (process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD").toLowerCase(),
          };
          const targetContract = contractMap[currency || ""];
          const tokens = ethRes.data?.tokens || [];
          for (const t of tokens) {
            const tokenAddr = (t.tokenInfo?.address || "").toLowerCase();
            if (tokenAddr === targetContract) {
              const rawBalance = t.balance || 0;
              const decimals = parseInt(t.tokenInfo?.decimals || "6", 10);
              tokenBalance = Number(rawBalance) / Math.pow(10, decimals);
              break;
            }
          }
        }
        steps.push({ step: "check_balance_ethplorer_fallback", status: "ok", details: {
          token_balance: `${tokenBalance} ${currency}`,
          gas_balance: `${gasBalance} ${gasToken}`,
          source: isPolygon ? "Tatum v3 REST direct (Polygon)" : "Ethplorer freekey (Tatum SDK returned 0)",
        }});
      } catch (ethErr) {
        steps.push({ step: "check_balance_ethplorer_fallback", status: "error", details: String(ethErr) });
      }
    }
    
    steps.push({ step: "check_balance", status: "ok", details: {
      temp_address: tempAddress,
      token_balance: `${tokenBalance} ${currency}`,
      gas_balance: `${gasBalance} ${gasToken}`,
    }});

    if (tokenBalance <= 0) {
      return res.status(400).json({ 
        error: "No token balance in temp address — funds may have already been transferred",
        steps,
      });
    }

    // Step 5 (MOVED UP from Step 7): Calculate and validate merchant amount BEFORE gas funding.
    // FIX (2026-04-10): Previously gas was funded before amount validation. If the payment had
    // already been settled (by auto-recovery/reconciliation), gas was still sent to the temp address
    // and wasted — this drained 37.49 TRX from the fee wallet unnecessarily.
    let merchantSendAmount: number;
    
    if (overrideMerchantAmount && Number(overrideMerchantAmount) > 0) {
      merchantSendAmount = Number(overrideMerchantAmount);
    } else if (poolTx?.dataValues?.merchant_amount && Number(poolTx.dataValues.merchant_amount) > 0) {
      merchantSendAmount = Number(poolTx.dataValues.merchant_amount);
    } else {
      // Fallback: on-chain balance minus DB admin_fee_balance
      const dbAdminFee = Number(tempData.admin_fee_balance || 0);
      merchantSendAmount = tokenBalance - dbAdminFee;
    }
    
    if (merchantSendAmount <= 0 || merchantSendAmount > tokenBalance) {
      return res.status(400).json({
        error: `Invalid merchant amount: ${merchantSendAmount} (on-chain balance: ${tokenBalance}). Use merchant_amount override if needed.`,
        steps,
        debug: { 
          poolTxMerchantAmount: poolTx?.dataValues?.merchant_amount,
          adminFeeBalance: tempData.admin_fee_balance,
          tokenBalance,
          overrideMerchantAmount,
        },
      });
    }
    
    steps.push({ step: "validate_amount", status: "ok", details: {
      merchant_send_amount: merchantSendAmount,
      token_balance: tokenBalance,
      source: overrideMerchantAmount ? "override" : poolTx ? "pool_transaction" : "balance_minus_admin",
    }});

    // Step 6: For TRC20 — estimate energy and re-fund gas (only after amount is validated)
    // RECOVERY MODE: Always use conservative NEW recipient energy (130k) to avoid
    // stale activation cache causing OUT_OF_ENERGY failures.
    const destination = merchantWallet || adminWallet;
    if (isTRC20) {
      try {
        const trc20Contract = currency === "USDT-TRC20"
          ? (process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
          : undefined;
        // Pass null as recipient to force NEW recipient energy estimate (130k)
        // instead of relying on potentially stale activation cache
        const dynamicFee = await calculateDynamicTRC20Fee(tempAddress, null as any, trc20Contract);
        // Add 30% buffer on top for recovery safety
        const safeGasEstimate = Math.ceil(dynamicFee.fast * 1.3 * 100) / 100;
        steps.push({ step: "energy_estimation", status: "ok", details: {
          required_trx: safeGasEstimate,
          raw_estimate_trx: dynamicFee.fast,
          current_trx: gasBalance,
          energy_needed: dynamicFee.energyNeeded,
          energy_available: dynamicFee.energyAvailable,
          energy_price_sun: dynamicFee.energyPrice,
          recovery_buffer: "30%",
          needs_refunding: gasBalance < safeGasEstimate,
        }});

        if (gasBalance < safeGasEstimate) {
          const fundAmount = safeGasEstimate - gasBalance;
          cronLogger.info(`[RecoverPayment] DIRECT gas funding for ${tempAddress}: sending ${fundAmount.toFixed(6)} TRX (need ${safeGasEstimate}, have ${gasBalance})`);
          
          // RECOVERY: Bypass fundGasIfNeeded (it uses stale activation cache) and send TRX directly
          const { adminFeeModel } = await import("../models");
          const feeWallet = await adminFeeModel.findOne({ where: { wallet_type: "TRX" } });
          if (!feeWallet) throw new Error("TRX fee wallet not found");
          
          const feeWalletPrivateKey = await tatumApi.decryptSymmetric(
            feeWallet.dataValues.privateKey,
            process.env.TEMP_KEY_ID
          );
          
          const gasTxResult = await tatumApi.assetToOtherAddress({
            currency: "TRX",
            fromAddress: feeWallet.dataValues.address,
            toAddress: tempAddress,
            privateKey: feeWalletPrivateKey,
            amount: fundAmount,
            fee: null,
          });
          
          steps.push({ step: "gas_refund_direct", status: gasTxResult?.txId ? "ok" : "failed", details: {
            funded: true,
            amount: fundAmount,
            txId: gasTxResult?.txId,
            method: "direct_trx_transfer (bypassed fundGasIfNeeded)",
            reason: `Recovery mode: ${safeGasEstimate} TRX needed (130k energy + 30% buffer)`,
          }});
          
          if (gasTxResult?.txId) {
            await new Promise(resolve => setTimeout(resolve, 6000));
          }
        }
      } catch (energyErr) {
        steps.push({ step: "energy_estimation", status: "error", details: String(energyErr) });
      }
    } else if (isERC20Token) {
      // FIX (2026-07-08): Recovery endpoint previously did NOT fund gas for ERC20/POLYGON
      // tokens, causing recovery transfers to fail immediately because the temp address
      // rarely has enough native ETH/MATIC to pay for a token transfer.
      try {
        const fundResult = await fundGasIfNeeded(
          tempAddrRecord as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> },
          currency!,
          merchantSendAmount,
          destination || undefined,
        );
        steps.push({ step: "gas_refund_erc20", status: fundResult.funded ? "ok" : "skipped", details: {
          funded: fundResult.funded,
          amount: fundResult.amount,
          txId: fundResult.txId,
          reason: fundResult.reason || "fundGasIfNeeded",
        }});
        if (fundResult.funded) {
          // Wait for gas funding tx to confirm on-chain before attempting the token transfer
          const waitSecs = currency?.includes("POLYGON") ? 20 : 30;
          cronLogger.info(`[RecoverPayment] ERC20 gas funded (${fundResult.amount} native), waiting ${waitSecs}s for on-chain confirmation before transfer`);
          await new Promise(resolve => setTimeout(resolve, waitSecs * 1000));
        }
      } catch (gasErr) {
        steps.push({ step: "gas_refund_erc20", status: "error", details: String(gasErr) });
      }
    }

    // Step 6: Look up Redis data for additional context
    let redisKey = `crypto-${tempAddress}`;
    let redisData = await getRedisItem(redisKey);
    
    if (!redisData && payment_id) {
      redisKey = `payment-${payment_id}`;
      redisData = await getRedisItem(redisKey);
    }
    
    steps.push({ step: "redis_lookup", status: redisData ? "ok" : "not_found", details: {
      key: redisKey,
      has_data: !!redisData,
    }});

    // Step 8: Final amount check (already validated above, compute admin fee remaining)
    const adminFeeRemaining = tokenBalance - merchantSendAmount;
    
    steps.push({ step: "calculate_amounts", status: "ok", details: {
      merchant_send_amount: merchantSendAmount,
      admin_fee_remaining: adminFeeRemaining,
      destination,
      source: overrideMerchantAmount ? "override" : poolTx ? "pool_transaction" : "balance_minus_admin",
    }});
    
    // Step 8: Get the private key — from DB (encrypted) or Redis
    let encryptedPrivateKey = tempData.private_key;
    let privateKey: string | null = null;
    
    if (encryptedPrivateKey) {
      try {
        privateKey = await tatumApi.decryptSymmetric(encryptedPrivateKey, process.env.TEMP_KEY_ID);
      } catch (decryptErr) {
        steps.push({ step: "decrypt_private_key", status: "error", details: String(decryptErr) });
      }
    }
    
    // Fallback to Redis
    if (!privateKey) {
      const redisPrivateKey = redisData?.privateKey || redisData?.private_key;
      if (redisPrivateKey) {
        privateKey = redisPrivateKey;
      }
    }
    
    if (!privateKey) {
      return res.status(200).json({
        status: "partial_recovery",
        message: "Private key not available for automatic transfer. Gas may have been funded. Use Tatum dashboard or provide private key manually.",
        payment_id: payment_id || tempData.current_payment_id,
        temp_address: tempAddress,
        token_balance: tokenBalance,
        merchant_amount: merchantSendAmount,
        admin_fee_remaining: tokenBalance - merchantSendAmount,
        gas_balance: gasBalance,
        destination,
        steps,
      });
    }
    
    steps.push({ step: "private_key", status: "ok", details: "Decrypted successfully" });

    // Step 9: Clear stale idempotency entries that could block future retries
    const effectivePaymentId = payment_id || tempData.current_payment_id;
    if (effectivePaymentId) {
      try {
        const PaymentJournal = require("../models/paymentJournalModel").default;
        const { deleteRedisItem } = require("../services/redisService");
        const deletedCount = await PaymentJournal.destroy({
          where: {
            payment_id: effectivePaymentId,
            event: 'settlement_sent',
          },
        });
        const redisSettlementKey = `settlement-${effectivePaymentId}`;
        const redisClaimKey = `settlement-claim-${effectivePaymentId}`;
        await deleteRedisItem(redisSettlementKey).catch(() => {});
        await deleteRedisItem(redisClaimKey).catch(() => {});
        steps.push({ step: "clear_idempotency", status: "ok", details: {
          journal_entries_deleted: deletedCount,
          redis_keys_cleared: [redisSettlementKey, redisClaimKey],
        }});
      } catch (idempErr) {
        steps.push({ step: "clear_idempotency", status: "warning", details: String(idempErr) });
      }
    }

    // Step 10: Execute the transfer
    let contractAddress = "";
    if (currency === "USDT-TRC20") contractAddress = process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
    else if (currency === "USDT-ERC20") contractAddress = process.env.ETH_CONTRACT || "";
    else if (currency === "USDC-ERC20") contractAddress = process.env.USDC_CONTRACT || "";
    
    try {
      let fees: Record<string, number> = {};
      if (isTRC20) {
        const trc20Contract = currency === "USDT-TRC20"
          ? (process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")
          : undefined;
        // RECOVERY: Use null recipient to force NEW recipient energy (130k)
        const dynamicFee = await calculateDynamicTRC20Fee(tempAddress, null as any, trc20Contract);
        // Set feeLimit with 30% buffer for safety
        fees = { fast: Math.ceil(dynamicFee.fast * 1.3 * 100) / 100 };
      }

      let transferResult: { txId?: string; id?: string } | undefined;

      // FIX (2026-07-08): For ERC20/POLYGON tokens, tatumApi.assetToOtherAddress passes
      // an empty fee object which triggers a NaN.toString() crash and also uses the
      // deprecated Tatum SDK path (known "ghost TX" issues). Use directEvmSweep instead —
      // the same battle-tested EIP-1559 broadcaster that fundGasIfNeeded uses.
      if (isERC20Token) {
        const { directEvmSweep } = await import("../services/merchantPool/directEvmTransfer");
        const evmResult = await directEvmSweep({
          fromAddress: tempAddress,
          toAddress: destination!,
          privateKey: privateKey!,
          walletType: currency!,
          amount: merchantSendAmount,
        });
        transferResult = { txId: evmResult.txHash, id: evmResult.txHash };
        steps.push({ step: "erc20_direct_transfer", status: "ok", details: {
          txId: evmResult.txHash,
          gas_price_gwei: evmResult.gasPriceGwei,
          method: "directEvmSweep (ethers.js EIP-1559)",
        }});
      } else {
        transferResult = await tatumApi.assetToOtherAddress({
          currency,
          fromAddress: tempAddress,
          toAddress: destination!,
          privateKey,
          amount: merchantSendAmount,
          fee: fees,
          _contractAddress: contractAddress,
        });
      }
      
      const recoveryTxId = transferResult?.txId || transferResult?.id;
      
      // Mark recovery TX as outgoing to prevent webhook re-processing
      if (recoveryTxId) {
        await setRedisItem(`outgoing-tx-${recoveryTxId}`, {
          type: "settlement-recovery",
          fromAddress: tempAddress,
          toAddress: destination,
          amount: merchantSendAmount,
          currency,
          payment_id: payment_id || tempData.current_payment_id,
          markedAt: new Date().toISOString(),
        });
        await setRedisTTL(`outgoing-tx-${recoveryTxId}`, 7200);
      }
      
      // Verify the recovery TX for TRON — check BOTH confirmation AND contractResult
      let txVerified = false;
      if (isTRC20 && recoveryTxId) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const verifyResult = await tatumApi.waitForTransactionConfirmation(recoveryTxId, currency, 60000);
        
        // A TX can be "confirmed" (included in block) but still fail execution (OUT_OF_ENERGY)
        const contractOk = !verifyResult.contractResult || verifyResult.contractResult === "SUCCESS";
        txVerified = verifyResult.confirmed && contractOk;
        
        steps.push({ step: "verify_recovery_tx", status: txVerified ? "ok" : "failed", details: {
          tx_id: recoveryTxId,
          confirmed: verifyResult.confirmed,
          contractResult: verifyResult.contractResult || "N/A",
          block: verifyResult.blockNumber,
          tokens_moved: txVerified,
        }});

        if (!txVerified) {
          if (verifyResult.contractResult && verifyResult.contractResult !== "SUCCESS") {
            // TX was included in block but execution failed (e.g., OUT_OF_ENERGY)
            return res.status(500).json({
              status: "transfer_execution_failed",
              message: `Recovery TX ${recoveryTxId} FAILED: contractResult=${verifyResult.contractResult}. Tokens did NOT move. The temp address may need more TRX gas or energy.`,
              payment_id: payment_id || tempData.current_payment_id,
              tx_id: recoveryTxId,
              contractResult: verifyResult.contractResult,
              block: verifyResult.blockNumber,
              steps,
            });
          }
          // TX not yet confirmed (timeout) — report as pending
          return res.status(202).json({
            status: "transfer_pending",
            message: `Recovery TX ${recoveryTxId} broadcast but not yet confirmed. Check manually.`,
            payment_id: payment_id || tempData.current_payment_id,
            tx_id: recoveryTxId,
            steps,
          });
        }
      }
      
      // Update the temp address admin_fee_balance
      const adminFeeRemaining = tokenBalance - merchantSendAmount;
      if (adminFeeRemaining > 0) {
        try {
          await merchantTempAddressModel.update(
            { admin_fee_balance: adminFeeRemaining },
            { where: { wallet_address: tempAddress } }
          );
          steps.push({ step: "update_admin_balance", status: "ok", details: {
            new_admin_fee_balance: adminFeeRemaining,
          }});
        } catch (dbErr) {
          steps.push({ step: "update_admin_balance", status: "error", details: String(dbErr) });
        }
      }
      
      // Update pool transaction status if found
      if (poolTx) {
        try {
          await merchantPoolTransactionModel.update(
            { status: "merchant_sent", merchant_tx_id: recoveryTxId },
            { where: { pool_tx_id: poolTx.dataValues.pool_tx_id } }
          );
        } catch (_) { /* best effort */ }
      }
      
      steps.push({ step: "transfer", status: "ok", details: {
        tx_id: recoveryTxId,
        from: tempAddress,
        to: destination,
        amount: merchantSendAmount,
        currency,
        admin_fee_remaining: adminFeeRemaining,
        tx_verified: txVerified,
      }});

      return res.status(200).json({
        status: "recovered",
        message: `Successfully transferred ${merchantSendAmount} ${currency} from ${tempAddress} to ${destination}. Admin fee ${adminFeeRemaining} ${currency} remains for sweep.`,
        payment_id: payment_id || tempData.current_payment_id,
        tx_id: recoveryTxId,
        steps,
      });

    } catch (transferErr) {
      steps.push({ step: "transfer", status: "error", details: String(transferErr) });
      return res.status(500).json({
        status: "transfer_failed",
        message: `Transfer failed: ${String(transferErr)}. Gas was funded. The reconciliation cron should retry automatically.`,
        payment_id: payment_id || tempData.current_payment_id,
        steps,
      });
    }

  } catch (err) {
    return res.status(500).json({
      error: `Recovery failed: ${String(err)}`,
      payment_id,
      steps,
    });
  }
});

/**
 * POST /diagnostics/force-resolve-payment
 * Force-resolves a stuck payment by marking it as 'failed' or 'payout_complete' in the journal.
 * Use when auto-recovery has failed and manual intervention is needed.
 * 
 * Body: {
 *   payment_id: string (required),
 *   resolution: 'failed' | 'completed' (required),
 *   reason: string (optional — why the payment is being force-resolved),
 *   release_address: boolean (optional, default true — release the temp pool address)
 * }
 */
router.post("/force-resolve-payment", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  const { payment_id, resolution, reason, release_address = true } = req.body;

  if (!payment_id) {
    return res.status(400).json({ error: "payment_id is required" });
  }
  if (!resolution || !['failed', 'completed'].includes(resolution)) {
    return res.status(400).json({ error: "resolution must be 'failed' or 'completed'" });
  }

  const steps: { step: string; status: string; details?: unknown }[] = [];

  try {
    const PaymentJournal = require("../models/paymentJournalModel").default;
    const { Op } = require("sequelize");
    const { journalStateTransition } = require("../services/paymentReliability");
    const { setRedisItem, setRedisTTL, getRedisItem } = require("../utils/redisInstance");

    // Step 1: Verify the payment exists and is stuck
    const latestJournalEntry = await PaymentJournal.findOne({
      where: { payment_id },
      order: [['created_at', 'DESC']],
    });

    if (!latestJournalEntry) {
      return res.status(404).json({ error: "Payment not found in journal", payment_id });
    }

    const currentState = latestJournalEntry.to_state;
    steps.push({
      step: "verify_payment",
      status: "ok",
      details: {
        payment_id,
        current_state: currentState,
        address: latestJournalEntry.address,
        currency: latestJournalEntry.currency,
        company_id: latestJournalEntry.company_id,
      },
    });

    // Check if already in a terminal state
    const terminalStates = ['payout_complete', 'failed', 'expired', 'refunded'];
    const alreadyTerminal = await PaymentJournal.findOne({
      where: {
        payment_id,
        to_state: { [Op.in]: terminalStates },
      },
    });

    if (alreadyTerminal) {
      return res.status(400).json({
        error: `Payment already in terminal state: ${alreadyTerminal.to_state}`,
        payment_id,
        steps,
      });
    }

    // Step 2: Determine the target state
    const targetState = resolution === 'completed' ? 'payout_complete' : 'failed';

    // Step 3: Journal the force-resolution
    await journalStateTransition({
      paymentId: payment_id,
      txId: latestJournalEntry.tx_id,
      address: latestJournalEntry.address,
      currency: latestJournalEntry.currency,
      event: 'force_resolved',
      fromState: currentState,
      toState: targetState,
      amount: latestJournalEntry.amount,
      companyId: latestJournalEntry.company_id,
      metadata: {
        reason: reason || `Admin force-resolved as '${resolution}'`,
        resolved_by: 'admin',
        resolved_at: new Date().toISOString(),
      },
    });

    steps.push({ step: "journal_resolution", status: "ok", details: { targetState } });

    // Step 4: Update the watchdog recovery tracker
    const trackerKey = `watchdog-recovery:${payment_id}`;
    const existingTracker = await getRedisItem(trackerKey);
    await setRedisItem(trackerKey, {
      ...(existingTracker || {}),
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolvedAs: targetState,
      resolvedReason: reason || 'admin-force-resolve',
    });
    await setRedisTTL(trackerKey, 30 * 86400); // Keep for 30 days

    steps.push({ step: "update_tracker", status: "ok" });

    // Step 5: Update Redis payment status
    try {
      const cryptoKey = `crypto-${latestJournalEntry.address}`;
      const redisData = await getRedisItem(cryptoKey);
      if (redisData && typeof redisData === 'object') {
        const updatedData = { ...(redisData as Record<string, unknown>), status: resolution === 'completed' ? 'successful' : 'failed' };
        await setRedisItem(cryptoKey, updatedData);
        steps.push({ step: "update_redis_status", status: "ok" });
      } else {
        steps.push({ step: "update_redis_status", status: "skipped", details: "No Redis data found" });
      }
    } catch (redisErr) {
      steps.push({ step: "update_redis_status", status: "error", details: (redisErr as Error).message });
    }

    // Step 6: Release the pool address if requested
    if (release_address) {
      try {
        await merchantTempAddressModel.update(
          { status: 'AVAILABLE', current_payment_id: null },
          { where: { current_payment_id: payment_id } }
        );
        steps.push({ step: "release_address", status: "ok" });
      } catch (addrErr) {
        // Also try by address
        try {
          await merchantTempAddressModel.update(
            { status: 'AVAILABLE', current_payment_id: null },
            { where: { wallet_address: latestJournalEntry.address } }
          );
          steps.push({ step: "release_address", status: "ok", details: "by wallet_address" });
        } catch (addrErr2) {
          steps.push({ step: "release_address", status: "error", details: (addrErr2 as Error).message });
        }
      }
    }

    // Step 7: Update customer transaction if it exists
    try {
      const { customerTransactionModel } = require("../models");
      const txStatus = resolution === 'completed' ? 'successful' : 'failed';
      const [updatedCount] = await customerTransactionModel.update(
        { status: txStatus },
        { where: { unique_tx_id: payment_id } }
      );
      steps.push({
        step: "update_customer_transaction",
        status: updatedCount > 0 ? "ok" : "not_found",
        details: { updated: updatedCount, new_status: txStatus },
      });
    } catch (txErr) {
      steps.push({ step: "update_customer_transaction", status: "error", details: (txErr as Error).message });
    }

    cronLogger.info(
      `[ForceResolve] Payment ${payment_id} force-resolved as '${targetState}'. ` +
      `Reason: ${reason || 'admin action'}. Address: ${latestJournalEntry.address}`
    );

    return res.status(200).json({
      status: "resolved",
      message: `Payment ${payment_id} force-resolved as '${targetState}'.`,
      payment_id,
      resolution: targetState,
      steps,
    });
  } catch (err) {
    return res.status(500).json({
      error: `Force-resolve failed: ${(err as Error).message}`,
      payment_id,
      steps,
    });
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// RELIABILITY: Payment Journal & System Health Diagnostics
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/reliability/health", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const { watchdogCheck, checkQueueBackpressure } = require("../services/paymentReliability");
    const { getQueueHealth } = require("../services/webhookQueue");
    const { TatumCircuitBreaker } = require("../utils/circuitBreaker");

    const [watchdog, backpressure, queueHealth] = await Promise.all([
      watchdogCheck(),
      checkQueueBackpressure(),
      getQueueHealth(),
    ]);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      watchdog,
      queue: {
        ...queueHealth,
        backpressure: {
          accept: backpressure.accept,
          utilizationPercent: backpressure.utilizationPercent,
        },
      },
      circuitBreaker: {
        tatum: TatumCircuitBreaker.getStats(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/reliability/journal", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const PaymentJournal = require("../models/paymentJournalModel").default;
    const { Op } = require("sequelize");

    const paymentId = req.query.payment_id as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const event = req.query.event as string;

    const where: Record<string, unknown> = {};
    if (paymentId) where.payment_id = paymentId;
    if (event) where.event = event;

    const entries = await PaymentJournal.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
    });

    res.json({
      count: entries.length,
      entries: entries.map((e: any) => e.dataValues),
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /diagnostics/recover-excess-trx
 * One-time recovery: sweep excess TRX from over-funded pool addresses back to the fee wallet.
 * Caused by double SUN→TRX conversion bug (fixed 2026-03-25).
 * Keeps a configurable reserve per address for future gas needs.
 *
 * Body: { reserve_per_address?: number, dry_run?: boolean }
 *   - reserve_per_address: TRX to keep in each address (default: 2)
 *   - dry_run: if true, only report what WOULD be recovered (default: true)
 */
router.post("/recover-excess-trx", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const reservePerAddress = Number(req.body.reserve_per_address ?? 2);
    const dryRun = req.body.dry_run !== false; // default true for safety

    // Get TRX fee wallet address
    const { adminFeeModel } = await import("../models");
    const feeWallet = await adminFeeModel.findOne({ where: { wallet_type: "TRX" } });
    if (!feeWallet) {
      return res.status(404).json({ error: "TRX fee wallet not found in database" });
    }
    const feeWalletAddress = feeWallet.dataValues.wallet_address;

    // Find all USDT-TRC20 and TRX pool addresses
    const { Op } = await import("sequelize");
    const poolAddresses = await merchantTempAddressModel.findAll({
      where: {
        wallet_type: { [Op.in]: ["USDT-TRC20", "TRX"] },
      },
    });

    const results: Array<{
      address: string;
      wallet_type: string;
      balance_trx: number;
      reserve: number;
      recoverable: number;
      tx_id?: string;
      status: string;
    }> = [];

    let totalRecovered = 0;

    for (const addr of poolAddresses) {
      const walletAddress = addr.dataValues.wallet_address;
      try {
        // Get TRX balance — try Tatum first, fall back to TronGrid if stale/0
        let balanceTRX = 0;
        try {
          const balanceResult = await tatumApi.getAddressBalance(walletAddress, "TRX");
          balanceTRX = Number(balanceResult?.balance ?? 0);
        } catch (_e) { /* fall through to TronGrid */ }
        
        // TronGrid fallback: Tatum balance API can return stale/0 for TRON addresses
        if (balanceTRX <= 0) {
          try {
            const tronRes = await tatumHttp.get(
              `https://api.trongrid.io/v1/accounts/${walletAddress}`,
              { timeout: 8000 }
            );
            const acctData = tronRes.data?.data?.[0];
            if (acctData?.balance) {
              balanceTRX = acctData.balance / 1e6;
            }
          } catch (_tronErr) { /* use 0 */ }
        }

        if (balanceTRX <= reservePerAddress) {
          // Nothing to recover
          continue;
        }

        const recoverable = Math.floor((balanceTRX - reservePerAddress) * 1000000) / 1000000;

        if (recoverable <= 0.1) {
          continue; // Skip dust amounts
        }

        if (dryRun) {
          results.push({
            address: walletAddress,
            wallet_type: addr.dataValues.wallet_type,
            balance_trx: balanceTRX,
            reserve: reservePerAddress,
            recoverable,
            status: "DRY_RUN",
          });
          totalRecovered += recoverable;
        } else {
          // Actually send TRX back to fee wallet
          const privateKey = await tatumApi.decryptSymmetric(
            addr.dataValues.private_key,
            process.env.TEMP_KEY_ID
          );

          const txResult = await tatumApi.assetToOtherAddress({
            currency: "TRX",
            fromAddress: walletAddress,
            toAddress: feeWalletAddress,
            privateKey,
            amount: recoverable,
            fee: null,
          });

          results.push({
            address: walletAddress,
            wallet_type: addr.dataValues.wallet_type,
            balance_trx: balanceTRX,
            reserve: reservePerAddress,
            recoverable,
            tx_id: txResult?.txId,
            status: txResult?.txId ? "SENT" : "FAILED",
          });
          totalRecovered += recoverable;

          cronLogger.info(`[RecoverExcessTRX] Sent ${recoverable} TRX from ${walletAddress} → ${feeWalletAddress} (TX: ${txResult?.txId})`);

          // Mark as outgoing so reconciliation doesn't re-queue it as a missed customer payment
          if (txResult?.txId) {
            await setRedisItemWithTTL(`outgoing-tx-${txResult.txId}`, {
              type: "recover-excess-trx",
              from: walletAddress,
              to: feeWalletAddress,
              amount: recoverable,
              createdAt: new Date().toISOString(),
            }, 30 * 24 * 60 * 60); // 30-day TTL
          }

          // Small delay between transactions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      } catch (addrError) {
        const errMsg = (addrError as Error).message || String(addrError);
        // Skip addresses that don't exist on-chain
        if (errMsg.includes("account.not.found") || errMsg.includes("not.found")) {
          continue;
        }
        results.push({
          address: walletAddress,
          wallet_type: addr.dataValues.wallet_type,
          balance_trx: 0,
          reserve: reservePerAddress,
          recoverable: 0,
          status: `ERROR: ${errMsg.substring(0, 100)}`,
        });
      }
    }

    res.json({
      success: true,
      dry_run: dryRun,
      fee_wallet: feeWalletAddress,
      reserve_per_address: reservePerAddress,
      total_recovered_trx: totalRecovered,
      addresses_processed: results.length,
      results,
    });
  } catch (err) {
    cronLogger.error(`[RecoverExcessTRX] Failed: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
