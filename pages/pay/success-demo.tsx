import React, { useState } from 'react'
import { Box, Button, Typography, ToggleButton, ToggleButtonGroup } from '@mui/material'
import TransferExpectedCard from '@/Components/UI/TransferExpectedCard/Index'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import { useTranslation } from 'react-i18next'

// Demo scenarios - Crypto payments with crypto + fiat display
const scenarios = {
  // Crypto: With redirect + with email
  redirectWithEmail: {
    isTrue: true,
    type: 'crypto',
    redirectUrl: 'https://acme-store.com/order/complete',
    transactionId: 'TXN-2026-A1B2C3',
    merchantName: 'Acme Store',
    amount: '0.004376 ETH (≈ 52.50 BRL)',
    email: 'john@email.com'
  },
  // Crypto: With redirect + no email
  redirectNoEmail: {
    isTrue: true,
    type: 'crypto',
    redirectUrl: 'https://acme-store.com/order/complete',
    transactionId: 'TXN-2026-A1B2C3',
    merchantName: 'Acme Store',
    amount: '0.004376 ETH (≈ 52.50 BRL)',
    email: ''
  },
  // Crypto: No redirect + with email
  noRedirectWithEmail: {
    isTrue: true,
    type: 'crypto',
    redirectUrl: null,
    transactionId: 'TXN-2026-A1B2C3',
    merchantName: 'Acme Store',
    amount: '0.004376 ETH (≈ 52.50 BRL)',
    email: 'john@email.com'
  },
  // Crypto: No redirect + no email
  noRedirectNoEmail: {
    isTrue: true,
    type: 'crypto',
    redirectUrl: null,
    transactionId: 'TXN-2026-A1B2C3',
    merchantName: 'Acme Store',
    amount: '0.004376 ETH (≈ 52.50 BRL)',
    email: ''
  },
  // Pending state (Bank transfer only)
  bankPending: {
    isTrue: false,
    type: 'bank',
    redirectUrl: null,
    transactionId: 'TXN-2026-A1B2C3',
    merchantName: '',
    amount: '',
    email: ''
  }
}

type ScenarioKey = keyof typeof scenarios

const SuccessDemo = () => {
  const { t } = useTranslation('common')
  const [currentScenario, setCurrentScenario] = useState<ScenarioKey>('noRedirectWithEmail')

  const handleScenarioChange = (
    event: React.MouseEvent<HTMLElement>,
    newScenario: ScenarioKey | null
  ) => {
    if (newScenario) {
      setCurrentScenario(newScenario)
    }
  }

  const scenario = scenarios[currentScenario]

  return (
    <Pay3Layout>
      <Box>
        {/* Scenario Selector */}
        <Box 
          sx={{ 
            position: 'fixed', 
            top: 80, 
            left: '50%', 
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'rgba(255,255,255,0.95)',
            borderRadius: 2,
            p: 2,
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
          }}
        >
          <Typography variant="caption" display="block" mb={1} fontWeight={600}>
            Demo Scenario:
          </Typography>
          <ToggleButtonGroup
            value={currentScenario}
            exclusive
            onChange={handleScenarioChange}
            size="small"
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            <ToggleButton value="redirectWithEmail" sx={{ fontSize: 11, px: 1.5 }}>
              Redirect + Email
            </ToggleButton>
            <ToggleButton value="redirectNoEmail" sx={{ fontSize: 11, px: 1.5 }}>
              Redirect Only
            </ToggleButton>
            <ToggleButton value="noRedirectWithEmail" sx={{ fontSize: 11, px: 1.5 }}>
              Email Only
            </ToggleButton>
            <ToggleButton value="noRedirectNoEmail" sx={{ fontSize: 11, px: 1.5 }}>
              No Redirect/Email
            </ToggleButton>
            <ToggleButton value="bankPending" sx={{ fontSize: 11, px: 1.5 }}>
              Bank Pending
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Card Display */}
        <Box pt={12}>
          <TransferExpectedCard
            key={currentScenario} // Force re-render on scenario change
            isTrue={scenario.isTrue}
            dataUrl=""
            type={scenario.type}
            redirectUrl={scenario.redirectUrl}
            transactionId={scenario.transactionId}
            merchantName={scenario.merchantName}
            amount={scenario.amount}
            email={scenario.email}
          />
        </Box>
      </Box>
    </Pay3Layout>
  )
}

export default SuccessDemo
