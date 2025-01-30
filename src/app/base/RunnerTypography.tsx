import Typography, { TypographyProps } from '@mui/material/Typography';

export type RunnerTypographyProps = {
  textVariant?: 'primary' | 'secondary';
} & TypographyProps;

export default function RunnerTypography(props: RunnerTypographyProps) {
  const { textVariant = 'primary', ...typographyProps } = props;

  return (
    <Typography
      {...typographyProps}
      sx={{
        fontWeight: '500',
        color: textVariant === 'primary' ? 'white' : 'rgb(160 189 255 / 46%)',
        textShadow: textVariant === 'primary' ? 'none' : '0px 0px 0px rgb(169 198 255 / 9%)',
        textTransform: 'uppercase',
        lineHeight: 1,
        ...typographyProps.sx,
      }}
    ></Typography>
  );
}
