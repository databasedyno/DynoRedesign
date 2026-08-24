/**
 * confirmPayment — settles a card-mode payment link + credits the merchant wallet.
 *
 * Extracted from cryptoCheckout.ts (2026-08-23n) so the parent file stays
 * under its file-size baseline. Behaviour is byte-for-byte unchanged;
 * cryptoCheckout.ts re-imports and re-exports this handler under the same name.
 */
import { raw as envRaw } from "../../utils/config";
import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";
import sequelize from "../../utils/dbInstance";
import { errorResponseHelper, getErrorMessage, sendAdminFeeReceivedEmail, successResponseHelper } from "../../helper";
import { apiLogger, cronLogger, webhookLogs } from "../../utils/loggers";
import { getRedisItem, setRedisItemWithTTL, softDeleteRedisItem } from "../../utils/redisInstance";
import { PAYMENT_TIMING } from "./paymentConfig";
import { companyModel, customerTransactionModel, customerWalletModel, paymentLinkModel, userTransactionModel, userWalletModel } from "../../models";
import { IUserType, IVerifyResponse } from "../../utils/types";
import { paymentTypes } from "../../utils/enums";
import flw from "../../apis/flutterwaveApi";
import { checkKycEnforcement } from "../../helper/kycEnforcement";
import { incrementAdminFee } from "../../helper/walletHelpers";
import { autoGenerateInvoice } from "../invoiceController";
import { getTransactionFee, getBlockchainFee } from "../../services/feeService";
import { normalizeLang } from "../../utils/emailI18n";

