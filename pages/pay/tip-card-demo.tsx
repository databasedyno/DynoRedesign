import React, { useState } from 'react'
import { Box, TextField, Typography } from '@mui/material'
import TipThankYouCard from '@/Components/Page/Creator/TipThankYouCard'

/** QA demo for the shareable "I supported {creator}" card (no real tip needed). */
const TipCardDemo = () => {
  const [name, setName] = useState('The Dev Store')
  const [amount, setAmount] = useState('$25.00')
  const [message, setMessage] = useState('Thanks for the amazing tutorials — keep going!')
  const [accent, setAccent] = useState('#4F46E5')
  return (
    <Box sx={{ maxWidth: 420, mx: 'auto', p: 3 }} data-testid="tip-card-demo">
      <Typography sx={{ fontWeight: 800, fontSize: 18, mb: 2 }}>Tip thank-you card — demo</Typography>
      <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
        <TextField size="small" label="Creator" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ 'data-testid': 'demo-name' }} />
        <TextField size="small" label="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ 'data-testid': 'demo-amount' }} />
        <TextField size="small" label="Message" value={message} onChange={(e) => setMessage(e.target.value)} inputProps={{ 'data-testid': 'demo-message' }} />
        <TextField size="small" label="Accent" value={accent} onChange={(e) => setAccent(e.target.value)} inputProps={{ 'data-testid': 'demo-accent' }} />
      </Box>
      <TipThankYouCard
        creatorName={name}
        handle="devhub"
        avatarUrl={null}
        accent={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent) ? accent : '#4F46E5'}
        amountLabel={amount}
        message={message}
        pageUrl="https://dynopay.com/devhub"
      />
    </Box>
  )
}

export default TipCardDemo
