"use client";

import { useState } from "react";
import { Stage, StageType } from "../../../calc/src/stagesCalculator";
import { Timespan } from "../../../calc/src/Timespan";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

export default function EditStage(props: {
  stage: Stage;
  onStageAdded?: (stage: Stage) => void;
  onCancel?: () => void;
}) {
  const [stage, setStage] = useState(props.stage);
  const [basedOn, setBasedOn] = useState<"tempo" | "bmp">("tempo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    props.onStageAdded?.(stage);
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ gap: 2, display: "flex", flexDirection: "column" }}
    >
      <FormControl fullWidth>
        <InputLabel>Type</InputLabel>
        <Select
          value={stage.type}
          onChange={(e) =>
            setStage((prev) => ({ ...prev, type: e.target.value as StageType }))
          }
          label="Type"
        >
          <MenuItem value="simple">Simple</MenuItem>
          <MenuItem value="sprint">Sprint</MenuItem>
          <MenuItem value="regeneration">Regeneration</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ display: "flex", gap: 2 }}>
        <TextField
          label="Minutes"
          type="number"
          value={stage.time.minutes}
          onChange={(e) => {
            setStage((prev) => ({
              ...prev,
              time: Timespan.fromMinutes(Number(e.target.value)).add(
                Timespan.fromSeconds(stage.time.seconds)
              ),
            }));
          }}
        />
        <TextField
          label="Seconds"
          type="number"
          value={stage.time.seconds}
          onChange={(e) =>
            setStage((prev) => ({
              ...prev,
              time: Timespan.fromMinutes(stage.time.minutes).add(
                Timespan.fromSeconds(Number(e.target.value))
              ),
            }))
          }
        />
      </Box>

      <FormControl fullWidth>
        <InputLabel>Based on</InputLabel>
        <Select
          value={basedOn}
          onChange={(e) => setBasedOn(e.target.value as typeof basedOn)}
          label="Type"
        >
          <MenuItem value="tempo">Tempo</MenuItem>
          <MenuItem value="bmp">Bmp</MenuItem>
        </Select>
      </FormControl>

      {basedOn === "bmp" && (
        <TextField
          label="BPM"
          type="number"
          value={"bmp" in stage ? stage.bmp : ""}
          onChange={(e) =>
            setStage((prev) => ({
              time: prev.time,
              type: prev.type,
              bmp: Number(e.target.value),
            }))
          }
        />
      )}

      {basedOn === "tempo" && (
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            label="Tempo Minutes"
            type="number"
            value={"tempo" in stage ? stage.tempo.minutes : 0}
            onChange={(e) =>
              "tempo" in stage &&
              setStage((prev) => ({
                time: prev.time,
                type: prev.type,
                tempo: Timespan.fromMinutes(Number(e.target.value)).add(
                  Timespan.fromSeconds("tempo" in prev ? prev.tempo.seconds : 0)
                ),
              }))
            }
          />
          <TextField
            label="Tempo Seconds"
            type="number"
            value={"tempo" in stage ? stage.tempo.seconds : 0}
            onChange={(e) =>
              "tempo" in stage &&
              setStage((prev) => ({
                ...prev,
                tempo: Timespan.fromMinutes(
                  "tempo" in prev ? prev.tempo.minutes : 0
                ).add(Timespan.fromSeconds(Number(e.target.value))),
              }))
            }
          />
        </Box>
      )}
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          color="secondary"
          sx={{ mt: 2 }}
          onClick={props.onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="secondary"
          sx={{ mt: 2 }}
        >
          Add
        </Button>
      </Stack>
    </Box>
  );
}
