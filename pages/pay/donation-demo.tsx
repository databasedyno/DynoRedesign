import React, { useState } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import DonationCampaign, { DonationCampaignData } from '@/Components/Page/Pay3Components/donationCampaign'

const COVER =
  'https://images.unsplash.com/photo-1591522810850-58128c5fb089?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjaGFyaXR5JTIwZG9uYXRpb24lMjBhYnN0cmFjdHxlbnwwfHx8fDE3ODM3OTQyMDR8MA&ixlib=rb-4.1.0&q=85'

const SUPPORTERS = [
  { name: 'Amara Okafor', message: 'Rooting for you all the way! 💪', amount: 250, currency: 'USD', at: new Date(Date.now() - 130 * 1000).toISOString() },
  { name: 'Lukas Meyer', message: null, amount: 100, currency: 'USD', at: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
  { name: null, message: 'Anonymous but happy to help.', amount: 50, currency: 'USD', at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
  { name: 'Priya Nair', message: 'Such an important cause — sharing with friends.', amount: 500, currency: 'USD', at: new Date(Date.now() - 26 * 3600 * 1000).toISOString() },
  { name: 'Diego Santos', message: null, amount: 75, currency: 'USD', at: new Date(Date.now() - 2 * 86400 * 1000).toISOString() },
]

const base: DonationCampaignData = {
  title: 'Help rebuild the Riverside Community Library',
  purpose:
    'After the floods, our beloved library needs new shelving, books and equipment. Every contribution — in crypto, from anywhere — goes straight to rebuilding a place where our kids learn and grow.',
  campaign_image: COVER,
  currency: 'USD',
  goal_amount: 25000,
  raised_amount: 16240,
  supporters_count: 213,
  progress_percent: 65,
  min_amount: 5,
  preset_amounts: [25, 50, 100],
  allow_custom_amount: true,
  show_progress: true,
  show_supporters: true,
  campaign_closed: false,
  closed_reason: null,
  recent_supporters: SUPPORTERS,
}

const scenarios: Record<string, DonationCampaignData> = {
  campaign: base,
  noGoal: { ...base, goal_amount: null, progress_percent: null, title: 'Tip jar — buy the team a coffee', campaign_image: null },
  closed: { ...base, campaign_closed: true, closed_reason: 'goal_reached', raised_amount: 25400, progress_percent: 100 },
}

const DonationDemo = () => {
  const [key, setKey] = useState<'campaign' | 'noGoal' | 'closed'>('campaign')

  return (
    <Pay3Layout>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Donation checkout — preview
        </Typography>
        <ToggleButtonGroup
          size='small'
          exclusive
          value={key}
          onChange={(_, v) => v && setKey(v)}
          data-testid='donation-demo-toggle'
        >
          <ToggleButton value='campaign' data-testid='demo-scenario-campaign'>Crowdfunding (goal)</ToggleButton>
          <ToggleButton value='noGoal' data-testid='demo-scenario-nogoal'>Tip jar (no goal)</ToggleButton>
          <ToggleButton value='closed' data-testid='demo-scenario-closed'>Goal reached</ToggleButton>
        </ToggleButtonGroup>

        <DonationCampaign
          donation={scenarios[key]}
          merchant={{ name: 'Riverside Community', company_logo: null }}
          submitting={false}
          onDonate={() => {}}
        />
      </Box>
    </Pay3Layout>
  )
}

export default DonationDemo
