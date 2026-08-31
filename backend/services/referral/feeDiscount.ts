import User from '../../models/userModels/userModel';

/**
 * Get user's current fee discount
 * Returns discount percentage if valid, 0 if no discount or expired
 */
export const getUserFeeDiscount = async (userId: number): Promise<{
  discountPercent: number;
  reason: string | null;
  expiresAt: Date | null;
}> => {
  const user = await User.findByPk(userId, {
    attributes: ['fee_discount_percent', 'fee_discount_expires_at', 'fee_discount_reason'],
  });

  if (!user) {
    return { discountPercent: 0, reason: null, expiresAt: null };
  }

  const discountPercent = (user as { fee_discount_percent?: number }).fee_discount_percent || 0;
  const expiresAt = (user as { fee_discount_expires_at?: Date }).fee_discount_expires_at;
  const reason = (user as { fee_discount_reason?: string }).fee_discount_reason;

  // Check if discount has expired
  if (!expiresAt || new Date() > expiresAt) {
    // Clear expired discount
    await User.update(
      {
        fee_discount_percent: 0,
        fee_discount_expires_at: null,
        fee_discount_reason: null,
      },
      { where: { user_id: userId } }
    );
    return { discountPercent: 0, reason: null, expiresAt: null };
  }

  return { discountPercent, reason, expiresAt };
};

/**
 * Calculate discounted fee
 */
export const calculateDiscountedFee = (originalFee: number, discountPercent: number): number => {
  if (discountPercent <= 0) return originalFee;
  const discount = (originalFee * discountPercent) / 100;
  return Math.max(0, originalFee - discount);
};
