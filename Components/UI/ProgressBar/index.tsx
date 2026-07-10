'use client'

import {
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  Box,
  Typography,
  useTheme
} from '@mui/material'
import { styled } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'

const CustomConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 11,
    left: 'calc(-50% + 14px)',
    right: 'calc(50% + 14px)',
  },
  [`& .${stepConnectorClasses.line}`]: {
    height: 2,
    border: 0,
    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.14)' : '#E0E4ED',
    borderRadius: 1,
    transition: 'background-color 0.4s ease',
  },
  [`&.${stepConnectorClasses.active} .${stepConnectorClasses.line}`]: {
    background: theme.palette.primary.main,
  },
  [`&.${stepConnectorClasses.completed} .${stepConnectorClasses.line}`]: {
    background: theme.palette.primary.main,
  },
}))

const StepIconRoot = styled('div')<{
  ownerState: { completed: boolean; active: boolean }
}>(({ theme, ownerState }) => ({
  backgroundColor: ownerState.completed
    ? theme.palette.primary.main
    : ownerState.active
      ? (theme.palette.mode === 'dark' ? '#111113' : '#fff')
      : theme.palette.mode === 'dark' ? '#111113' : '#fff',
  zIndex: 1,
  color: ownerState.completed ? theme.palette.primary.contrastText : theme.palette.primary.main,
  width: 24,
  height: 24,
  display: 'flex',
  border: `2px solid ${
    ownerState.active || ownerState.completed ? theme.palette.primary.main : theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.22)' : '#D0D5E0'
  }`,
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  transition: 'all 0.3s ease',
  boxShadow: ownerState.active
    ? (theme.palette.mode === 'dark' ? '0 0 0 4px rgba(204,255,0,0.18)' : '0 0 0 4px rgba(10,10,10,0.12)')
    : 'none',
}))

function StepIconComponent(props: any) {
  const { active, completed } = props
  const theme = useTheme()

  return (
    <StepIconRoot ownerState={{ completed, active }}>
      {completed ? (
        <CheckIcon style={{ fontSize: 14, color: theme.palette.primary.contrastText }} />
      ) : (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: active ? theme.palette.primary.main : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.3)' : '#CBD5E1'),
            transition: 'all 0.3s ease',
          }}
        />
      )}
    </StepIconRoot>
  )
}

const steps = ['Order', 'Payment', 'Done']

export default function ProgressBar({ activeStep }: { activeStep: number }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  return (
    <Box sx={{ width: '100%', maxWidth: 360, mx: 'auto', px: 2, pt: 1.5, pb: 0.5 }}>
      <Stepper
        alternativeLabel
        activeStep={activeStep}
        connector={<CustomConnector />}
      >
        {steps.map((label, idx) => (
          <Step key={label}>
            <StepLabel
              StepIconComponent={StepIconComponent}
              sx={{
                '& .MuiStepLabel-label': {
                  fontSize: '11px',
                  fontWeight: idx <= activeStep ? 700 : 500,
                  color: idx <= activeStep
                    ? (isDark ? '#fff' : '#242428')
                    : (isDark ? '#666' : '#9CA3AF'),
                  mt: '4px !important',
                  fontFamily: 'var(--font-tech), monospace',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  transition: 'all 0.3s ease',
                },
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}
