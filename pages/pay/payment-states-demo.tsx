import React, { useState } from 'react'
import { Box, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material'
import OverPayment from '@/Components/UI/OverPayment/Index'
import UnderPayment from '@/Components/UI/UnderPayment/Index'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import { useTranslation } from 'react-i18next'

type DemoState = 
  | 'overpay-redirect-email' 
  | 'overpay-redirect-only' 
  | 'overpay-email-only' 
  | 'overpay-done-only'
  | 'underpayment'

const PaymentStatesDemo = () => {
  const { t } = useTranslation('common')
  const [currentState, setCurrentState] = useState<DemoState>('overpay-redirect-email')

  const handleStateChange = (
    event: React.MouseEvent<HTMLElement>,
    newState: DemoState | null
  ) => {
    if (newState) {
      setCurrentState(newState)
    }
  }

  // Mock handlers
  const handlePayRemaining = (method: "bank" | "crypto") => {
    console.log('Pay remaining with:', method)
  }

  const handleGoToWebsite = () => {
    console.log('Go to website clicked')
  }

  // Overpayment scenarios
  const overpaymentScenarios = {
    'overpay-redirect-email': {
      redirectUrl: 'https://acme-store.com/order/complete',
      merchantName: 'Acme Store',
      email: 'john@email.com'
    },
    'overpay-redirect-only': {
      redirectUrl: 'https://acme-store.com/order/complete',
      merchantName: 'Acme Store',
      email: undefined
    },
    'overpay-email-only': {
      redirectUrl: undefined,
      merchantName: undefined,
      email: 'john@email.com'
    },
    'overpay-done-only': {
      redirectUrl: undefined,
      merchantName: undefined,
      email: undefined
    }
  }

  const isOverpayment = currentState.startsWith('overpay')
  const overpayScenario = isOverpayment ? overpaymentScenarios[currentState as keyof typeof overpaymentScenarios] : null

  return (
    <Pay3Layout>
      <Box sx={{ p: 2, maxWidth: 600, mx: 'auto' }}>
        {/* Scenario Selector */}
        <Box 
          sx={{ 
            mb: 3, 
            p: 2, 
            bgcolor: 'background.paper', 
            borderRadius: 2,
            boxShadow: 1
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
            Demo State:
          </Typography>
          <ToggleButtonGroup
            value={currentState}
            exclusive
            onChange={handleStateChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            <ToggleButton value="overpay-redirect-email" sx={{ textTransform: 'none', fontSize: 12 }}>
              Overpay: Redirect + Email
            </ToggleButton>
            <ToggleButton value="overpay-redirect-only" sx={{ textTransform: 'none', fontSize: 12 }}>
              Overpay: Redirect Only
            </ToggleButton>
            <ToggleButton value="overpay-email-only" sx={{ textTransform: 'none', fontSize: 12 }}>
              Overpay: Email Only
            </ToggleButton>
            <ToggleButton value="overpay-done-only" sx={{ textTransform: 'none', fontSize: 12 }}>
              Overpay: Done Only
            </ToggleButton>
            <ToggleButton value="underpayment" sx={{ textTransform: 'none', fontSize: 12 }}>
              Underpayment
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Render Overpayment Component */}
        {isOverpayment && overpayScenario && (
          <OverPayment
            key={currentState}
            paidAmount={0.00825}
            expectedAmount={0.00758}
            excessAmount={0.00067}
            currency="ETH"
            onGoToWebsite={handleGoToWebsite}
            transactionId="TXN-2026-DEMO123"
            paidAmountUsd={18.50}
            expectedAmountUsd={17.00}
            excessAmountUsd={1.50}
            baseCurrency="USD"
            displayCurrency="GBP"
            transferRate={0.79}
            redirectUrl={overpayScenario.redirectUrl}
            merchantName={overpayScenario.merchantName}
            email={overpayScenario.email}
          />
        )}

        {/* Render Underpayment Component */}
        {currentState === 'underpayment' && (
          <UnderPayment
            paidAmount={0.00450}
            expectedAmount={0.00758}
            remainingAmount={0.00308}
            currency="ETH"
            onPayRemaining={handlePayRemaining}
            transactionId="TXN-2026-DEMO456"
            paidAmountUsd={10.00}
            expectedAmountUsd={17.00}
            remainingAmountUsd={7.00}
            baseCurrency="USD"
            graceMinutes={15}
            displayCurrency="GBP"
            transferRate={0.79}
          />
        )}
      </Box>
    </Pay3Layout>
  )
}

export default PaymentStatesDemo