const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    cronLogger.info(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData?.pathType === "createLink") {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        cronLogger.info(data);

        const linkData = (
          await paymentLinkModel.findOne({
            where: { transaction_id: tempData?.transaction_id },
          })
        ).dataValues;

        // Multi-tenant fix: Include company_id in wallet lookup
        const walletWhereClause: Record<string, unknown> = {
          user_id: Number(linkData.user_id),
          wallet_type: data.currency,
        };
        
        // Add company_id filter if present
        if (linkData.company_id && linkData.company_id !== '' && linkData.company_id !== 'undefined' && linkData.company_id !== 'null') {
          const companyId = parseInt(linkData.company_id);
          if (!isNaN(companyId)) {
            walletWhereClause.company_id = companyId;
          }
        } else {
          walletWhereClause.company_id = null;
        }
        
        const walletData = await userWalletModel.findOne({
          where: walletWhereClause,
          transaction,
        });

        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        await incrementAdminFee(data.currency, platformCharge + blockchainCharge);

        // Send admin fee notification email for card payments
        try {
          const adminEmail = envRaw("ADMIN_EMAIL");
          const totalFee = platformCharge + blockchainCharge;
          if (adminEmail && totalFee > 0) {
            const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
            await sendAdminFeeReceivedEmail(
              adminEmail,
              "Dynopay Admin",
              totalFee.toFixed(2),
              data.currency,
              (data as { transaction_id?: string }).transaction_id || String(data.id),
              linkData?.company_name || "Unknown Company",
              merchantAmount.toFixed(2),
              data.amount_settled.toFixed(2)
            );
            
            cronLogger.info(`[Admin Fee Notification - Card] Sent email for ${totalFee} ${data.currency} from Company ${linkData?.company_id || 'N/A'}`);
          }
        } catch (emailError) {
          cronLogger.error("[Admin Fee Notification - Card] Email failed:", emailError);
        }

        await userWalletModel.update(
          {
            amount: Number(
              walletData.dataValues.amount +
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
          },
          {
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          }
        );

        await paymentLinkModel.update(
          {
            paid_currency: data.currency,
            paid_amount: data.amount,
            status: data.status,
            wallet_id: walletData.dataValues.wallet_id,
            transaction_reference: data.flw_ref,
            payment_mode: tempData.mode,
          },
          {
            where: {
              transaction_id: tempData?.transaction_id,
            },
          }
        );

        // Increment times_used counter
        await paymentLinkModel.increment('times_used', {
          by: 1,
          where: {
            transaction_id: tempData?.transaction_id,
          },
        });

        transaction.commit();
        
        // Use stored redirect_url or callback_url if available
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
          redirect: false,
          ...(linkData.redirect_url && { redirect_url: linkData.redirect_url }),
          ...(linkData.callback_url && { callback_url: linkData.callback_url }),
        };
        
        // Call webhook if webhook_url is configured
        if (linkData.webhook_url) {
          // Validate webhook URL - localhost URLs won't work from cloud server
          if (linkData.webhook_url.includes('localhost') || linkData.webhook_url.includes('127.0.0.1')) {
            webhookLogs.error("Payment link webhook uses localhost URL which is unreachable", { 
              webhook_url: linkData.webhook_url,
              suggestion: "Use a public URL for webhooks"
            });
          } else {
            try {
              await axios.post(linkData.webhook_url, returnData, { timeout: 30000 });
              webhookLogs.log("info", "Payment link webhook sent successfully!", {
                webhook_url: linkData.webhook_url,
                ...returnData,
              });
            } catch (webhookError) {
              const errorMsg = webhookError.code === 'ECONNREFUSED' 
                ? `Connection refused - server at ${linkData.webhook_url} is not reachable`
                : webhookError.message;
              webhookLogs.error("Payment link webhook failed", { 
                webhook_url: linkData.webhook_url,
                error: errorMsg
              });
            }
          }
        }
        
        // FIXED: Use soft delete with TTL for checkout status polling
        await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // Grace period TTL
        successResponseHelper(res, 200, "Payment confirmed successfully", returnData);
      } else {
        const company_data = (
          await companyModel.findOne({
            where: { company_id: tempData.company_id },
          })
        ).dataValues;

        let product_name;

        if (tempData?.meta_data) {
          const meta_data = JSON.parse(tempData?.meta_data);
          product_name = meta_data?.product_name ?? meta_data?.product;
        }

        if (tempData.mode !== paymentTypes.WALLET) {
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          cronLogger.info(data);

          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: data.amount.toFixed(2),
            paid_currency: data.currency,
            transaction_reference: data.flw_ref,
            unique_tx_id: tempData.payment_id || tempData.unique_tx_id || tempData.id,
            transaction_type: tempData?.pathType?.includes("addFund")
              ? "CREDIT"
              : "PAYMENT",
            language: normalizeLang(tempData?.language),
            ...(!tempData?.pathType?.includes("addFund") && {
              transaction_details: product_name
                ? "Made payment for " +
                product_name +
                " on " +
                company_data?.company_name
                : "Made payment for " +
                (company_data?.company_name || "Company") +
                " product",
            }),
            status: data.status,
          };

          // Multi-tenant fix: Include company_id in wallet lookup
          const createPaymentWalletWhere: Record<string, unknown> = {
            user_id: Number(tempData.adm_id),
            wallet_type: data.currency,
          };
          
          // Add company_id filter if present
          if (tempData.company_id && tempData.company_id !== '' && tempData.company_id !== 'undefined' && tempData.company_id !== 'null') {
            const companyId = parseInt(tempData.company_id);
            if (!isNaN(companyId)) {
              createPaymentWalletWhere.company_id = companyId;
            }
          } else {
            createPaymentWalletWhere.company_id = null;
          }
          
          const walletData = await userWalletModel.findOne({
            where: createPaymentWalletWhere,
            transaction,
          });

          const transaction_fee = await getTransactionFee();
          const blockchain_fee = await getBlockchainFee();
          const platformCharge = (data.amount * Number(transaction_fee)) / 100;
          const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

          await incrementAdminFee(data.currency, platformCharge + blockchainCharge);

          // Send admin fee notification email for create payment
          try {
            const adminEmail = envRaw("ADMIN_EMAIL");
            const totalFee = platformCharge + blockchainCharge;
            if (adminEmail && totalFee > 0) {
              const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
              const companyData = await companyModel.findOne({
                where: { company_id: tempData.company_id },
              });
              
              await sendAdminFeeReceivedEmail(
                adminEmail,
                "Dynopay Admin",
                totalFee.toFixed(2),
                data.currency,
                (data as { transaction_id?: string }).transaction_id || String(data.id),
                companyData?.dataValues?.company_name || "Unknown Company",
                merchantAmount.toFixed(2),
                data.amount_settled.toFixed(2)
              );
              
              cronLogger.info(`[Admin Fee Notification - CreatePayment] Sent email for ${totalFee} ${data.currency} from Company ${tempData.company_id || 'N/A'}`);
            }
          } catch (emailError) {
            cronLogger.error("[Admin Fee Notification - CreatePayment] Email failed:", emailError);
          }

          const customerWalletData = await customerWalletModel.findOne({
            where: {
              customer_id: Number(tempData.customer_id),
            },
          });

          await userWalletModel.update(
            {
              amount: Number(
                walletData.dataValues.amount +
                data.amount_settled -
                platformCharge -
                blockchainCharge
              ).toFixed(2),
            },
            {
              where: {
                wallet_id: walletData.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const userPayload = {
            id: uniqueRef,
            wallet_id: walletData.dataValues.wallet_id,
            user_id: walletData.dataValues.user_id,
            payment_mode: tempData.mode,
            base_amount: (
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
            base_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: "CREDIT",
            status: data.status,
            customer_id: Number(tempData.customer_id),
            company_id: tempData.company_id || null,  // Include company_id from Redis
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );
          await userTransactionModel.create(
            { ...userPayload },
            { transaction }
          );
          if (tempData?.pathType?.includes("addFund")) {
            await customerWalletModel.update(
              {
                amount: Number(
                  customerWalletData.dataValues.amount + Number(tempData.amount)
                ).toFixed(2),
              },
              {
                where: {
                  customer_id: Number(tempData.customer_id),
                },
                transaction,
              }
            );
          }
          transaction.commit();

          // Auto-generate invoice for completed transaction
          if (tempData.company_id && userPayload.id) {
            autoGenerateInvoice(
              Number(userPayload.id),
              Number(tempData.company_id)
            ).catch(err => {
              cronLogger.error("Failed to generate invoice:", err);
            });
          }

          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        } else {
          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: Number(tempData.paid_amount).toFixed(2),
            paid_currency: tempData.paid_currency,
            transaction_reference: tempData.id,
            unique_tx_id: tempData.payment_id || tempData.unique_tx_id || tempData.id,
            transaction_type: "DEBIT",
            language: normalizeLang(tempData?.language),
            transaction_details: product_name
              ? "Made payment for " +
              product_name +
              " on " +
              company_data?.company_name
              : "Made payment for " +
              (company_data?.company_name || "Company") +
              " product",

            status: tempData.status,
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );

          transaction.commit();
          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        }
      }
    } else {
      transaction.rollback();
      errorResponseHelper(
        res,
        500,
        "Transaction Not found! Please contact support"
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

export { confirmPayment };
