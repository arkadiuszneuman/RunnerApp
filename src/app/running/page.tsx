'use client';

import Button from '@mui/material/Button';
import Grid2 from '@mui/material/Grid2';
import { useAtomValue } from 'jotai';
import Link from 'next/link';
import { runningStateAtom } from '../atoms';
import useRunningLoop from '../useRunningLoop';
import RunInfo from './RunInfo/RunInfo';

export default function Run() {
  const runningLoop = useRunningLoop();
  const runningState = useAtomValue(runningStateAtom);

  async function startNew() {
    await runningLoop.start();
  }

  async function stop() {
    await runningLoop.stop();
  }

  return (
    <Grid2 container spacing={4}>
      <Grid2 size={12}>
        <RunInfo />
      </Grid2>
      <Grid2 container spacing={1} marginX={2} size={12}>
        <Grid2 size="auto">
          <Button variant="contained" onClick={startNew} disabled={runningState.running}>
            Start
          </Button>
        </Grid2>
        <Grid2 size="auto">
          <Button variant="contained" onClick={stop} disabled={!runningState.running}>
            Stop
          </Button>
        </Grid2>
        <Grid2 size="grow"></Grid2>
        <Grid2 size="auto">
          <Button
            variant="contained"
            color="error"
            href="/"
            disabled={runningState.running}
            LinkComponent={Link}
          >
            Back
          </Button>
        </Grid2>
      </Grid2>
    </Grid2>
  );

  // const mockData = [
  //   { time: "0", speed: 5, incline: 1 },
  //   { time: "5", speed: 8, incline: 2 },
  //   { time: "10", speed: 6, incline: 3 },
  //   { time: "15", speed: 7, incline: 1 },
  // ];

  // return (
  //   <Box sx={{ p: 3 }}>
  //     <Grid container spacing={3}>
  //       <Grid item xs={3}>
  //         <StyledPaper
  //           sx={{
  //             minHeight: 140,
  //             display: "flex",
  //             flexDirection: "column",
  //             justifyContent: "center",
  //             background: "linear-gradient(45deg, #FF5252 30%, #FF1744 90%)",
  //             color: "white",
  //           }}
  //         >
  //           <Typography variant="h6" sx={{ opacity: 0.8 }}>
  //             Heart Rate
  //           </Typography>
  //           <Typography variant="h3" sx={{ my: 1, fontWeight: "bold" }}>
  //             145
  //           </Typography>
  //           <Typography variant="subtitle1" sx={{ opacity: 0.7 }}>
  //             BPM
  //           </Typography>
  //         </StyledPaper>
  //       </Grid>
  //       <Grid item xs={3}>
  //         <StyledPaper>
  //           <Typography variant="h6">Speed</Typography>
  //           <Typography variant="h4">8.5</Typography>
  //           <Typography variant="subtitle1">KM/H</Typography>
  //         </StyledPaper>
  //       </Grid>
  //       <Grid item xs={3}>
  //         <StyledPaper>
  //           <Typography variant="h6">Incline</Typography>
  //           <Typography variant="h4">2.0</Typography>
  //           <Typography variant="subtitle1">%</Typography>
  //         </StyledPaper>
  //       </Grid>
  //       <Grid item xs={3}>
  //         <StyledPaper>
  //           <Typography variant="h6">Pace</Typography>
  //           <Typography variant="h4">7:03</Typography>
  //           <Typography variant="subtitle1">MIN/KM</Typography>
  //         </StyledPaper>
  //       </Grid>
  //       <Grid item xs={12}>
  //         <StyledPaper>
  //           <Typography variant="h6" gutterBottom>
  //             Running Program
  //           </Typography>
  //           <LineChart width={800} height={300} data={mockData}>
  //             <CartesianGrid strokeDasharray="3 3" />
  //             <XAxis
  //               dataKey="time"
  //               label={{ value: "Time (min)", position: "bottom" }}
  //             />
  //             <YAxis />
  //             <Tooltip />
  //             <Legend />
  //             <Line type="monotone" dataKey="speed" stroke="#8884d8" />
  //             <Line type="monotone" dataKey="incline" stroke="#82ca9d" />
  //           </LineChart>
  //         </StyledPaper>
  //       </Grid>
  //     </Grid>
  //   </Box>
  // );
}
