import React, { useState } from 'react'
import Head from 'next/head'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import Pay3Layout from '@/Components/Layout/Pay3Layout'
import DonationCampaign, { DonationCampaignData } from '@/Components/Page/Pay3Components/donationCampaign'

const COVER =
  'https://images.unsplash.com/photo-1591522810850-58128c5fb089?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjaGFyaXR5JTIwZG9uYXRpb24lMjBhYnN0cmFjdHxlbnwwfHx8fDE3ODM3OTQyMDR8MA&ixlib=rb-4.1.0&q=85'

const OG_BASE = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SERVER_URL || '').replace(/\/+$/, '')
const OG_IMAGE = `${OG_BASE}/api/pay/og-image?demo=1`

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
  ends_at: new Date(Date.now() + 5 * 86400000 + 3 * 3600000).toISOString(),
  recent_supporters: SUPPORTERS,
}

const scenarios: Record<string, DonationCampaignData> = {
  campaign: base,
  endingSoon: { ...base, ends_at: new Date(Date.now() + 8 * 3600000).toISOString(), raised_amount: 22800, progress_percent: 91 },
  noGoal: { ...base, goal_amount: null, progress_percent: null, title: 'Tip jar — buy the team a coffee', campaign_image: null },
  closed: { ...base, campaign_closed: true, closed_reason: 'goal_reached', raised_amount: 25400, progress_percent: 100, ends_at: null },
}

const DonationDemo = () => {
  const [key, setKey] = useState<'campaign' | 'endingSoon' | 'noGoal' | 'closed'>('campaign')

  return (
    <>
      <Head>
        <title>Donation checkout demo · Dynopay</title>
        <meta name="description" content="A live crypto donation & crowdfunding checkout — goal bar, reward tiers and donor wall." />
        <meta key="og:title" property="og:title" content="Help rebuild the Riverside Community Library" />
        <meta key="og:description" property="og:description" content="$16,240 raised of $25,000 goal — 65% funded. Fundraise or take tips in crypto with Dynopay." />
        <meta key="og:image" property="og:image" content={OG_IMAGE} />
        <meta key="og:image:width" property="og:image:width" content="1200" />
        <meta key="og:image:height" property="og:image:height" content="630" />
        <meta key="twitter:card" name="twitter:card" content="summary_large_image" />
        <meta key="twitter:image" name="twitter:image" content={OG_IMAGE} />
      </Head>
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
          <ToggleButton value='endingSoon' data-testid='demo-scenario-endingsoon'>Ending soon</ToggleButton>
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
    </>
  )
}

export default DonationDemo
