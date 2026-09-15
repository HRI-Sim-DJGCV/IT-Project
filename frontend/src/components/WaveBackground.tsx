import Box from '@mui/material/Box'
import { alpha } from '@mui/material/styles'

{/*
gradient background compo 
dark mode NOT implemented
*/}
export function WaveBackground() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        bgcolor: (theme) =>
          // remove ternary cond after dark mode implementation
          theme.palette.mode === 'light'
            ? '#EEF5FE'
            : theme.palette.primary.dark,
        zIndex: 0,
        pointerEvents: 'none',
        '@keyframes waterRipple1': {
          '0%, 100%': {
            transform: 'translate(0, 0) scale(1)',
          },
          '50%': {
            transform: 'translate(-2%, -14px) scale(1.02, 1.05)',
          },
        },
        '@keyframes waterRipple2': {
          '0%, 100%': {
            transform: 'translate(0, 0) scale(1)',
          },
          '50%': {
            transform: 'translate(2%, -18px) scale(1.03, 1.04)',
          },
        },
      }}
    >
      {/* Layer 1 */}
      <Box
        sx={{
          position: 'absolute',
          top: '36%',
          left: '-25%',
          width: '150%',
          height: '80%',
          borderRadius: '50% 50% 0 0 / 22% 22% 0 0',
          transformOrigin: '50% 100%',
          animation: 'waterRipple1 9s ease-in-out infinite',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.dark, 0.35)
              : '#DBECFC',
        }}
      />

      {/* Layer 2 */}
      <Box
        sx={{
          position: 'absolute',
          top: '49%',
          left: '-30%',
          width: '160%',
          height: '70%',
          borderRadius: '50% 50% 0 0 / 24% 24% 0 0',
          transformOrigin: '50% 100%',
          animation: 'waterRipple2 7.5s ease-in-out infinite',
          animationDelay: '-2s',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.main, 0.45)
              : '#C5DEFA',
        }}
      />

      {/* Layer 3 */}
      <Box
        sx={{
          position: 'absolute',
          top: '63%',
          left: '-20%',
          width: '140%',
          height: '60%',
          borderRadius: '50% 50% 0 0 / 26% 26% 0 0',
          transformOrigin: '50% 100%',
          animation: 'waterRipple1 8s ease-in-out infinite',
          animationDelay: '-4s',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.light, 0.4)
              : '#AFD1F6',
        }}
      />

      {/* Layer 4 */}
      <Box
        sx={{
          position: 'absolute',
          top: '78%',
          left: '-15%',
          width: '130%',
          height: '50%',
          borderRadius: '50% 50% 0 0 / 28% 28% 0 0',
          transformOrigin: '50% 100%',
          animation: 'waterRipple2 6.5s ease-in-out infinite',
          animationDelay: '-1.5s',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? alpha(theme.palette.primary.light, 0.55)
              : '#91afd0',
        }}
      />
    </Box>
  )
}