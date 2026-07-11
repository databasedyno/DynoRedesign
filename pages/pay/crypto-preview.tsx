import React, { useState } from 'react'
import { Box } from '@mui/material'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import ProgressBar from '@/Components/UI/ProgressBar'
import CryptoTransfer from '@/Components/Page/Pay3Components/cryptoTransfer'

// TEMP QA preview — renders the real CryptoTransfer with mock props so the
// checkout styling can be verified without a live payment session.
const CryptoPreview = () => {
  const [step, setStep] = useState(1)
  return (
    <Pay3Layout>
      <Box>
        <ProgressBar activeStep={step} />
        <CryptoTransfer
          activeStep={step}
          setActiveStep={setStep as any}
          walletState={{ amount: 100, currency: 'USD' }}
          feePayer={'merchant'}
          redirectUrl={null}
          taxInfo={null}
          feeInfo={{ processing_fee: 0, fee_payer: 'merchant' }}
          merchantInfo={{ name: 'Acme Store', company_logo: null }}
          displayCurrency={'USD'}
          transferRate={1}
          email={'demo@dynopay.com'}
          transactionId={'PREVIEW123'}
          customerName={'Ava'}
        />
      </Box>
    </Pay3Layout>
  )
}

export default CryptoPreview
