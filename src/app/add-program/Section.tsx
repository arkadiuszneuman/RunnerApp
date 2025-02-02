import { MultiplyStage, Stage } from '@/services/stagesCalculator';
import Box from '@mui/material/Box';

export default function Section(props: { section: Stage | MultiplyStage }) {
  return (
    <>
      {'times' in props.section ? (
        <Box>
          <Box>Times: {props.section.times}</Box>
          <Box>--</Box>
          {props.section.stages.map((stage, index) => (
            <Section key={index} section={stage} />
          ))}
        </Box>
      ) : (
        <Box>
          <Box>Type: {props.section.type}</Box>
          <Box>Type: {props.section.duration.toString()}</Box>
          <Box>--------------------</Box>
        </Box>
      )}
    </>
  );
}
