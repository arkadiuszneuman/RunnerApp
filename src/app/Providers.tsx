"use client";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { ReactNode, useEffect } from "react";
import { ThemeProvider } from "@mui/material/styles";
import theme from "./theme";
import objectSupport from "dayjs/plugin/objectSupport";
import dayjs from "dayjs";

export default function Providers(props: { children?: ReactNode }) {
  useEffect(() => {
    dayjs.extend(objectSupport);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        {props.children}
      </LocalizationProvider>
    </ThemeProvider>
  );
}
