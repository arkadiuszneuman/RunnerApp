"use client";

import { useEffect, useState } from "react";
import { Stage } from "../../../calc/src/stagesCalculator";
import { Timespan } from "../../../calc/src/Timespan";
import Button from "@mui/material/Button";
import EditStage from "./EditStage";
import Box from "@mui/material/Box";
import {
  getCurrentProgram,
  updateCurrentProgram,
} from "@/services/db/programRepository";
import Stack from "@mui/material/Stack";
import Link from "next/link";

export default function AddProgram() {
  const [state, setState] = useState<Stage[]>([]);
  const [editingStage, setEditingStage] = useState<Stage | undefined>(
    undefined
  );

  useEffect(() => {
    async function get() {
      const program = await getCurrentProgram();
      setState(program);
    }

    get();
  }, []);

  return (
    <Box>
      {state.map((stage, index) => (
        <Box key={index}>
          <Box>Type: {stage.type}</Box>
          <Box>Type: {stage.time.toString()}</Box>
          <Box>--------------------</Box>
        </Box>
      ))}
      {editingStage && (
        <EditStage
          stage={editingStage}
          onCancel={() => setEditingStage(undefined)}
          onStageAdded={async (stage) => {
            const currentState = [...state, stage];
            updateCurrentProgram(currentState);
            setState(currentState);
            setEditingStage(undefined);
          }}
        />
      )}
      {!editingStage && (
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" href="/" LinkComponent={Link}>
            Back
          </Button>
          <Button
            variant="contained"
            onClick={() =>
              setEditingStage({
                type: "simple",
                tempo: Timespan.fromMinutes(1),
                time: Timespan.fromMinutes(1),
              })
            }
          >
            Add Stage
          </Button>
        </Stack>
      )}
    </Box>
  );
}
