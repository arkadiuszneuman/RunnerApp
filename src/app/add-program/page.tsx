"use client";

import { useReducer, useState } from "react";
import { Stage } from "../../../calc/src/stagesCalculator";
import { traningProgramReducer } from "../BleConnector";
import { Timespan } from "../../../calc/src/Timespan";
import Button from "@mui/material/Button";
import EditStage from "./EditStage";
import Box from "@mui/material/Box";

export default function AddProgram() {
  const [state, dispatch] = useReducer(traningProgramReducer, { stages: [] });
  const [editingStage, setEditingStage] = useState<Stage | undefined>(
    undefined
  );

  return (
    <Box>
      {state.stages.map((stage, index) => (
        <Box key={index}>Type: {stage.type}</Box>
      ))}
      {editingStage && (
        <EditStage
          stage={editingStage}
          onStageAdded={(stage) => {
            dispatch({ type: "add_stage", stageToAdd: stage });
            setEditingStage(undefined);
          }}
        />
      )}
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
    </Box>
  );
}
